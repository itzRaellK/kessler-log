"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  RefreshCw,
  Search,
  Star,
  Timer,
  BarChart3,
  ChevronDown,
  X,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Line,
  AreaChart,
  Area,
  Brush,
  ReferenceLine,
  LabelList,
} from "recharts";

import {
  useStatsDashboard,
  type PeriodPreset,
  type StatsFilters,
} from "./components/useStatsDashboard";
import { GameHistoryDrawer } from "./components/GameHistoryDrawer";

/* =========================
   Utils + Styles (igual sua pegada)
========================= */
function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function formatDateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function timeAgoShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const sec = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const days = Math.floor(hr / 24);

  if (days > 0) return days === 1 ? "Há 1 dia" : `Há ${days} dias`;
  if (hr > 0) return hr === 1 ? "Há 1h" : `Há ${hr}h`;
  if (min > 0) return min === 1 ? "Há 1 min" : `Há ${min} min`;
  return "Agora";
}

// ✅ helper: ano/mês atual
function getNowYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const GLASS_CARD =
  "rounded-2xl border border-border/50 bg-card/60 shadow-xl backdrop-blur-xl";
const SOFT_RING = "ring-1 ring-border/20";
const CLICKABLE = "cursor-pointer disabled:cursor-not-allowed";

const INPUT_WRAP = "kb-ring kb-ring-focus";
const INPUT_BASE =
  "kb-ring-inner relative h-11 w-full rounded-xl border border-border/70 bg-background/90 ring-1 ring-border/20 shadow-sm transition-all dark:border-border/50 dark:bg-background/70 dark:shadow-none";
const INPUT_EL =
  "h-11 w-full bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground";

const SELECT_BASE =
  "h-11 w-full rounded-xl border border-border/70 bg-background/90 px-3 text-sm text-foreground ring-1 ring-border/20 shadow-sm outline-none transition-all dark:border-border/50 dark:bg-background/70 dark:shadow-none";

const CHIP =
  "inline-flex items-center rounded-full border border-border/50 bg-card/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground";

