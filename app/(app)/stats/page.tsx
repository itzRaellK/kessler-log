"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
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

import { useStatsDashboard } from "./components/useStatsDashboard";
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
   Chart helpers (melhor visual)
========================= */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function movingAverage<T extends Record<string, any>>(
  arr: T[],
  key: keyof T,
  outKey: string,
  windowSize = 3
) {
  const w = Math.max(1, windowSize);
  return arr.map((row, i) => {
    const from = Math.max(0, i - Math.floor(w / 2));
    const to = Math.min(arr.length - 1, i + Math.floor(w / 2));
    let sum = 0;
    let count = 0;
    for (let j = from; j <= to; j++) {
      const v = Number(arr[j][key]);
      if (Number.isFinite(v)) {
        sum += v;
        count++;
      }
    }
    return { ...row, [outKey]: count ? sum / count : Number(row[key]) };
  });
}

function GlassTooltip(props: any) {
  const { active, payload, label } = props;
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-border/50 bg-background/80 p-3 shadow-2xl backdrop-blur-xl">
      <div className="text-[11px] font-semibold text-foreground">{label}</div>
      <div className="mt-2 space-y-1">
        {payload.map((p: any) => (
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

  // filtros colapsáveis (clique no header inteiro)
  const [filtersOpen, setFiltersOpen] = useState(true);

  // UI state (auto-apply)
  const [uiQ, setUiQ] = useState(filters.q);
  const [uiYear, setUiYear] = useState<number | null>(filters.year);
  const [uiMonth, setUiMonth] = useState<number | null>(filters.month);
  const [uiStatusId, setUiStatusId] = useState<string | null>(filters.statusId);
  const [uiGameId, setUiGameId] = useState<string | null>(filters.gameId);
  const [uiGameLabel, setUiGameLabel] = useState<string>("");

  // sync UI quando filtros mudarem por fora
  useEffect(() => {
    setUiQ(filters.q);
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
    filters.q,
    filters.year,
    filters.month,
    filters.statusId,
    filters.gameId,
  ]);

  // AUTO APPLY (debounce leve)
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters({
        q: uiQ,
        year: uiYear,
        month: uiMonth,
        statusId: uiStatusId,
        gameId: uiGameId,
      });
    }, 240);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiQ, uiYear, uiMonth, uiStatusId, uiGameId]);

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

  const kpis = dashboard?.kpis ?? null;

  // data
  const ratingTrendRaw = dashboard?.ratingTrend ?? [];
  const statusBreakdown = dashboard?.statusBreakdown ?? [];
  const ratingHistogram = dashboard?.ratingHistogram ?? [];

  // trend “bonito”
  const ratingTrend = useMemo(() => {
    const base = movingAverage(ratingTrendRaw as any[], "value", "smooth", 3);
    return base.map((d: any) => ({
      ...d,
      value: clamp(Number(d.value ?? 0), 0, 10),
      smooth: clamp(Number(d.smooth ?? 0), 0, 10),
      count: Number(d.count ?? 0),
    }));
  }, [ratingTrendRaw]);

  const showBrush = ratingTrend.length > 18;

  const isMsgError = !!error;

  const headerToggle = () => setFiltersOpen((v) => !v);

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
              Filtros auto → gráficos melhores → clique em um jogo para abrir
              histórico.
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
        <section className={cx(GLASS_CARD, SOFT_RING, "p-0 overflow-hidden")}>
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
                  {filters.gameId ? (
                    <span className={CHIP}>jogo: {appliedGameLabel}</span>
                  ) : null}
                  {filters.year ? (
                    <span className={CHIP}>ano: {filters.year}</span>
                  ) : null}
                  {filters.month ? (
                    <span className={CHIP}>mês: {selectedMonthLabel}</span>
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
                className="overflow-hidden border-t border-border/50"
              >
                <div className="p-6">
                  <div className="grid gap-3 grid-cols-1 lg:grid-cols-12">
                    {/* Jogo (combobox) */}
                    <div className="lg:col-span-5">
                      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
                        Jogo (buscar e selecionar)
                      </div>

                      <div className="relative">
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
                              placeholder="Digite o nome do jogo…"
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

                        {/* dropdown */}
                        {!uiGameId && gameQuery.trim() && gameOptions.length ? (
                          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-border/50 bg-background/80 shadow-2xl backdrop-blur-xl">
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
                          </div>
                        ) : null}
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
                          (deixe vazio para “todos os jogos”)
                        </div>
                      )}
                    </div>

                    {/* Ano */}
                    <div className="lg:col-span-2">
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
                        <option value={0}>Todos</option>
                        {yearOptions.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Mês */}
                    <div className="lg:col-span-2">
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
                    </div>

                    {/* Status */}
                    <div className="lg:col-span-3">
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

                    {/* Busca por título */}
                    <div className="lg:col-span-12">
                      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
                        Busca (título do jogo)
                      </div>
                      <div className={INPUT_WRAP}>
                        <div className={INPUT_BASE}>
                          <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          />
                          <input
                            className={cx(INPUT_EL, "pl-9 pr-3")}
                            value={uiQ}
                            onChange={(e) => setUiQ(e.target.value)}
                            placeholder="Ex: resident, souls, mario…"
                          />
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] text-muted-foreground/80">
                        aplica automaticamente (debounce leve).
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>

        {/* KPI cards */}
        <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <div className={cx(GLASS_CARD, SOFT_RING, "p-5")}>
            <div className="text-[11px] text-muted-foreground">Ciclos</div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {kpis ? kpis.cycles : "—"}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              com nota: {kpis ? kpis.ratedCycles : "—"}
            </div>
          </div>

          <div className={cx(GLASS_CARD, SOFT_RING, "p-5")}>
            <div className="text-[11px] text-muted-foreground">
              Média (ciclos)
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-2xl font-bold text-foreground">
              <Star size={18} className="opacity-80" />
              {kpis?.avgCycleRating != null
                ? kpis.avgCycleRating.toFixed(1)
                : "—"}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              filtrado pelo topo
            </div>
          </div>

          <div className={cx(GLASS_CARD, SOFT_RING, "p-5")}>
            <div className="text-[11px] text-muted-foreground">Tempo total</div>
            <div className="mt-1 inline-flex items-center gap-2 text-2xl font-bold text-foreground">
              <Timer size={18} className="opacity-80" />
              {kpis ? `${kpis.totalMinutes} min` : "—"}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              sessões finalizadas
            </div>
          </div>

          <div className={cx(GLASS_CARD, SOFT_RING, "p-5")}>
            <div className="text-[11px] text-muted-foreground">Sessões</div>
            <div className="mt-1 text-2xl font-bold text-foreground">
              {kpis ? kpis.finishedSessions : "—"}
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              somente encerradas
            </div>
          </div>
        </section>

        {/* Charts (bonitos) */}
        <section className="grid gap-4 grid-cols-1 lg:grid-cols-3">
          {/* Trend — Area + smooth + Brush */}
          <div className={cx(GLASS_CARD, SOFT_RING, "p-6 lg:col-span-2")}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">
                Tendência de notas (média por período)
              </div>
              <div className="text-[11px] text-muted-foreground inline-flex items-center gap-2">
                <BarChart3 size={12} className="opacity-70" />
                {loading ? "Carregando…" : "Atualizado"}
              </div>
            </div>

            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={ratingTrend}
                  margin={{ left: 8, right: 16, top: 6, bottom: 6 }}
                >
                  <defs>
                    <linearGradient
                      id="gradPrimary"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.06}
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
                    tickMargin={10}
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

                  <Tooltip content={<GlassTooltip />} />

                  {kpis?.avgCycleRating != null ? (
                    <ReferenceLine
                      y={kpis.avgCycleRating}
                      stroke="hsl(var(--muted-foreground))"
                      strokeOpacity={0.45}
                      strokeDasharray="6 6"
                    />
                  ) : null}

                  <Area
                    type="monotone"
                    dataKey="value"
                    name="média"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#gradPrimary)"
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={!loading}
                  />

                  <Line
                    type="monotone"
                    dataKey="smooth"
                    name="suavizado"
                    stroke="hsl(var(--foreground))"
                    strokeOpacity={0.35}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={!loading}
                  />

                  {showBrush ? (
                    <Brush
                      dataKey="label"
                      height={26}
                      stroke="hsl(var(--primary))"
                      travellerWidth={10}
                    />
                  ) : null}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 text-[11px] text-muted-foreground">
              dica: se filtrar por <b>mês</b>, vira “por dia”. E com muitos
              pontos, o <b>Brush</b> ajuda a dar zoom.
            </div>
          </div>

          {/* Status breakdown — barras horizontais + labels */}
          <div className={cx(GLASS_CARD, SOFT_RING, "p-6")}>
            <div className="mb-3 text-sm font-semibold text-foreground">
              Status (qtd de ciclos no recorte)
            </div>

            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statusBreakdown.slice(0, 8)}
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
                    dataKey="status"
                    width={120}
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
                    dataKey="total"
                    name="ciclos"
                    fill="hsl(var(--primary))"
                    radius={[10, 10, 10, 10]}
                    isAnimationActive={!loading}
                  >
                    <LabelList
                      dataKey="total"
                      position="right"
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
              mostrando top 8 (ordenado).
            </div>
          </div>

          {/* Histogram — barras arredondadas + tooltip glass */}
          <div className={cx(GLASS_CARD, SOFT_RING, "p-6 lg:col-span-3")}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">
                Distribuição das suas notas (0–10)
              </div>
              <div className="text-[11px] text-muted-foreground">
                bucket = inteiro (7.x entra em 7)
              </div>
            </div>

            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={ratingHistogram}
                  margin={{ left: 8, right: 16, top: 6, bottom: 6 }}
                  barCategoryGap={10}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.35}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="bucket"
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
                  />
                  <Tooltip content={<GlassTooltip />} />
                  <Bar
                    dataKey="total"
                    name="qtd"
                    fill="hsl(var(--primary))"
                    radius={[10, 10, 0, 0]}
                    barSize={22}
                    isAnimationActive={!loading}
                  />
                </BarChart>
              </ResponsiveContainer>
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

          {/* Pagination */}
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
            <div className="text-[11px] text-muted-foreground">
              {loading ? "Carregando…" : "Ok"}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
