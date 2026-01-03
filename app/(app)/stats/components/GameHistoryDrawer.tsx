"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  X,
  RefreshCw,
  Star,
  Timer,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Filter,
  ChevronDown,
  ChevronRight,
  BookText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

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

const GLASS_CARD =
  "rounded-2xl border border-border/50 bg-card/60 shadow-xl backdrop-blur-xl";
const SOFT_RING = "ring-1 ring-border/20";
const CLICKABLE = "cursor-pointer disabled:cursor-not-allowed";

const CHIP =
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold";
const CHIP_VIOLET = "border-violet-500/25 bg-violet-500/10 text-violet-200";
const CHIP_EMERALD = "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
const CHIP_SKY = "border-sky-500/25 bg-sky-500/10 text-sky-200";
const CHIP_MUTED = "border-border/50 bg-card/40 text-muted-foreground";

const SWITCH =
  "relative h-5 w-9 rounded-full border border-border/50 bg-background/60 transition";
const SWITCH_KNOB =
  "absolute top-0.5 h-4 w-4 rounded-full bg-foreground/90 transition";

/* =========================
   Types (views)
========================= */
type GameOverviewRow = {
  game_id: string;
  title: string;
  platform: string | null;
  cover_url: string | null;
  external_url: string | null;

  cycles_count: number;
  cycles_finished: number;
  has_open_cycle: boolean;
  avg_cycle_rating: number | null;

  sessions_finished: number;
  total_minutes_finished: number;
  avg_session_score: number | null;

  latest_cycle_id: string | null;
  latest_cycle_started_at: string | null;
  latest_cycle_ended_at: string | null;
  latest_status_name: string | null;
  latest_cycle_rating: number | null;
};

type CycleRow = {
  cycle_id: string;
  game_id: string;

  status_name: string | null;
  status_id: string;
  started_at: string;
  ended_at: string | null;

  review_text: string | null;
  rating_final: number | null;

  sessions_count_finished: number | null;
  total_minutes_finished: number | null;
  avg_session_minutes_finished: number | null;
  avg_score_finished: number | null;
  last_session_started_at: string | null;

  has_rating: boolean;
  has_review: boolean;
};

type SessionRow = {
  session_id: string;
  cycle_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  score: number | null;
  note_text: string | null;
};

type ExternalRatingRow = {
  id: string;
  source: string;
  score_0_10: number;
  url: string | null;
  retrieved_at: string;
};