/* =========================
   Chart helpers
========================= */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function GlassTooltip(props: any) {
  const { active, payload, label, labelFormatter } = props;
  if (!active || !payload?.length) return null;

  const finalLabel =
    typeof labelFormatter === "function" ? labelFormatter(label) : label;

  return (
    <div className="rounded-2xl border border-border/50 bg-background/80 p-3 shadow-2xl backdrop-blur-xl">
      <div className="text-[11px] font-semibold text-foreground">
        {finalLabel}
      </div>
      <div className="mt-2 space-y-1">
        {payload
          .filter((p: any) => p?.value != null && p.value !== "")
          .map((p: any) => (
            <div
              key={p.dataKey}
              className="flex items-center justify-between gap-6"
            >
              <span className="text-[11px] text-muted-foreground">
                {p.name ?? p.dataKey}
              </span>
              <span className="text-[11px] font-semibold text-foreground">
                {typeof p.value === "number"
                  ? p.value.toFixed(1)
                  : String(p.value)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

/* =========================
   Animated BG (leve)
========================= */
type Orb = {
  id: string;
  size: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  drift: number;
  duration: number;
  delay: number;
  opacity: number;
  blur: number;
  hue: "violet" | "emerald" | "blue" | "rose";
};
function makeSeededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function bgForHue(hue: Orb["hue"]) {
  if (hue === "violet")
    return "radial-gradient(circle at 30% 30%, rgba(168,85,247,0.26), transparent 60%)";
  if (hue === "emerald")
    return "radial-gradient(circle at 40% 40%, rgba(16,185,129,0.22), transparent 62%)";
  if (hue === "blue")
    return "radial-gradient(circle at 50% 45%, rgba(59,130,246,0.20), transparent 62%)";
  return "radial-gradient(circle at 45% 45%, rgba(244,63,94,0.18), transparent 62%)";
}
function AnimatedBg() {
  const reduceMotion = useReducedMotion();
  const orbs = useMemo<Orb[]>(() => {
    const rng = makeSeededRng(7331);
    const hues: Orb["hue"][] = ["violet", "emerald", "blue", "rose"];
    const list: Orb[] = [];
    const count = 8;
    for (let i = 0; i < count; i++) {
      const hue = hues[Math.floor(rng() * hues.length)];
      const size = 260 + rng() * 420;
      const opacity = 0.12 + rng() * 0.08;
      const blur = 32 + rng() * 42;

      const x0 = -10 + rng() * 120;
      const y0 = -10 + rng() * 120;
      const x1 = -10 + rng() * 120;
      const y1 = -10 + rng() * 120;

      list.push({
        id: `orb-${i}`,
        size,
        x0,
        y0,
        x1,
        y1,
        drift: 40 + rng() * 140,
        duration: 18 + rng() * 20,
        delay: rng() * 6,
        opacity,
        blur,
        hue,
      });
    }
    return list;
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.035)_1px,transparent_0)] bg-[size:28px_28px]" />
      {orbs.map((o) => {
        const common: CSSProperties = {
          width: o.size,
          height: o.size,
          filter: `blur(${o.blur}px)`,
          opacity: o.opacity,
          background: bgForHue(o.hue),
          mixBlendMode: "overlay",
        };

        if (reduceMotion) {
          return (
            <div
              key={o.id}
              className="absolute rounded-full"
              style={{
                ...common,
                left: `${lerp(o.x0, o.x1, 0.5)}vw`,
                top: `${lerp(o.y0, o.y1, 0.5)}vh`,
                transform: "translate(-50%, -50%)",
              }}
            />
          );
        }

        return (
          <motion.div
            key={o.id}
            className="absolute rounded-full"
            style={{
              ...common,
              left: `${o.x0}vw`,
              top: `${o.y0}vh`,
              transform: "translate(-50%, -50%)",
            }}
            animate={{
              left: [`${o.x0}vw`, `${o.x1}vw`],
              top: [`${o.y0}vh`, `${o.y1}vh`],
              x: [0, o.drift, -o.drift * 0.5, 0],
              y: [0, -o.drift * 0.6, o.drift * 0.3, 0],
              scale: [1, 1.05, 0.98, 1],
              opacity: [o.opacity * 0.75, o.opacity, o.opacity * 0.75],
            }}
            transition={{
              duration: o.duration,
              delay: o.delay,
              repeat: Infinity,
              repeatType: "mirror",
              ease: "easeInOut",
            }}
          />
        );
      })}
      <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/5 to-background/20" />
    </div>
  );
}

/* =========================
   Page
========================= */
export default function StatsPage() {
  const {
    loading,
    error,
    filters,
    setFilters,
    resetFilters,
    statusOptions,
    yearOptions,
    monthOptions,
    periodOptions,
    gameQuery,
    setGameQuery,
    gameOptions,
    dashboard,
    feed,
    feedHasMore,
    feedLoadMore,
    refreshAll,
  } = useStatsDashboard();

  // drawer (histórico do jogo)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerGameId, setDrawerGameId] = useState<string | null>(null);

  // filtros colapsáveis
  const [filtersOpen, setFiltersOpen] = useState(true);

  // controla overflow do corpo dos filtros durante animação (pra dropdown não ser cortado)
  const [bodyOverflow, setBodyOverflow] = useState<"hidden" | "visible">(
    "hidden"
  );
  useEffect(() => {
    setBodyOverflow("hidden");
  }, [filtersOpen]);

  // ✅ portal dropdown (pra NÃO ficar atrás dos KPIs)
  const gameInputRef = useRef<HTMLDivElement | null>(null);
  const gameDropdownRef = useRef<HTMLDivElement | null>(null);
  const [gameRect, setGameRect] = useState<DOMRect | null>(null);

  // UI state (auto-apply)
  const [uiPeriod, setUiPeriod] = useState<PeriodPreset>(filters.period);
  const [uiYear, setUiYear] = useState<number | null>(filters.year);
  const [uiMonth, setUiMonth] = useState<number | null>(filters.month);
  const [uiStatusId, setUiStatusId] = useState<string | null>(filters.statusId);
  const [uiGameId, setUiGameId] = useState<string | null>(filters.gameId);
  const [uiGameLabel, setUiGameLabel] = useState<string>("");

  const showGameDropdown =
    !uiGameId && !!gameQuery.trim() && gameOptions.length > 0;

  // ✅ garante ano/mês quando o período exigir (sem atropelar escolha)
  useEffect(() => {
    const { year, month } = getNowYearMonth();

    if (uiPeriod === "month") {
      setUiYear((prev) => prev ?? year);
      setUiMonth((prev) => prev ?? month);
      return;
    }

    if (uiPeriod === "year") {
      setUiYear((prev) => prev ?? year);
      // opcional (se quiser): ao sair de month, limpar mês
      // setUiMonth(null);
    }
  }, [uiPeriod]);

  // sync UI quando filtros mudarem por fora
  useEffect(() => {
    setUiPeriod(filters.period);
    setUiYear(filters.year);
    setUiMonth(filters.month);
    setUiStatusId(filters.statusId);
    setUiGameId(filters.gameId);

    const inferred =
      (filters.gameId &&
        (feed.find((f) => f.game_id === filters.gameId)?.game_title ?? "")) ||
      "";
    setUiGameLabel(inferred);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.period,
    filters.year,
    filters.month,
    filters.statusId,
    filters.gameId,
  ]);

  // ✅ AUTO APPLY (debounce leve) — IMPORTANTE:
  // Não mandar year/month=null em last30/last90/all (senão você “limpa” o estado do hook)
  useEffect(() => {
    const t = setTimeout(() => {
      const qFromInput = uiGameId ? "" : (gameQuery ?? "").trim();

      const { year: nowYear, month: nowMonth } = getNowYearMonth();

      const patch: Partial<StatsFilters> = {
        period: uiPeriod,
        q: qFromInput,
        statusId: uiStatusId,
        gameId: uiGameId,
      };

      if (uiPeriod === "month") {
        patch.year = uiYear ?? nowYear;
        patch.month = uiMonth ?? nowMonth;
      } else if (uiPeriod === "year") {
        patch.year = uiYear ?? nowYear;
        patch.month = null; // opcional: garante que month não “vaze” no estado
      } else {
        // ✅ last30/last90/all -> NÃO altera year/month
        // (mantém defaults do hook ou a última seleção útil)
      }

      setFilters(patch);
    }, 240);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiPeriod, uiYear, uiMonth, uiStatusId, uiGameId, gameQuery]);

  // Recalcula posição do input enquanto dropdown estiver aberto
  useEffect(() => {
    if (!showGameDropdown) return;

    const el = gameInputRef.current;
    if (!el) return;

    const update = () => setGameRect(el.getBoundingClientRect());
    update();

    // scroll em qualquer container também (capturing)
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showGameDropdown, gameQuery, uiGameId]);

  // Fecha dropdown no clique fora / Esc
  useEffect(() => {
    if (!showGameDropdown) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGameQuery("");
    };

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;

      const insideInput = !!gameInputRef.current?.contains(t);
      const insideDrop = !!gameDropdownRef.current?.contains(t);

      if (!insideInput && !insideDrop) setGameQuery("");
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [showGameDropdown, setGameQuery]);

  const selectedStatusLabel = useMemo(() => {
    if (!filters.statusId) return null;
    return statusOptions.find((s) => s.id === filters.statusId)?.name ?? null;
  }, [filters.statusId, statusOptions]);

  const selectedMonthLabel = useMemo(() => {
    if (!filters.month) return null;
    return monthOptions.find((m) => m.value === filters.month)?.label ?? null;
  }, [filters.month, monthOptions]);

  const appliedGameLabel = useMemo(() => {
    if (!filters.gameId) return null;
    return (
      feed.find((f) => f.game_id === filters.gameId)?.game_title ??
      uiGameLabel ??
      "jogo"
    );
  }, [filters.gameId, feed, uiGameLabel]);

  const periodLabel = useMemo(() => {
    return (
      periodOptions.find((p) => p.value === filters.period)?.label ?? "Período"
    );
  }, [filters.period, periodOptions]);

  const kpis = dashboard?.kpis ?? null;

  const recentRatings = dashboard?.recentRatings ?? [];
  const timeline = dashboard?.timeline ?? [];
  const topTimeByGame = dashboard?.topTimeByGame ?? [];

  const showBrush = timeline.length > 22;

  const headerToggle = () => setFiltersOpen((v) => !v);

  const isMsgError = !!error;

  // timeline formatting
  const xTick = (ts: any) => {
    const n = Number(ts);
    if (!Number.isFinite(n)) return "";
    const d = new Date(n);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  const xLabelFormatter = (ts: any) => {
    const n = Number(ts);
    if (!Number.isFinite(n)) return "—";
    const d = new Date(n);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-background">
      <AnimatedBg />

      <GameHistoryDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        gameId={drawerGameId}
      />

      <div className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 pb-8 pt-24 sm:px-6 xl:max-w-7xl 2xl:max-w-screen-2xl">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground/90">
              Agora o foco é: <b>“quanto você deu pros últimos jogos”</b> (por
              período).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className={cx("h-10 rounded-xl", CLICKABLE)}
              onClick={() => refreshAll()}
              disabled={loading}
              title="Recarregar"
            >
              <RefreshCw size={16} className="mr-2" />
              Recarregar
            </Button>
          </div>
        </div>

        {/* Notice / Error */}
        {error ? (
          <div
            className={cx(
              GLASS_CARD,
              SOFT_RING,
              "p-4",
              isMsgError ? "border-destructive/40" : "border-emerald-500/25"
            )}
          >
            <div className="text-sm text-muted-foreground">{error}</div>
          </div>
        ) : null}

        {/* Filters (collapsible) */}
        <section className={cx(GLASS_CARD, SOFT_RING, "p-0 overflow-visible")}>
          {/* Header clicável */}
          <div
            role="button"
            tabIndex={0}
            onClick={headerToggle}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") headerToggle();
            }}
            className={cx(
              "p-6 select-none",
              "cursor-pointer transition hover:bg-card/40"
            )}
            title="Clique para recolher/expandir"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Filter size={16} className="opacity-80" />
                  Filtros
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    • auto
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className={CHIP}>período: {periodLabel}</span>

                  {filters.period === "month" && filters.year ? (
                    <span className={CHIP}>
                      {filters.month
                        ? `mês: ${selectedMonthLabel}`
                        : "mês: todos"}
                      {" • "}
                      ano: {filters.year}
                    </span>
                  ) : null}

                  {filters.period === "year" && filters.year ? (
                    <span className={CHIP}>ano: {filters.year}</span>
                  ) : null}

                  {filters.gameId ? (
                    <span className={CHIP}>jogo: {appliedGameLabel}</span>
                  ) : null}

                  {filters.statusId ? (
                    <span className={CHIP}>
                      status: {selectedStatusLabel ?? "—"}
                    </span>
                  ) : null}

                  {filters.q?.trim() ? (
                    <span className={CHIP}>busca: “{filters.q.trim()}”</span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className={cx("h-10 rounded-xl", CLICKABLE)}
                  onClick={(e) => {
                    e.stopPropagation();

                    resetFilters();

                    // ✅ mantém UI com ano/mês vigente (principalmente se depois mudar pra month/year)
                    const { year, month } = getNowYearMonth();
                    setUiYear(year);
                    setUiMonth(month);

                    setUiGameId(null);
                    setGameQuery("");
                    setUiGameLabel("");
                  }}
                  disabled={loading}
                  title="Resetar filtros"
                >
                  Reset
                </Button>

                <ChevronDown
                  size={18}
                  className={cx(
                    "text-muted-foreground transition",
                    filtersOpen && "rotate-180"
                  )}
                />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {filtersOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                onAnimationComplete={() => {
                  // quando terminar de abrir, libera overflow pra dropdown não ser cortado
                  setBodyOverflow(filtersOpen ? "visible" : "hidden");
                }}
                className={cx(
                  "border-t border-border/50",
                  bodyOverflow === "hidden"
                    ? "overflow-hidden"
                    : "overflow-visible"
                )}
              >
                <div className="p-6">
                  {/* ✅ tudo na mesma linha no desktop; no mobile empilha */}
                  <div className="grid gap-3 grid-cols-1 lg:grid-cols-4">
                    {/* Ano */}
                    <div className="">
                      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
                        Ano
                      </div>
                      <select
                        className={SELECT_BASE}
                        value={uiYear ?? 0}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setUiYear(v === 0 ? null : v);
                        }}
                      >
                        <option value={0}>—</option>
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 text-[11px] text-muted-foreground/80">
                        aplica em <b>Mês</b> e <b>Ano</b>.
                      </div>
                    </div>

                    {/* Mês */}
                    <div className="">
                      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
                        Mês
                      </div>
                      <select
                        className={SELECT_BASE}
                        value={uiMonth ?? 0}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setUiMonth(v === 0 ? null : v);
                        }}
                      >
                        <option value={0}>Todos</option>
                        {monthOptions.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      <div className="mt-2 text-[11px] text-muted-foreground/80">
                        aplica só em <b>Mês</b>.
                      </div>
                    </div>

                    {/* Status */}
                    <div className="">
                      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
                        Status
                      </div>
                      <select
                        className={SELECT_BASE}
                        value={uiStatusId ?? ""}
                        onChange={(e) =>
                          setUiStatusId(e.target.value ? e.target.value : null)
                        }
                      >
                        <option value="">Todos</option>
                        {statusOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Jogo / Busca (na mesma linha) */}
                    <div className="">
                      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
                        Jogo / Busca (título)
                      </div>

                      <div ref={gameInputRef} className="relative">
                        <div className={INPUT_WRAP}>
                          <div className={INPUT_BASE}>
                            <Search
                              size={16}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                            />

                            <input
                              className={cx(INPUT_EL, "pl-9 pr-9")}
                              value={uiGameId ? uiGameLabel : gameQuery}
                              onChange={(e) => {
                                const v = e.target.value;
                                setUiGameId(null);
                                setUiGameLabel("");
                                setGameQuery(v);
                              }}
                              placeholder="Digite para filtrar por título… (ou selecione um jogo para fixar)"
                            />

                            {(uiGameId || gameQuery) && (
                              <button
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setUiGameId(null);
                                  setUiGameLabel("");
                                  setGameQuery("");
                                }}
                                title="Limpar"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* ✅ Dropdown em PORTAL (nunca fica atrás dos KPIs) */}
                        {showGameDropdown &&
                        gameRect &&
                        typeof document !== "undefined"
                          ? createPortal(
                              <div
                                ref={gameDropdownRef}
                                style={{
                                  position: "fixed",
                                  left: gameRect.left,
                                  top: gameRect.bottom + 8,
                                  width: gameRect.width,
                                  zIndex: 2147483647,
                                }}
                                className="overflow-hidden rounded-2xl border border-border/50 bg-background/90 shadow-2xl backdrop-blur-xl"
                              >
                                <div className="max-h-[320px] overflow-auto p-2">
                                  {gameOptions.map((g) => (
                                    <button
                                      key={g.id}
                                      type="button"
                                      onClick={() => {
                                        setUiGameId(g.id);
                                        setUiGameLabel(g.title);
                                        setGameQuery("");
                                        setFiltersOpen(false);
                                      }}
                                      className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left hover:border-border/50 hover:bg-card/40"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-semibold text-foreground">
                                          {g.title}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">
                                          {g.platform ?? "—"}
                                        </div>
                                      </div>
                                      <ChevronDown
                                        size={16}
                                        className="rotate-[-90deg] text-muted-foreground"
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>,
                              document.body
                            )
                          : null}
                      </div>

                      {uiGameId ? (
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          selecionado:{" "}
                          <span className="font-semibold text-foreground">
                            {uiGameLabel}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-2 text-[11px] text-muted-foreground/80">
                          digite para filtrar por <b>título</b> • selecione um
                          item para fixar o <b>jogo</b>.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>

        {/* KPI cards */}
        <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          <div className={cx(GLASS_CARD, SOFT_RING, "p-5")}>
            <div className="text-[11px] text-muted-foreground">
              Ciclos (qtd)
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {kpis ? kpis.cycles : "—"}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              abertos: {kpis ? kpis.openCycles : "—"} • média:{" "}
              {kpis?.avgFinalRating != null
                ? kpis.avgFinalRating.toFixed(1)
                : "—"}
            </div>
          </div>

          <div className={cx(GLASS_CARD, SOFT_RING, "p-5")}>
            <div className="text-[11px] text-muted-foreground">
              Sessões (qtd)
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {kpis ? kpis.finishedSessions : "—"}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              média score:{" "}
              {kpis?.avgSessionScore != null
                ? kpis.avgSessionScore.toFixed(1)
                : "—"}
              {" • "}
              média min:{" "}
              {kpis?.avgSessionMinutes != null
                ? kpis.avgSessionMinutes.toFixed(0)
                : "—"}
            </div>
          </div>

          <div className={cx(GLASS_CARD, SOFT_RING, "p-5")}>
            <div className="text-[11px] text-muted-foreground">
              Reviews (qtd)
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {kpis ? kpis.reviewsWritten : "—"}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              média (c/ review):{" "}
              {kpis?.avgReviewedFinalRating != null
                ? kpis.avgReviewedFinalRating.toFixed(1)
                : "—"}
            </div>
          </div>

          <div className={cx(GLASS_CARD, SOFT_RING, "p-5")}>
            <div className="text-[11px] text-muted-foreground">
              Nota externa (qtd)
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {kpis ? kpis.externalRatingsCount : "—"}
            </div>

            <div className="mt-3 max-h-20 overflow-auto pr-1">
              <div className="flex flex-wrap gap-2">
                {(kpis?.externalRatings ?? []).map((er: any, idx: number) => (
                  <span
                    key={`${er.label}-${idx}`}
                    className="inline-flex items-center rounded-full border border-border/50 bg-card/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground"
                    title={er.label}
                  >
                    {er.label} • {Number(er.score).toFixed(1)}
                  </span>
                ))}

                {!kpis?.externalRatings?.length ? (
                  <span className="text-[11px] text-muted-foreground/70">
                    (sem notas externas no recorte)
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className={cx(GLASS_CARD, SOFT_RING, "p-5")}>
            <div className="text-[11px] text-muted-foreground">Tempo total</div>
            <div className="mt-1 inline-flex items-center gap-2 text-2xl font-bold text-foreground">
              <Timer size={18} className="opacity-80" />
              {kpis ? `${kpis.totalMinutes} min` : "—"}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              última nota:{" "}
              {kpis?.lastFinalRating != null
                ? kpis.lastFinalRating.toFixed(1)
                : "—"}
            </div>
          </div>
        </section>

        {/* Charts novos */}
        <section className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          <div className={cx(GLASS_CARD, SOFT_RING, "p-6 lg:col-span-2")}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">
                Últimas notas (ciclos avaliados)
              </div>
              <div className="text-[11px] text-muted-foreground inline-flex items-center gap-2">
                <BarChart3 size={12} className="opacity-70" />
                {loading ? "Carregando…" : "Atualizado"}
              </div>
            </div>

            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={recentRatings}
                  layout="vertical"
                  margin={{ left: 18, right: 18, top: 6, bottom: 6 }}
                  barCategoryGap={10}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.35}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    type="number"
                    domain={[0, 10]}
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    axisLine={{
                      stroke: "hsl(var(--border))",
                      strokeOpacity: 0.35,
                    }}
                    tickLine={{
                      stroke: "hsl(var(--border))",
                      strokeOpacity: 0.35,
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={190}
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    axisLine={{
                      stroke: "hsl(var(--border))",
                      strokeOpacity: 0.35,
                    }}
                    tickLine={{
                      stroke: "hsl(var(--border))",
                      strokeOpacity: 0.35,
                    }}
                  />
                  <Tooltip content={<GlassTooltip />} />

                  <Bar
                    dataKey="rating_final"
                    name="nota final"
                    fill="hsl(var(--primary))"
                    radius={[10, 10, 10, 10]}
                    isAnimationActive={!loading}
                  >
                    <LabelList
                      dataKey="rating_final"
                      position="right"
                      formatter={(v: any) =>
                        typeof v === "number" ? v.toFixed(1) : ""
                      }
                      style={{
                        fontSize: 11,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                  </Bar>

                  <Bar
                    dataKey="avg_score_finished"
                    name="média sessões"
                    fill="hsl(var(--muted-foreground))"
                    radius={[10, 10, 10, 10]}
                    isAnimationActive={!loading}
                  />

                  <Bar
                    dataKey="external_rating"
                    name="nota externa"
                    fill="hsl(var(--foreground))"
                    fillOpacity={0.25}
                    radius={[10, 10, 10, 10]}
                    isAnimationActive={!loading}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 text-[11px] text-muted-foreground">
              Isso aqui é o que você queria ver:{" "}
              <b>os últimos ciclos com nota</b>, com comparação opcional com{" "}
              <b>média das sessões</b> e <b>nota externa</b>.
            </div>
          </div>

          <div className={cx(GLASS_CARD, SOFT_RING, "p-6")}>
            <div className="mb-3 text-sm font-semibold text-foreground">
              Top jogos por tempo (min)
            </div>

            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topTimeByGame}
                  layout="vertical"
                  margin={{ left: 18, right: 18, top: 6, bottom: 6 }}
                  barCategoryGap={10}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.35}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    type="number"
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    axisLine={{
                      stroke: "hsl(var(--border))",
                      strokeOpacity: 0.35,
                    }}
                    tickLine={{
                      stroke: "hsl(var(--border))",
                      strokeOpacity: 0.35,
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="game_title"
                    width={130}
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    axisLine={{
                      stroke: "hsl(var(--border))",
                      strokeOpacity: 0.35,
                    }}
                    tickLine={{
                      stroke: "hsl(var(--border))",
                      strokeOpacity: 0.35,
                    }}
                  />
                  <Tooltip content={<GlassTooltip />} />
                  <Bar
                    dataKey="minutes"
                    name="minutos"
                    fill="hsl(var(--primary))"
                    radius={[10, 10, 10, 10]}
                    isAnimationActive={!loading}
                  >
                    <LabelList
                      dataKey="minutes"
                      position="right"
                      formatter={(v: any) =>
                        typeof v === "number" ? `${v.toFixed(0)}m` : ""
                      }
                      style={{
                        fontSize: 11,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 text-[11px] text-muted-foreground">
              (ajuda a entender “onde foi meu tempo” no recorte)
            </div>
          </div>

          <div className={cx(GLASS_CARD, SOFT_RING, "p-6 lg:col-span-3")}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">
                Timeline (nota final vs média das sessões)
              </div>
              <div className="text-[11px] text-muted-foreground">
                eixo 0–10 • ordenado por data
              </div>
            </div>

            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timeline}
                  margin={{ left: 8, right: 16, top: 6, bottom: 6 }}
                >
                  <defs>
                    <linearGradient id="gradFinal" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.35}
                    strokeDasharray="3 3"
                  />

                  <XAxis
                    dataKey="ts"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={xTick}
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    axisLine={{
                      stroke: "hsl(var(--border))",
                      strokeOpacity: 0.35,
                    }}
                    tickLine={{
                      stroke: "hsl(var(--border))",
                      strokeOpacity: 0.35,
                    }}
                  />

                  <YAxis
                    domain={[0, 10]}
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    axisLine={{
                      stroke: "hsl(var(--border))",
                      strokeOpacity: 0.35,
                    }}
                    tickLine={{
                      stroke: "hsl(var(--border))",
                      strokeOpacity: 0.35,
                    }}
                  />

                  <Tooltip
                    content={<GlassTooltip />}
                    labelFormatter={xLabelFormatter}
                  />

                  {kpis?.avgFinalRating != null ? (
                    <ReferenceLine
                      y={kpis.avgFinalRating}
                      stroke="hsl(var(--muted-foreground))"
                      strokeOpacity={0.45}
                      strokeDasharray="6 6"
                    />
                  ) : null}

                  <Area
                    type="monotone"
                    dataKey="rating_final"
                    name="nota final"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#gradFinal)"
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={!loading}
                  />

                  <Line
                    type="monotone"
                    dataKey="avg_score_finished"
                    name="média sessões"
                    stroke="hsl(var(--foreground))"
                    strokeOpacity={0.35}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={!loading}
                  />

                  <Line
                    type="monotone"
                    dataKey="external_rating"
                    name="nota externa"
                    stroke="hsl(var(--foreground))"
                    strokeOpacity={0.18}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={!loading}
                  />

                  {showBrush ? (
                    <Brush
                      dataKey="ts"
                      height={26}
                      stroke="hsl(var(--primary))"
                      travellerWidth={10}
                    />
                  ) : null}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 text-[11px] text-muted-foreground">
              Se sua “média das sessões” fica alta e a “nota final” cai, é sinal
              de <b>review mais crítica</b> (ou vice-versa).
            </div>
          </div>
        </section>

        {/* Feed */}
        <section className={cx(GLASS_CARD, SOFT_RING, "p-6")}>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">
              Feed (ciclos com nota){" "}
              <span className="text-muted-foreground">
                • {feed.length} itens
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              clique no card → abre histórico
            </div>
          </div>

          {feed.length ? (
            <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
              {feed.map((r) => (
                <button
                  key={r.cycle_id}
                  onClick={() => {
                    setDrawerGameId(r.game_id);
                    setDrawerOpen(true);
                  }}
                  className={cx(
                    "text-left rounded-2xl border border-border/50 bg-card/40 shadow-xl backdrop-blur-xl transition hover:bg-card/50",
                    SOFT_RING
                  )}
                >
                  <div className="flex gap-3 p-4">
                    <div className="h-16 w-24 overflow-hidden rounded-xl border border-border/50 bg-background/30">
                      {r.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.cover_url}
                          alt={r.game_title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <BarChart3 size={18} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {r.game_title}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {r.platform ?? "—"} • {r.status_name ?? "status"} •{" "}
                            {formatDateShort(r.started_at)}
                            {r.ended_at
                              ? ` → ${formatDateShort(r.ended_at)}`
                              : " • aberto"}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-card/40 px-2.5 py-1 text-[11px] font-semibold text-foreground">
                            <Star size={12} className="opacity-80" />
                            {Number(r.rating_final).toFixed(1)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Timer size={12} className="opacity-80" />
                          {r.total_minutes_finished ?? 0} min
                        </span>

                        <span className="opacity-50">•</span>

                        <span>
                          sessões: {r.sessions_count_finished ?? 0} • média
                          sessão:{" "}
                          {r.avg_score_finished != null
                            ? Number(r.avg_score_finished).toFixed(1)
                            : "—"}
                        </span>

                        <span className="opacity-50">•</span>

                        <span>
                          última:{" "}
                          {timeAgoShort(
                            r.last_session_started_at ?? r.started_at
                          )}
                        </span>
                      </div>

                      {r.review_text?.trim() ? (
                        <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          {r.review_text.trim()}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground/70">
                          (sem review no ciclo)
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Nenhum item no feed com esses filtros.
            </div>
          )}

          <div className="mt-5 flex flex-col items-center gap-2">
            <Button
              variant="outline"
              className={cx("h-11 rounded-xl", CLICKABLE)}
              disabled={loading || !feedHasMore}
              onClick={() => feedLoadMore()}
              title="Carregar mais (10 em 10)"
            >
              {feedHasMore ? "Carregar mais" : "Sem mais itens"}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
