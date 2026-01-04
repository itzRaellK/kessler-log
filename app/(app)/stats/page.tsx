"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
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
  PieChart as PieIcon,
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
  LabelList,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import {
  useStatsDashboard,
  type PeriodPreset,
  type StatsFilters,
} from "./components/useStatsDashboard";
import { GameHistoryDrawer } from "./components/GameHistoryDrawer";

/* =========================
   Utils + Styles
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
   Emerald palette (charts)
========================= */
const EMERALD_400 = "rgba(52,211,153,1)";
const EMERALD_500 = "rgba(16,185,129,1)";
const EMERALD_600 = "rgba(5,150,105,1)";
function donutGradId(i: number) {
  return `donutGrad-${i}`;
}

/* =========================
   Chart helpers
========================= */
function GlassTooltipShell(props: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-background/80 p-3 shadow-2xl backdrop-blur-xl">
      <div className="text-[11px] font-semibold text-foreground">
        {props.title}
      </div>
      <div className="mt-2">{props.children}</div>
    </div>
  );
}

function HoursByMonthTooltip(props: any) {
  const { active, payload } = props;
  if (!active || !payload?.length) return null;

  const p = payload?.[0]?.payload;
  if (!p) return null;

  const monthLabel = p.label ?? "—";
  const totalHours =
    typeof p.hours === "number" ? p.hours.toFixed(1) : String(p.hours ?? "—");

  const games: Array<any> = Array.isArray(p.games) ? p.games : [];

  return (
    <GlassTooltipShell title={`${monthLabel} • ${totalHours} hrs`}>
      {games.length ? (
        <div className="space-y-1">
          {games.slice(0, 10).map((g: any) => (
            <div
              key={g.game_id}
              className="flex items-center justify-between gap-6"
            >
              <span className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                {g.title}
              </span>
              <span className="text-[11px] font-semibold text-foreground">
                {typeof g.hours === "number" ? g.hours.toFixed(1) : "—"}h •{" "}
                {typeof g.percent === "number" ? g.percent.toFixed(1) : "—"}%
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground">(sem jogos)</div>
      )}
    </GlassTooltipShell>
  );
}

function DonutTooltip(props: any) {
  const { active, payload } = props;
  if (!active || !payload?.length) return null;

  const p = payload?.[0]?.payload;
  if (!p) return null;

  const hours =
    typeof p.hours === "number" ? p.hours.toFixed(1) : String(p.hours ?? "—");
  const percent =
    typeof p.percent === "number"
      ? p.percent.toFixed(1)
      : String(p.percent ?? "—");

  const avgReview =
    p.avg_review != null && Number.isFinite(Number(p.avg_review))
      ? Number(p.avg_review).toFixed(1)
      : "—";

  const avgSess =
    p.avg_session_score != null && Number.isFinite(Number(p.avg_session_score))
      ? Number(p.avg_session_score).toFixed(1)
      : "—";

  const external =
    p.external_rating != null && Number.isFinite(Number(p.external_rating))
      ? Number(p.external_rating).toFixed(1)
      : null;

  return (
    <GlassTooltipShell title={`${p.title} • ${hours}h • ${percent}%`}>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-[11px] text-muted-foreground">
            média review
          </span>
          <span className="text-[11px] font-semibold text-foreground">
            {avgReview}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-[11px] text-muted-foreground">
            média sessões
          </span>
          <span className="text-[11px] font-semibold text-foreground">
            {avgSess}
          </span>
        </div>
        {external != null ? (
          <div className="flex items-center justify-between gap-6">
            <span className="text-[11px] text-muted-foreground">
              nota externa
            </span>
            <span className="text-[11px] font-semibold text-foreground">
              {external}
            </span>
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground">
            (sem nota externa)
          </div>
        )}
      </div>
    </GlassTooltipShell>
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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerGameId, setDrawerGameId] = useState<string | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(true);
  const [bodyOverflow, setBodyOverflow] = useState<"hidden" | "visible">(
    "hidden"
  );
  useEffect(() => {
    setBodyOverflow("hidden");
  }, [filtersOpen]);

  const gameInputRef = useRef<HTMLDivElement | null>(null);
  const gameDropdownRef = useRef<HTMLDivElement | null>(null);
  const [gameRect, setGameRect] = useState<DOMRect | null>(null);

  const [uiPeriod, setUiPeriod] = useState<PeriodPreset>(filters.period);
  const [uiYear, setUiYear] = useState<number | null>(filters.year);
  const [uiMonth, setUiMonth] = useState<number | null>(filters.month);
  const [uiStatusId, setUiStatusId] = useState<string | null>(filters.statusId);
  const [uiGameId, setUiGameId] = useState<string | null>(filters.gameId);
  const [uiGameLabel, setUiGameLabel] = useState<string>("");

  const showGameDropdown =
    !uiGameId && !!gameQuery.trim() && gameOptions.length > 0;

  useEffect(() => {
    const { year, month } = getNowYearMonth();

    if (uiPeriod === "month") {
      setUiYear((prev) => prev ?? year);
      setUiMonth((prev) => prev ?? month);
      return;
    }

    if (uiPeriod === "year") {
      setUiYear((prev) => prev ?? year);
    }
  }, [uiPeriod]);

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
        patch.month = null;
      }

      setFilters(patch);
    }, 240);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiPeriod, uiYear, uiMonth, uiStatusId, uiGameId, gameQuery]);

  useEffect(() => {
    if (!showGameDropdown) return;

    const el = gameInputRef.current;
    if (!el) return;

    const update = () => setGameRect(el.getBoundingClientRect());
    update();

    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showGameDropdown, gameQuery, uiGameId]);

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
  const hoursByMonth = dashboard?.hoursByMonth ?? [];
  const donutMonth = dashboard?.donutMonth ?? null;

  const headerToggle = () => setFiltersOpen((v) => !v);
  const isMsgError = !!error;

  const donutCells = useMemo(() => {
    const list = donutMonth?.games ?? [];
    return list.map((_, idx) => {
      const op = 0.28 + (idx % 8) * 0.08;
      return Math.max(0.22, Math.min(0.9, op));
    });
  }, [donutMonth]);

  const KPI_CARD = cx(
    GLASS_CARD,
    SOFT_RING,
    "p-5 transition",
    "border-emerald-500/15 bg-emerald-500/5 hover:bg-emerald-500/8 hover:border-emerald-500/25"
  );

  const KPI_LABEL =
    "text-[11px] text-muted-foreground inline-flex items-center gap-2";

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
              Agora o foco é: <b>tempo por mês</b> + <b>jogos do mês</b>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className={cx(
                "h-10 rounded-xl",
                "border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/35",
                CLICKABLE
              )}
              onClick={() => refreshAll()}
              disabled={loading}
              title="Recarregar"
            >
              <RefreshCw size={16} className="mr-2 text-emerald-300" />
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

        {/* Filters */}
        <section className={cx(GLASS_CARD, SOFT_RING, "p-0 overflow-visible")}>
          <div
            role="button"
            tabIndex={0}
            onClick={headerToggle}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") headerToggle();
            }}
            className={cx(
              "p-6 select-none",
              "cursor-pointer transition hover:bg-emerald-500/5"
            )}
            title="Clique para recolher/expandir"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Filter size={16} className="opacity-80 text-emerald-300" />
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
                  className={cx(
                    "h-10 rounded-xl",
                    "border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/35",
                    CLICKABLE
                  )}
                  onClick={(e) => {
                    e.stopPropagation();

                    resetFilters();

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

                    {/* Jogo / Busca */}
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
                                className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-background/90 shadow-2xl backdrop-blur-xl"
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
                                      className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left hover:border-emerald-500/20 hover:bg-emerald-500/8"
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
        <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div className={KPI_CARD}>
            <div className={KPI_LABEL}>
              <span className="h-2 w-2 rounded-full bg-emerald-400/80 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
              Ciclos (qtd)
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {kpis ? kpis.cycles : "—"}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              abertos: {kpis ? kpis.openCycles : "—"} • com nota:{" "}
              {kpis ? kpis.ratedCycles : "—"}
            </div>
          </div>

          <div className={KPI_CARD}>
            <div className={KPI_LABEL}>
              <span className="h-2 w-2 rounded-full bg-emerald-400/80 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
              Reviews (média)
            </div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {kpis?.avgFinalRating != null
                ? kpis.avgFinalRating.toFixed(1)
                : "—"}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              reviews escritas: {kpis ? kpis.reviewsWritten : "—"} • média:{" "}
              {kpis?.avgReviewedFinalRating != null
                ? kpis.avgReviewedFinalRating.toFixed(1)
                : "—"}
            </div>
          </div>

          <div className={KPI_CARD}>
            <div className={KPI_LABEL}>
              <span className="h-2 w-2 rounded-full bg-emerald-400/80 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
              Sessões (médias)
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

          <div className={KPI_CARD}>
            <div className={KPI_LABEL}>
              <span className="h-2 w-2 rounded-full bg-emerald-400/80 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
              Tempo total
            </div>
            <div className="mt-1 inline-flex items-center gap-2 text-2xl font-bold text-foreground">
              <Timer size={18} className="opacity-80 text-emerald-300" />
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

        {/* Charts */}
        <section className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          <div className={cx(GLASS_CARD, SOFT_RING, "p-6 lg:col-span-2")}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">
                Horas jogadas por mês (ano)
              </div>
              <div className="text-[11px] text-muted-foreground inline-flex items-center gap-2">
                <BarChart3 size={12} className="opacity-70 text-emerald-300" />
                {loading ? "Carregando…" : "Atualizado"}
              </div>
            </div>

            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={hoursByMonth}
                  margin={{ left: 12, right: 16, top: 6, bottom: 6 }}
                  barCategoryGap={10}
                >
                  <defs>
                    <linearGradient
                      id="barEmeraldGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={EMERALD_400}
                        stopOpacity={0.95}
                      />
                      <stop
                        offset="55%"
                        stopColor={EMERALD_500}
                        stopOpacity={0.75}
                      />
                      <stop
                        offset="100%"
                        stopColor={EMERALD_600}
                        stopOpacity={0.55}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.35}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="label"
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
                    tickFormatter={(v) => `${v}h`}
                  />
                  <Tooltip content={<HoursByMonthTooltip />} />

                  <Bar
                    dataKey="hours"
                    name="horas"
                    fill="url(#barEmeraldGrad)"
                    radius={[10, 10, 10, 10]}
                    isAnimationActive={!loading}
                  >
                    <LabelList
                      dataKey="hours"
                      position="top"
                      formatter={(v: any) =>
                        typeof v === "number" && v > 0 ? `${v.toFixed(1)}h` : ""
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
              Passe o mouse em um mês para ver{" "}
              <b>quais jogos compõem as horas</b> (com %).
            </div>
          </div>

          <div className={cx(GLASS_CARD, SOFT_RING, "p-6")}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">
                Jogos do mês (donut)
              </div>
              <div className="text-[11px] text-muted-foreground inline-flex items-center gap-2">
                <PieIcon size={12} className="opacity-70 text-emerald-300" />
                {donutMonth?.label ?? "—"}
              </div>
            </div>

            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <defs>
                    {(donutMonth?.games ?? []).map((_: any, idx: number) => (
                      <linearGradient
                        key={`grad-${idx}`}
                        id={donutGradId(idx)}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                        gradientTransform={`rotate(${idx * 27})`}
                      >
                        <stop
                          offset="0%"
                          stopColor={EMERALD_400}
                          stopOpacity={0.98}
                        />
                        <stop
                          offset="45%"
                          stopColor={EMERALD_500}
                          stopOpacity={0.82}
                        />
                        <stop
                          offset="100%"
                          stopColor={EMERALD_600}
                          stopOpacity={0.68}
                        />
                      </linearGradient>
                    ))}
                  </defs>

                  <Tooltip content={<DonutTooltip />} />
                  <Pie
                    data={donutMonth?.games ?? []}
                    dataKey="minutes"
                    nameKey="title"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.22}
                  >
                    {(donutMonth?.games ?? []).map((_: any, idx: number) => (
                      <Cell
                        key={`cell-${idx}`}
                        fill={`url(#${donutGradId(idx)})`}
                        fillOpacity={donutCells[idx] ?? 0.45}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 text-[11px] text-muted-foreground">
              Passe o mouse em um jogo para ver: <b>média review</b>,{" "}
              <b>média sessões</b> e <b>nota externa</b>.
            </div>
          </div>
        </section>

        {/* ✅ Feed (AJUSTE: lista 1 coluna, sem grid de 2) */}
        <section className={cx(GLASS_CARD, SOFT_RING, "p-6")}>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">
              Ciclos{" "}
              <span className="text-muted-foreground">
                • {feed.length} itens
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              clique no card → abre histórico do jogo
            </div>
          </div>

          {feed.length ? (
            <div className="space-y-3">
              {feed.map((r) => (
                <button
                  key={r.cycle_id}
                  onClick={() => {
                    setDrawerGameId(r.game_id);
                    setDrawerOpen(true);
                  }}
                  className={cx(
                    "w-full text-left rounded-2xl border border-emerald-500/15 bg-emerald-500/5 shadow-xl backdrop-blur-xl transition",
                    "hover:bg-emerald-500/8 hover:border-emerald-500/25",
                    SOFT_RING
                  )}
                >
                  <div className="flex gap-3 p-4">
                    <div className="h-16 w-24 overflow-hidden rounded-xl border border-emerald-500/15 bg-background/30">
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
                          {r.rating_final != null ? (
                            <div className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-foreground">
                              <Star
                                size={12}
                                className="opacity-80 text-emerald-300"
                              />
                              {Number(r.rating_final).toFixed(1)}
                            </div>
                          ) : (
                            <div className="inline-flex items-center rounded-full border border-emerald-500/15 bg-emerald-500/8 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                              sem nota
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Timer
                            size={12}
                            className="opacity-80 text-emerald-300"
                          />
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
              Nenhum ciclo no recorte atual.
            </div>
          )}

          <div className="mt-5 flex flex-col items-center gap-2">
            <Button
              variant="outline"
              className={cx(
                "h-11 rounded-xl",
                "border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/35",
                CLICKABLE
              )}
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