/* =========================
   Component
========================= */
export function GameHistoryDrawer(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  gameId: string | null;
  initialCycleId?: string | null;
}) {
  const { open, onOpenChange, gameId, initialCycleId } = props;
  const reduceMotion = useReducedMotion();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [overview, setOverview] = useState<GameOverviewRow | null>(null);
  const [cycles, setCycles] = useState<CycleRow[]>([]);
  const [external, setExternal] = useState<ExternalRatingRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);

  // filtros do drawer (ciclos)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyClosed, setOnlyClosed] = useState(false);
  const [onlyRated, setOnlyRated] = useState(false);
  const [onlyWithReview, setOnlyWithReview] = useState(false);

  function setToggle(setter: (v: boolean) => void) {
    setter(true);
    // garante lógica simples: open/closed mutuamente exclusivos
  }

  async function loadAll(forGameId: string) {
    setLoading(true);
    setMsg(null);
    setOverview(null);
    setCycles([]);
    setExternal([]);
    setSessions([]);
    setSelectedCycleId(null);

    try {
      const [ov, cy, ex] = await Promise.all([
        supabase
          .schema("kesslerlog")
          .from("vw_game_overview")
          .select("*")
          .eq("game_id", forGameId)
          .single(),
        supabase
          .schema("kesslerlog")
          .from("vw_cycles_enriched")
          .select(
            "cycle_id,game_id,status_id,status_name,started_at,ended_at,review_text,rating_final,sessions_count_finished,total_minutes_finished,avg_session_minutes_finished,avg_score_finished,last_session_started_at,has_rating,has_review"
          )
          .eq("game_id", forGameId)
          .order("started_at", { ascending: false })
          .limit(120),
        supabase
          .schema("kesslerlog")
          .from("vw_external_ratings_norm")
          .select("id,source,score_0_10,url,retrieved_at")
          .eq("game_id", forGameId)
          .order("score_0_10", { ascending: false })
          .limit(20),
      ]);

      if (ov.error) throw ov.error;
      if (cy.error) throw cy.error;
      if (ex.error) throw ex.error;

      setOverview(ov.data as any);
      setCycles((cy.data ?? []) as any);
      setExternal((ex.data ?? []) as any);

      const pick =
        initialCycleId ??
        (ov.data?.latest_cycle_id as string | null) ??
        (cy.data?.[0] as any)?.cycle_id ??
        null;

      if (pick) {
        await loadSessions(pick);
      }
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao carregar histórico do jogo");
    } finally {
      setLoading(false);
    }
  }

  async function loadSessions(cycleId: string) {
    setSelectedCycleId(cycleId);
    setSessions([]);

    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("vw_sessions_enriched")
      .select(
        "session_id,cycle_id,started_at,ended_at,duration_minutes,score,note_text"
      )
      .eq("cycle_id", cycleId)
      .order("started_at", { ascending: false });

    if (error) throw error;
    setSessions((data ?? []) as any);
  }

  useEffect(() => {
    if (open && gameId) {
      loadAll(gameId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gameId]);

  // regras simples open/closed
  useEffect(() => {
    if (onlyOpen && onlyClosed) setOnlyClosed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyOpen]);
  useEffect(() => {
    if (onlyClosed && onlyOpen) setOnlyOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyClosed]);

  const filteredCycles = useMemo(() => {
    return cycles.filter((c) => {
      const isOpen = !c.ended_at;
      if (onlyOpen && !isOpen) return false;
      if (onlyClosed && isOpen) return false;
      if (onlyRated && !c.has_rating) return false;
      if (onlyWithReview && !c.has_review) return false;
      return true;
    });
  }, [cycles, onlyOpen, onlyClosed, onlyRated, onlyWithReview]);

  const selectedCycle = useMemo(
    () => filteredCycles.find((c) => c.cycle_id === selectedCycleId) ?? null,
    [filteredCycles, selectedCycleId]
  );

  const isMsgError =
    !!msg &&
    (msg.toLowerCase().includes("erro") ||
      msg.toLowerCase().includes("falh") ||
      msg.toLowerCase().includes("exception"));

  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />

          {/* Drawer */}
          <motion.aside
            className="fixed right-0 top-0 z-50 h-full w-full max-w-[980px] overflow-hidden border-l border-border/50 bg-background/70 shadow-2xl backdrop-blur-xl"
            initial={reduceMotion ? { opacity: 1 } : { x: 36, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { x: 36, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {overview?.title ?? "Carregando…"}
                    </div>
                    {overview?.platform ? (
                      <span className={cx(CHIP, CHIP_MUTED)}>
                        {overview.platform}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {loading
                      ? "Carregando…"
                      : "Histórico do jogo (ciclos → sessões)"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className={cx("h-10 rounded-xl", CLICKABLE)}
                    onClick={() => gameId && loadAll(gameId)}
                    disabled={loading || !gameId}
                    title="Recarregar"
                  >
                    <RefreshCw size={16} className="mr-2" />
                    Recarregar
                  </Button>

                  <Button
                    variant="outline"
                    className={cx("h-10 rounded-xl", CLICKABLE)}
                    onClick={() => onOpenChange(false)}
                  >
                    <X size={16} className="mr-2" />
                    Fechar
                  </Button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-auto p-5">
                {/* msg */}
                {msg ? (
                  <div
                    className={cx(
                      GLASS_CARD,
                      SOFT_RING,
                      "mb-4 p-4",
                      isMsgError
                        ? "border-destructive/40"
                        : "border-emerald-500/25"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {isMsgError ? (
                        <AlertTriangle className="mt-0.5" size={16} />
                      ) : (
                        <CheckCircle2 className="mt-0.5" size={16} />
                      )}
                      <div className="text-sm text-muted-foreground">{msg}</div>
                    </div>
                  </div>
                ) : null}

                {/* Top: cover + KPIs + external */}
                <div className="grid gap-4 grid-cols-1 lg:grid-cols-[260px,1fr]">
                  <div className={cx(GLASS_CARD, SOFT_RING, "overflow-hidden")}>
                    <div className="aspect-[16/10] w-full overflow-hidden border-b border-border/50 bg-background/30">
                      {overview?.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={overview.cover_url}
                          alt={overview.title ?? "cover"}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <BookText size={20} />
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      {overview?.external_url ? (
                        <a
                          href={overview.external_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:text-emerald-200"
                        >
                          abrir fonte <ExternalLink size={12} />
                        </a>
                      ) : (
                        <div className="text-xs text-muted-foreground/70">
                          sem fonte externa
                        </div>
                      )}

                      <div className="mt-3 grid gap-2">
                        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                          <span className="text-[11px] text-muted-foreground">
                            média ciclos
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {overview?.avg_cycle_rating != null
                              ? Number(overview.avg_cycle_rating).toFixed(1)
                              : "—"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                          <span className="text-[11px] text-muted-foreground">
                            tempo total
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {overview
                              ? `${overview.total_minutes_finished} min`
                              : "—"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                          <span className="text-[11px] text-muted-foreground">
                            sessões
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {overview?.sessions_finished ?? "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* external ratings */}
                    <div className={cx(GLASS_CARD, SOFT_RING, "p-4")}>
                      <div className="mb-2 text-sm font-semibold text-foreground">
                        Notas externas (0–10)
                      </div>

                      {external.length ? (
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {external.map((r) => (
                            <div
                              key={r.id}
                              className="rounded-xl border border-border/50 bg-card/40 px-3 py-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-semibold text-foreground truncate">
                                  {r.source}
                                </div>
                                <div className="inline-flex items-center gap-1 text-xs font-bold text-foreground">
                                  <Star size={12} className="opacity-80" />
                                  {Number(r.score_0_10).toFixed(2)}
                                </div>
                              </div>

                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {formatDateShort(r.retrieved_at)}
                              </div>

                              {r.url ? (
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-200"
                                >
                                  link <ExternalLink size={12} />
                                </a>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Sem notas externas ainda.
                        </div>
                      )}
                    </div>

                    {/* selected cycle highlight */}
                    <div className={cx(GLASS_CARD, SOFT_RING, "p-4")}>
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-semibold text-foreground">
                          Ciclo selecionado
                        </div>
                        {selectedCycle?.last_session_started_at ? (
                          <div className="text-[11px] text-muted-foreground">
                            última sessão:{" "}
                            {timeAgoShort(
                              selectedCycle.last_session_started_at
                            )}
                          </div>
                        ) : null}
                      </div>

                      {selectedCycle ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                            <div className="text-[11px] text-muted-foreground">
                              status
                            </div>
                            <div className="mt-1 text-sm font-semibold text-foreground">
                              {selectedCycle.status_name ?? "—"}
                            </div>
                          </div>

                          <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                            <div className="text-[11px] text-muted-foreground">
                              nota final
                            </div>
                            <div className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                              <Star size={14} className="opacity-80" />
                              {selectedCycle.rating_final != null
                                ? Number(selectedCycle.rating_final).toFixed(1)
                                : "—"}
                            </div>
                          </div>

                          <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                            <div className="text-[11px] text-muted-foreground">
                              tempo
                            </div>
                            <div className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                              <Timer size={14} className="opacity-80" />
                              {selectedCycle.total_minutes_finished ?? 0} min
                            </div>
                          </div>

                          <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                            <div className="text-[11px] text-muted-foreground">
                              média sessões
                            </div>
                            <div className="mt-1 text-sm font-semibold text-foreground">
                              {selectedCycle.avg_score_finished != null
                                ? Number(
                                    selectedCycle.avg_score_finished
                                  ).toFixed(1)
                                : "—"}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Selecione um ciclo na lista ao lado.
                        </div>
                      )}

                      {selectedCycle?.review_text?.trim() ? (
                        <div className="mt-3 rounded-xl border border-border/50 bg-card/40 p-3">
                          <div className="text-[11px] font-semibold text-foreground">
                            Review do ciclo
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {selectedCycle.review_text.trim()}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Bottom: cycles + sessions */}
                <div className="mt-4 grid gap-4 grid-cols-1 xl:grid-cols-2">
                  {/* cycles */}
                  <div className={cx(GLASS_CARD, SOFT_RING, "p-4")}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-semibold text-foreground">
                        Ciclos ({filteredCycles.length})
                      </div>

                      <button
                        className="inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={() => setFiltersOpen((v) => !v)}
                      >
                        <Filter size={14} />
                        filtros
                        <ChevronDown
                          size={14}
                          className={cx(
                            "transition",
                            filtersOpen && "rotate-180"
                          )}
                        />
                      </button>
                    </div>

                    {/* filtros colapsáveis */}
                    <AnimatePresence>
                      {filtersOpen ? (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mb-3 grid gap-2 sm:grid-cols-2">
                            <label className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                              <span className="text-xs text-muted-foreground">
                                somente abertos
                              </span>
                              <button
                                onClick={() => {
                                  setOnlyOpen((v) => !v);
                                  if (!onlyOpen) setOnlyClosed(false);
                                }}
                                className={cx(
                                  SWITCH,
                                  onlyOpen && "bg-emerald-500/25"
                                )}
                                type="button"
                              >
                                <span
                                  className={cx(
                                    SWITCH_KNOB,
                                    onlyOpen ? "left-[18px]" : "left-[2px]"
                                  )}
                                />
                              </button>
                            </label>

                            <label className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                              <span className="text-xs text-muted-foreground">
                                somente encerrados
                              </span>
                              <button
                                onClick={() => {
                                  setOnlyClosed((v) => !v);
                                  if (!onlyClosed) setOnlyOpen(false);
                                }}
                                className={cx(
                                  SWITCH,
                                  onlyClosed && "bg-violet-500/25"
                                )}
                                type="button"
                              >
                                <span
                                  className={cx(
                                    SWITCH_KNOB,
                                    onlyClosed ? "left-[18px]" : "left-[2px]"
                                  )}
                                />
                              </button>
                            </label>

                            <label className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                              <span className="text-xs text-muted-foreground">
                                somente com nota
                              </span>
                              <button
                                onClick={() => setOnlyRated((v) => !v)}
                                className={cx(
                                  SWITCH,
                                  onlyRated && "bg-sky-500/25"
                                )}
                                type="button"
                              >
                                <span
                                  className={cx(
                                    SWITCH_KNOB,
                                    onlyRated ? "left-[18px]" : "left-[2px]"
                                  )}
                                />
                              </button>
                            </label>

                            <label className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                              <span className="text-xs text-muted-foreground">
                                somente com review
                              </span>
                              <button
                                onClick={() => setOnlyWithReview((v) => !v)}
                                className={cx(
                                  SWITCH,
                                  onlyWithReview && "bg-emerald-500/25"
                                )}
                                type="button"
                              >
                                <span
                                  className={cx(
                                    SWITCH_KNOB,
                                    onlyWithReview
                                      ? "left-[18px]"
                                      : "left-[2px]"
                                  )}
                                />
                              </button>
                            </label>
                          </div>

                          <div className="mb-3 flex justify-end">
                            <Button
                              variant="outline"
                              className={cx("h-10 rounded-xl", CLICKABLE)}
                              onClick={() => {
                                setOnlyOpen(false);
                                setOnlyClosed(false);
                                setOnlyRated(false);
                                setOnlyWithReview(false);
                              }}
                            >
                              limpar filtros
                            </Button>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>

                    <div className="space-y-2">
                      {filteredCycles.length ? (
                        filteredCycles.map((c) => {
                          const active = c.cycle_id === selectedCycleId;
                          const ended = !!c.ended_at;
                          const hasRating = c.has_rating;
                          const hasReview = c.has_review;

                          return (
                            <button
                              key={c.cycle_id}
                              onClick={() => loadSessions(c.cycle_id)}
                              className={cx(
                                "w-full rounded-2xl border px-3 py-2 text-left transition",
                                active
                                  ? "border-violet-500/40 bg-violet-500/10"
                                  : "border-border/50 bg-card/40 hover:bg-card/50"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-xs font-semibold text-foreground">
                                    {c.status_name ?? "status"}
                                  </div>
                                  <div className="mt-1 text-[11px] text-muted-foreground">
                                    {formatDateShort(c.started_at)}
                                    {ended
                                      ? ` → ${formatDateShort(c.ended_at)}`
                                      : " • aberto"}
                                    {" • "}
                                    {c.total_minutes_finished ?? 0} min
                                  </div>

                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <span
                                      className={cx(
                                        CHIP,
                                        ended ? CHIP_MUTED : CHIP_EMERALD
                                      )}
                                    >
                                      {ended ? "encerrado" : "aberto"}
                                    </span>
                                    {hasRating ? (
                                      <span className={cx(CHIP, CHIP_SKY)}>
                                        <Star
                                          size={12}
                                          className="mr-1 opacity-80"
                                        />
                                        {c.rating_final != null
                                          ? Number(c.rating_final).toFixed(1)
                                          : "—"}
                                      </span>
                                    ) : (
                                      <span className={cx(CHIP, CHIP_MUTED)}>
                                        sem nota
                                      </span>
                                    )}
                                    {hasReview ? (
                                      <span className={cx(CHIP, CHIP_VIOLET)}>
                                        review
                                      </span>
                                    ) : (
                                      <span className={cx(CHIP, CHIP_MUTED)}>
                                        sem review
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <ChevronRight
                                  size={18}
                                  className={cx(
                                    "mt-0.5 shrink-0 text-muted-foreground transition",
                                    active && "text-violet-200"
                                  )}
                                />
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Nenhum ciclo com esses filtros.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* sessions */}
                  <div className={cx(GLASS_CARD, SOFT_RING, "p-4")}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-sm font-semibold text-foreground">
                        Sessões do ciclo
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {selectedCycleId
                          ? `${sessions.length} itens`
                          : "selecione um ciclo"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {sessions.length ? (
                        sessions.map((s) => (
                          <div
                            key={s.session_id}
                            className="rounded-2xl border border-border/50 bg-card/40 px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-foreground">
                                {formatDateShort(s.started_at)}
                              </div>

                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <Timer size={12} className="opacity-80" />
                                  {s.duration_minutes != null
                                    ? `${s.duration_minutes} min`
                                    : "—"}
                                </span>

                                <span className="opacity-50">•</span>

                                <span className="inline-flex items-center gap-1">
                                  <Star size={12} className="opacity-80" />
                                  {s.score != null
                                    ? Number(s.score).toFixed(1)
                                    : "—"}
                                </span>
                              </div>
                            </div>

                            {s.note_text?.trim() ? (
                              <div className="mt-1 text-xs text-muted-foreground line-clamp-3">
                                {s.note_text.trim()}
                              </div>
                            ) : (
                              <div className="mt-1 text-xs text-muted-foreground/70">
                                (sem anotação)
                              </div>
                            )}

                            <div className="mt-1 text-[11px] text-muted-foreground/80">
                              {s.ended_at ? "encerrada" : "em andamento"} •{" "}
                              {timeAgoShort(s.ended_at ?? s.started_at)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          {selectedCycleId
                            ? "Sem sessões ainda."
                            : "Selecione um ciclo."}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
