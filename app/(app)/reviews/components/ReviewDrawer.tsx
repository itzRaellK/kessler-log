"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  X,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Star,
  RefreshCw,
  Check,
  Gamepad2,
  Clock,
  History,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

/* =========================
   Utils
========================= */

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function normalizeText(input: string) {
  return (input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseScoreInput(v: string | number | null | undefined) {
  if (v == null) return null;
  const raw = String(v).trim();
  if (!raw) return null;
  const norm = raw.replace(",", ".");
  const n = Number(norm);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.max(0, Math.min(10, n));
  return Math.round(clamped * 10) / 10;
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function minutesBetween(startIso: string, endIso: string | null) {
  if (!endIso) return null;
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 60000);
}

const MONTHS_PT = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function cycleMonthKey(iso: string | null | undefined) {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "unknown";
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function cycleMonthLabel(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const m = MONTHS_PT[d.getMonth()] ?? "—";
  return `${m}/${d.getFullYear()}`;
}

/* =========================
   Styles (DNA)
========================= */

const GLASS_CARD =
  "rounded-2xl border border-border/50 bg-card/60 shadow-xl backdrop-blur-xl";
const SOFT_RING = "ring-1 ring-border/20";

const BTN_GREEN =
  "cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300 shadow-sm dark:text-emerald-950";

const CLICKABLE = "cursor-pointer disabled:cursor-not-allowed";

const INPUT_BASE =
  "relative h-11 w-full rounded-xl border border-border/70 bg-background/90 ring-1 ring-border/20 shadow-sm transition-all dark:border-border/50 dark:bg-background/70 dark:shadow-none";
const INPUT_EL =
  "h-11 w-full bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground";

const TEXTAREA_BASE =
  "relative w-full rounded-2xl border border-border/60 bg-background/85 ring-1 ring-border/20 shadow-sm transition-all dark:border-border/50 dark:bg-background/70 dark:shadow-none";

// Badges (emerald)
const BADGE_BASE =
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold";
const BADGE_EMERALD = cx(
  BADGE_BASE,
  "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
);
const BADGE_EMERALD_SOFT = cx(
  BADGE_BASE,
  "border-emerald-500/20 bg-emerald-500/5 text-emerald-100/80"
);
const BADGE_MUTED = cx(
  BADGE_BASE,
  "border-border/50 bg-card/40 text-muted-foreground"
);
const BADGE_UPPER = "uppercase tracking-wide";

/* =========================
   Types
========================= */

export type StatusRow = {
  id: string;
  name: string;
  slug: string | null;
  is_active?: boolean | null;
};

export type GameRow = {
  id: string;
  title: string;
  platform: string | null;
  cover_url: string | null;
  external_url: string | null;
};

type CycleRow = {
  id: string;
  game_id: string;
  status_id: string;
  started_at: string;
  ended_at: string | null;
  review_text: string | null;
  rating_final: number | null;
  status?: StatusRow | null;
};

type PlaySessionRowAgg = {
  id: string;
  cycle_id: string;
  score: number | null;
};

type TimelineSessionRow = {
  id: string;
  cycle_id: string;
  started_at: string;
  ended_at: string | null;
  note_text: string | null;
  score: number | null;
};

type ExternalRatingRow = {
  id: string;
  user_id: string;
  game_id: string;
  source: string;
  score: number;
  scale_max: number;
  url: string | null;
  retrieved_at: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;

  userId: string | null;

  games: GameRow[];
  statuses: StatusRow[];

  initialGameId?: string | null;

  onMutated?: () => Promise<void> | void;
};

/* =========================
   Tabs (estilo CycleSessionDrawer)
========================= */

type TabKey = "review" | "timeline" | "history";

function TabButton({
  active,
  disabled,
  onClick,
  children,
  title,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        CLICKABLE,
        "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-card/40",
        disabled ? "opacity-50 hover:bg-transparent" : ""
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

/* =========================
   Component
========================= */

export function ReviewDrawer({
  open,
  onOpenChange,
  userId,
  games,
  statuses,
  initialGameId,
  onMutated,
}: Props) {
  const reduceMotion = useReducedMotion();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [selectedGameId, setSelectedGameId] = useState<string | null>(
    initialGameId ?? null
  );

  const selectedGame = useMemo(
    () => games.find((g) => g.id === selectedGameId) ?? null,
    [games, selectedGameId]
  );

  // tabs (agora ficam ABAIXO do header, dentro do content)
  const [tab, setTab] = useState<TabKey>("review");

  // cycles
  const [cycles, setCycles] = useState<CycleRow[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const selectedCycle = useMemo(
    () => cycles.find((c) => c.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId]
  );

  // sessions aggregation (avg score per cycle)
  const [sessionsAggByCycle, setSessionsAggByCycle] = useState<
    Record<string, { avg: number | null; count: number }>
  >({});

  // external ratings (per game)
  const [externalRatings, setExternalRatings] = useState<ExternalRatingRow[]>(
    []
  );
  const [showExternalAll, setShowExternalAll] = useState(false);

  function externalTo10(er: Pick<ExternalRatingRow, "score" | "scale_max">) {
    const s = Number(er.score);
    const max = Number(er.scale_max);
    if (!Number.isFinite(s) || !Number.isFinite(max) || max <= 0) return null;
    const n = (s / max) * 10;
    if (!Number.isFinite(n)) return null;
    const clamped = Math.max(0, Math.min(10, n));
    return Math.round(clamped * 10) / 10;
  }

  // review drafts
  const [reviewDraft, setReviewDraft] = useState("");
  const [ratingDraft, setRatingDraft] = useState("");

  // status to apply on finish
  const [finishAlso, setFinishAlso] = useState(true);
  const [finishStatusId, setFinishStatusId] = useState<string | null>(null);

  // guard: open session exists?
  const [hasOpenSession, setHasOpenSession] = useState(false);

  // timeline (accordion por ciclo)
  const [timelineOpenId, setTimelineOpenId] = useState<string | null>(null);
  const [timelineSessionsByCycle, setTimelineSessionsByCycle] = useState<
    Record<string, TimelineSessionRow[]>
  >({});
  const [timelineLoadingByCycle, setTimelineLoadingByCycle] = useState<
    Record<string, boolean>
  >({});

  function close() {
    onOpenChange(false);
  }

  // lock scroll + ESC
  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // init when open
  useEffect(() => {
    if (!open) return;

    setMsg(null);
    setLoading(false);
    setTab("review");

    if (initialGameId) {
      setSelectedGameId(initialGameId);
      return;
    }
    if (!selectedGameId && games?.length) {
      setSelectedGameId(games[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function requireUserId() {
    if (userId) return userId;
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const uid = data.user?.id ?? null;
    if (!uid) throw new Error("Você precisa estar logado. Vá para /login.");
    return uid;
  }

  const activeStatuses = useMemo(
    () => (statuses ?? []).filter((s) => s.is_active ?? true),
    [statuses]
  );
  const statusList = (activeStatuses.length ? activeStatuses : statuses) ?? [];

  const cycleLabelById = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cycles) {
      const key = cycleMonthKey(c.started_at);
      counts[key] = (counts[key] ?? 0) + 1;
    }

    const seen: Record<string, number> = {};
    const map: Record<string, string> = {};
    for (const c of cycles) {
      const key = cycleMonthKey(c.started_at);
      seen[key] = (seen[key] ?? 0) + 1;

      const base = cycleMonthLabel(c.started_at);
      const needsDisambiguation = (counts[key] ?? 0) > 1;
      const suffix = needsDisambiguation
        ? ` • ${seen[key]}/${counts[key]}`
        : "";

      map[c.id] = `${base}${suffix}${c.ended_at ? " • encerrado" : ""}`;
    }
    return map;
  }, [cycles]);

  function guessFinishedStatusId() {
    const candidates = [
      "zerado",
      "finalizado",
      "concluido",
      "concluído",
      "finished",
      "done",
      "completed",
    ];
    const map = new Map(
      (statusList ?? []).map((s) => [normalizeText(s.slug ?? ""), s.id])
    );
    for (const c of candidates) {
      const id = map.get(normalizeText(c));
      if (id) return id;
    }
    return null;
  }

  async function loadCyclesAndHistory(gameId: string) {
    setLoading(true);
    setMsg(null);

    try {
      // cycles
      const { data, error } = await supabase
        .schema("kesslerlog")
        .from("game_cycles")
        .select(
          `
          id, game_id, status_id, started_at, ended_at, review_text, rating_final,
          status:game_statuses(id,name,slug,is_active)
        `
        )
        .eq("game_id", gameId)
        .order("started_at", { ascending: false })
        .limit(80);

      if (error) throw error;

      const list = (data ?? []) as any as CycleRow[];
      setCycles(list);

      const newestId = list[0]?.id ?? null;
      const nextCycleId =
        selectedCycleId && list.some((c) => c.id === selectedCycleId)
          ? selectedCycleId
          : newestId;

      setSelectedCycleId(nextCycleId);

      const cy = list.find((c) => c.id === nextCycleId) ?? null;
      setReviewDraft(cy?.review_text ?? "");
      setRatingDraft(
        cy?.rating_final != null ? String(Number(cy.rating_final)) : ""
      );

      // defaults
      setFinishAlso(true);
      setFinishStatusId(guessFinishedStatusId());

      // reset externals expanded
      setShowExternalAll(false);

      // timeline defaults
      setTimelineOpenId((prev) => prev ?? nextCycleId ?? null);

      // open session guard for selected cycle
      if (nextCycleId) {
        const { data: os, error: e2 } = await supabase
          .schema("kesslerlog")
          .from("play_sessions")
          .select("id")
          .eq("cycle_id", nextCycleId)
          .is("ended_at", null)
          .limit(1);

        if (e2) throw e2;
        setHasOpenSession(!!(os ?? [])?.length);
      } else {
        setHasOpenSession(false);
      }

      // history: sessions avg per cycle
      const cycleIds = list.map((c) => c.id).filter(Boolean);
      if (cycleIds.length) {
        const { data: sess, error: e3 } = await supabase
          .schema("kesslerlog")
          .from("play_sessions")
          .select("id,cycle_id,score")
          .in("cycle_id", cycleIds)
          .not("score", "is", null)
          .limit(1500);

        if (e3) throw e3;

        const agg: Record<string, { sum: number; count: number }> = {};
        for (const r of (sess ?? []) as any as PlaySessionRowAgg[]) {
          if (!r.cycle_id) continue;
          const n = r.score == null ? null : Number(r.score);
          if (n == null || !Number.isFinite(n)) continue;
          agg[r.cycle_id] = agg[r.cycle_id] ?? { sum: 0, count: 0 };
          agg[r.cycle_id].sum += n;
          agg[r.cycle_id].count += 1;
        }

        const out: Record<string, { avg: number | null; count: number }> = {};
        for (const cid of cycleIds) {
          const a = agg[cid];
          if (!a || a.count <= 0) out[cid] = { avg: null, count: 0 };
          else
            out[cid] = {
              avg: Math.round((a.sum / a.count) * 10) / 10,
              count: a.count,
            };
        }
        setSessionsAggByCycle(out);
      } else {
        setSessionsAggByCycle({});
      }

      // external ratings (per game)
      try {
        const uid = await requireUserId();
        const { data: er, error: e4 } = await supabase
          .schema("kesslerlog")
          .from("external_ratings")
          .select("id,user_id,game_id,source,score,scale_max,url,retrieved_at")
          .eq("game_id", gameId)
          .eq("user_id", uid)
          .order("retrieved_at", { ascending: false })
          .limit(80);

        if (e4) throw e4;
        setExternalRatings((er ?? []) as any as ExternalRatingRow[]);
      } catch {
        setExternalRatings([]);
      }
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao carregar ciclos");
      setCycles([]);
      setSelectedCycleId(null);
      setHasOpenSession(false);
      setReviewDraft("");
      setRatingDraft("");
      setSessionsAggByCycle({});
      setExternalRatings([]);
      setTimelineOpenId(null);
      setTimelineSessionsByCycle({});
      setTimelineLoadingByCycle({});
    } finally {
      setLoading(false);
    }
  }

  // load cycles when game changes
  useEffect(() => {
    if (!open) return;

    if (!selectedGameId) {
      setCycles([]);
      setSelectedCycleId(null);
      setHasOpenSession(false);
      setReviewDraft("");
      setRatingDraft("");
      setSessionsAggByCycle({});
      setExternalRatings([]);
      setTimelineOpenId(null);
      setTimelineSessionsByCycle({});
      setTimelineLoadingByCycle({});
      return;
    }

    let alive = true;
    (async () => {
      await loadCyclesAndHistory(selectedGameId);
      if (!alive) return;
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedGameId]);

  // when cycle changes, sync drafts + open-session guard
  useEffect(() => {
    if (!open) return;
    if (!selectedCycleId) {
      setHasOpenSession(false);
      setReviewDraft("");
      setRatingDraft("");
      return;
    }

    const cy = cycles.find((c) => c.id === selectedCycleId) ?? null;
    setReviewDraft(cy?.review_text ?? "");
    setRatingDraft(
      cy?.rating_final != null ? String(Number(cy.rating_final)) : ""
    );

    let alive = true;
    (async () => {
      try {
        const { data: os, error } = await supabase
          .schema("kesslerlog")
          .from("play_sessions")
          .select("id")
          .eq("cycle_id", selectedCycleId)
          .is("ended_at", null)
          .limit(1);

        if (error) throw error;
        if (!alive) return;
        setHasOpenSession(!!(os ?? [])?.length);
      } catch {
        if (!alive) return;
        setHasOpenSession(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, selectedCycleId, cycles]);

  async function refreshKeepSelection() {
    if (!selectedGameId) return;
    await loadCyclesAndHistory(selectedGameId);
  }

  async function saveReview() {
    if (!selectedCycle?.id) {
      setMsg("Selecione um ciclo para salvar.");
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      await requireUserId();

      const review = reviewDraft.trim() ? reviewDraft.trim() : null;
      const rating = parseScoreInput(ratingDraft);

      const patch: any = {
        review_text: review,
        rating_final: rating == null ? null : rating,
      };

      const { error } = await supabase
        .schema("kesslerlog")
        .from("game_cycles")
        .update(patch)
        .eq("id", selectedCycle.id);

      if (error) throw error;

      setMsg("Review salva ✅");
      await refreshKeepSelection();
      await onMutated?.();
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao salvar review");
    } finally {
      setLoading(false);
    }
  }

  async function saveAndFinish() {
    if (!selectedCycle?.id) {
      setMsg("Selecione um ciclo para finalizar.");
      return;
    }

    if (hasOpenSession) {
      setMsg(
        "Existe uma sessão (run) aberta nesse ciclo. Finalize a sessão antes."
      );
      return;
    }

    if (selectedCycle.ended_at) {
      setMsg("Este ciclo já está encerrado. Você ainda pode salvar a review.");
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      await requireUserId();

      const review = reviewDraft.trim() ? reviewDraft.trim() : null;
      const rating = parseScoreInput(ratingDraft);

      const patch: any = {
        review_text: review,
        rating_final: rating == null ? null : rating,
        ended_at: new Date().toISOString(),
      };

      // opcional: aplicar status final
      if (finishAlso && finishStatusId) patch.status_id = finishStatusId;

      const { error } = await supabase
        .schema("kesslerlog")
        .from("game_cycles")
        .update(patch)
        .eq("id", selectedCycle.id);

      if (error) throw error;

      setMsg("Review salva e ciclo encerrado ✅");
      await refreshKeepSelection();
      await onMutated?.();
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao finalizar ciclo");
    } finally {
      setLoading(false);
    }
  }

  async function loadTimelineSessions(cycleId: string) {
    if (!cycleId) return;
    if (timelineSessionsByCycle[cycleId]) return; // cache

    setTimelineLoadingByCycle((p) => ({ ...p, [cycleId]: true }));
    try {
      const { data, error } = await supabase
        .schema("kesslerlog")
        .from("play_sessions")
        .select("id,cycle_id,started_at,ended_at,note_text,score")
        .eq("cycle_id", cycleId)
        .order("started_at", { ascending: false })
        .limit(40);

      if (error) throw error;

      setTimelineSessionsByCycle((p) => ({
        ...p,
        [cycleId]: (data ?? []) as any as TimelineSessionRow[],
      }));
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao carregar timeline do ciclo");
      setTimelineSessionsByCycle((p) => ({ ...p, [cycleId]: [] }));
    } finally {
      setTimelineLoadingByCycle((p) => ({ ...p, [cycleId]: false }));
    }
  }

  function toggleTimeline(cycleId: string) {
    setTimelineOpenId((prev) => {
      const next = prev === cycleId ? null : cycleId;
      if (next) loadTimelineSessions(next);
      return next;
    });
  }

  const portalTarget = typeof window !== "undefined" ? document.body : null;

  const isMsgError =
    !!msg &&
    (msg.toLowerCase().includes("erro") ||
      msg.toLowerCase().includes("falh") ||
      msg.toLowerCase().includes("exception"));

  const headerCycleLabel = selectedCycle?.id
    ? cycleLabelById[selectedCycle.id] ??
      cycleMonthLabel(selectedCycle.started_at)
    : "— selecione um ciclo —";

  const headerModeLabel =
    tab === "review"
      ? "Review do ciclo"
      : tab === "timeline"
      ? "Timeline"
      : "Histórico do jogo";

  // ensure timeline session loads when switching to tab + cycle open
  useEffect(() => {
    if (!open) return;
    if (tab !== "timeline") return;

    const toOpen = timelineOpenId ?? selectedCycleId ?? null;
    if (toOpen) {
      setTimelineOpenId(toOpen);
      loadTimelineSessions(toOpen);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, open]);

  return portalTarget
    ? createPortal(
        <AnimatePresence>
          {open ? (
            <>
              {/* overlay */}
              <motion.div
                className={cx(
                  "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm",
                  "cursor-pointer"
                )}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.18 }}
                onClick={loading ? undefined : close}
              />

              {/* drawer */}
              <motion.aside
                className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[920px] flex-col border-l border-border/60 bg-background/60 shadow-2xl backdrop-blur-xl"
                initial={{ x: 48, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 48, opacity: 0 }}
                transition={{
                  duration: reduceMotion ? 0 : 0.22,
                  ease: "easeOut",
                }}
                role="dialog"
                aria-modal="true"
                aria-label="Review do ciclo"
              >
                {/* ===== Sticky Header ===== */}
                <div className="sticky top-0 z-10 border-b border-border/50 bg-background/40 backdrop-blur-xl">
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-background/40">
                          {selectedGame?.cover_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={selectedGame.cover_url}
                              alt={selectedGame.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                              <Gamepad2 size={18} className="opacity-70" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-lg font-semibold text-foreground">
                            {selectedGame?.title ?? "Selecione um jogo"}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">
                              {selectedGame?.platform ?? "—"}
                            </span>
                            <span className="text-muted-foreground/60">•</span>
                            <span className="font-medium text-foreground/80">
                              {headerModeLabel}
                            </span>
                          </div>

                          {/* header pills */}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                              ciclo{" "}
                              <span className="ml-2 font-medium text-emerald-50/90">
                                {headerCycleLabel}
                              </span>
                            </span>

                            <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                              {selectedCycle?.status?.name ?? "sem status"}
                            </span>

                            {selectedCycle?.ended_at ? (
                              <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs font-semibold text-emerald-100/80">
                                encerrado
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                                aberto
                              </span>
                            )}

                            {hasOpenSession ? (
                              <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                                run aberta
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="outline"
                          className={cx("h-10 rounded-xl", CLICKABLE)}
                          onClick={refreshKeepSelection}
                          disabled={loading || !selectedGameId}
                          title="Atualizar"
                        >
                          <RefreshCw size={16} className="mr-2" />
                          Atualizar
                        </Button>

                        <Button
                          variant="outline"
                          className={cx("h-10 rounded-xl", CLICKABLE)}
                          onClick={close}
                          disabled={loading}
                          title="Fechar"
                        >
                          <X size={16} className="mr-2" />
                          Fechar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ===== Content ===== */}
                <div className="flex-1 overflow-y-auto px-4 pb-6 pt-5 sm:px-6">
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
                        <div className="text-sm text-muted-foreground">
                          {msg}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Tabs (AGORA ABAIXO DO HEADER) */}
                  <div
                    className={cx(GLASS_CARD, SOFT_RING, "mb-4 bg-card/40 p-2")}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <TabButton
                        active={tab === "review"}
                        onClick={() => setTab("review")}
                        disabled={loading}
                        title="Editar review do ciclo"
                      >
                        <FileText size={14} className="opacity-80" />
                        Review
                      </TabButton>

                      <TabButton
                        active={tab === "timeline"}
                        onClick={() => setTab("timeline")}
                        disabled={loading}
                        title="Timeline por ciclo (expande e mostra runs + texto)"
                      >
                        <History size={14} className="opacity-80" />
                        Timeline
                      </TabButton>

                      <TabButton
                        active={tab === "history"}
                        onClick={() => setTab("history")}
                        disabled={loading}
                        title="Resumo do jogo (ciclos + médias)"
                      >
                        <History size={14} className="opacity-80" />
                        Histórico
                        <span className="ml-1 rounded-full border border-border/50 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {cycles.length}
                        </span>
                      </TabButton>
                    </div>
                  </div>

                  {/* =========================
                      TAB: REVIEW
                  ========================= */}
                  {tab === "review" ? (
                    <>
                      {/* Cycle selector */}
                      <section
                        className={cx(
                          GLASS_CARD,
                          SOFT_RING,
                          "bg-background/35 p-4 sm:p-5"
                        )}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              Ciclo
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Escolha qual ciclo você vai avaliar (default =
                              mais novo).
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock size={12} className="opacity-80" />
                              iniciado:{" "}
                              <span className="text-foreground/80">
                                {formatDateTime(selectedCycle?.started_at)}
                              </span>
                            </span>
                            <span className="opacity-60">•</span>
                            <span>
                              encerrado:{" "}
                              <span className="text-foreground/80">
                                {formatDateTime(selectedCycle?.ended_at)}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2">
                          {cycles.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                              Ainda não existem ciclos para este jogo.
                            </div>
                          ) : (
                            cycles.map((c) => {
                              const active = c.id === selectedCycleId;
                              const hasReview =
                                !!c.review_text?.trim() ||
                                c.rating_final != null;

                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => setSelectedCycleId(c.id)}
                                  disabled={loading}
                                  className={cx(
                                    CLICKABLE,
                                    "w-full rounded-2xl border border-border/50 bg-card/30 p-3 text-left transition hover:bg-card/40",
                                    active
                                      ? "border-emerald-500/25 bg-emerald-500/5"
                                      : ""
                                  )}
                                  title="Selecionar ciclo"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-sm font-semibold text-foreground">
                                        {cycleLabelById[c.id] ??
                                          cycleMonthLabel(c.started_at)}
                                      </div>

                                      <span
                                        className={cx(
                                          BADGE_EMERALD,
                                          BADGE_UPPER
                                        )}
                                      >
                                        {c.status?.name ?? "SEM STATUS"}
                                      </span>

                                      {c.ended_at ? (
                                        <span
                                          className={cx(
                                            BADGE_EMERALD_SOFT,
                                            BADGE_UPPER
                                          )}
                                        >
                                          ENCERRADO
                                        </span>
                                      ) : (
                                        <span
                                          className={cx(
                                            BADGE_EMERALD,
                                            BADGE_UPPER
                                          )}
                                        >
                                          ABERTO
                                        </span>
                                      )}

                                      {hasReview ? (
                                        <span
                                          className={cx(
                                            BADGE_EMERALD,
                                            BADGE_UPPER
                                          )}
                                        >
                                          REVIEW
                                        </span>
                                      ) : null}
                                    </div>

                                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <Star size={12} className="opacity-80" />
                                      {c.rating_final != null
                                        ? Number(c.rating_final).toFixed(1)
                                        : "—"}
                                    </span>
                                  </div>

                                  <div className="mt-1 text-[11px] text-muted-foreground">
                                    iniciado: {formatDateTime(c.started_at)}
                                    {c.ended_at
                                      ? ` • encerrado: ${formatDateTime(
                                          c.ended_at
                                        )}`
                                      : ""}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </section>

                      {/* Review editor */}
                      <section
                        className={cx(
                          GLASS_CARD,
                          SOFT_RING,
                          "mt-4 bg-background/35 p-4 sm:p-5"
                        )}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              Review final
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Texto + nota (0..10). Você pode só salvar, ou
                              salvar e encerrar o ciclo.
                            </div>
                          </div>

                          {hasOpenSession ? (
                            <span className={cx(BADGE_EMERALD, "text-[10px]")}>
                              tem run aberta (bloqueia encerrar)
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4">
                          <div className={TEXTAREA_BASE}>
                            <textarea
                              className="min-h-[260px] w-full resize-none bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                              placeholder="O que você achou do jogo? Pontos fortes, fracos, sensação final..."
                              value={reviewDraft}
                              onChange={(e) => setReviewDraft(e.target.value)}
                              disabled={loading || !selectedCycleId}
                            />
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-[240px_1fr] sm:items-end">
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground">
                              Nota final (0..10)
                            </label>
                            <div className="mt-2">
                              <div className={INPUT_BASE}>
                                <input
                                  className={INPUT_EL}
                                  value={ratingDraft}
                                  onChange={(e) =>
                                    setRatingDraft(e.target.value)
                                  }
                                  placeholder="ex: 8.7"
                                  inputMode="decimal"
                                  disabled={loading || !selectedCycleId}
                                />
                              </div>
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              (pode deixar em branco)
                            </div>
                          </div>

                          <div className="sm:justify-self-end flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              className={cx("h-11 rounded-xl", CLICKABLE)}
                              onClick={saveReview}
                              disabled={loading || !selectedCycleId}
                              title="Salvar sem encerrar"
                            >
                              <FileText size={16} className="mr-2" />
                              Salvar
                            </Button>

                            <Button
                              className={cx(BTN_GREEN, CLICKABLE, "h-11 px-6")}
                              onClick={saveAndFinish}
                              disabled={
                                loading ||
                                !selectedCycleId ||
                                !!selectedCycle?.ended_at ||
                                hasOpenSession
                              }
                              title={
                                hasOpenSession
                                  ? "Finalize a run aberta antes"
                                  : selectedCycle?.ended_at
                                  ? "Ciclo já encerrado"
                                  : "Salvar e encerrar o ciclo"
                              }
                            >
                              <CheckCircle2 size={16} className="mr-2" />
                              Salvar & Encerrar
                            </Button>
                          </div>
                        </div>

                        {/* Finalize options */}
                        <div className="mt-4 space-y-3">
                          <button
                            type="button"
                            onClick={() => setFinishAlso((v) => !v)}
                            disabled={loading}
                            className={cx(
                              CLICKABLE,
                              "w-full rounded-2xl border border-border/50 bg-card/30 p-3 text-left transition hover:bg-card/40"
                            )}
                            title="Configurar encerramento"
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={cx(
                                  "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md border",
                                  finishAlso
                                    ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-200"
                                    : "border-border/50 bg-background/40 text-muted-foreground"
                                )}
                              >
                                {finishAlso ? <Check size={14} /> : null}
                              </span>

                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-foreground">
                                  Ao encerrar, aplicar status final
                                </div>
                                <div className="mt-1 text-[11px] text-muted-foreground">
                                  Se ligado, escolhe o status que será aplicado
                                  quando você usar “Salvar & Encerrar”.
                                </div>
                              </div>
                            </div>
                          </button>

                          {finishAlso ? (
                            <div className="rounded-2xl border border-border/50 bg-card/30 p-3">
                              <div className="text-xs font-semibold text-foreground">
                                Status ao encerrar
                              </div>
                              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                                {statusList.map((s) => {
                                  const active = finishStatusId === s.id;
                                  return (
                                    <button
                                      key={s.id}
                                      type="button"
                                      className={cx(
                                        CLICKABLE,
                                        "shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition",
                                        active
                                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                          : "border-border/50 bg-card/30 text-muted-foreground hover:bg-card/40"
                                      )}
                                      onClick={() => setFinishStatusId(s.id)}
                                      disabled={loading}
                                      title={s.name}
                                    >
                                      {s.name}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="mt-2 text-[11px] text-muted-foreground">
                                Dica: se você tiver um status com slug{" "}
                                <code>zerado</code> ou <code>finalizado</code>,
                                ele tende a ser escolhido automaticamente.
                              </div>
                            </div>
                          ) : null}

                          <div className="text-[11px] text-muted-foreground">
                            Observação: “Salvar & Encerrar” sempre seta{" "}
                            <code>ended_at</code>. Status é opcional.
                          </div>
                        </div>
                      </section>
                    </>
                  ) : null}

                  {/* =========================
                      TAB: TIMELINE
                  ========================= */}
                  {tab === "timeline" ? (
                    <div className="space-y-4">
                      <section
                        className={cx(
                          GLASS_CARD,
                          SOFT_RING,
                          "bg-background/35 p-4 sm:p-5"
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              Timeline
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Clique no ciclo para expandir (review + runs).
                              Ordem: mais novo → mais antigo.
                            </div>
                          </div>

                          <span
                            className={cx(BADGE_MUTED, "px-3 py-1.5 text-xs")}
                          >
                            {cycles.length ? `${cycles.length} ciclos` : "—"}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-2">
                          {cycles.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                              Ainda não existem ciclos para este jogo.
                            </div>
                          ) : (
                            cycles.map((c) => {
                              const openAcc = timelineOpenId === c.id;
                              const sessAgg = sessionsAggByCycle[c.id] ?? {
                                avg: null,
                                count: 0,
                              };
                              const hasReview =
                                !!c.review_text?.trim() ||
                                c.rating_final != null;

                              const sess =
                                timelineSessionsByCycle[c.id] ?? null;
                              const isLoadingSess =
                                !!timelineLoadingByCycle[c.id];

                              return (
                                <div
                                  key={`tl-${c.id}`}
                                  className={cx(
                                    "rounded-2xl border border-border/50 bg-card/30 p-3",
                                    openAcc
                                      ? "border-emerald-500/25 bg-emerald-500/5"
                                      : ""
                                  )}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleTimeline(c.id)}
                                    disabled={loading}
                                    className={cx(
                                      CLICKABLE,
                                      "w-full text-left"
                                    )}
                                    title="Expandir ciclo"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                                        <div className="text-sm font-semibold text-foreground">
                                          {cycleLabelById[c.id] ??
                                            cycleMonthLabel(c.started_at)}
                                        </div>

                                        <span
                                          className={cx(
                                            BADGE_EMERALD,
                                            BADGE_UPPER
                                          )}
                                        >
                                          {c.status?.name ?? "SEM STATUS"}
                                        </span>

                                        {c.ended_at ? (
                                          <span
                                            className={cx(
                                              BADGE_EMERALD_SOFT,
                                              BADGE_UPPER
                                            )}
                                          >
                                            ENCERRADO
                                          </span>
                                        ) : (
                                          <span
                                            className={cx(
                                              BADGE_EMERALD,
                                              BADGE_UPPER
                                            )}
                                          >
                                            ABERTO
                                          </span>
                                        )}

                                        {hasReview ? (
                                          <span
                                            className={cx(
                                              BADGE_EMERALD,
                                              BADGE_UPPER
                                            )}
                                          >
                                            REVIEW
                                          </span>
                                        ) : null}

                                        <span
                                          className={cx(
                                            BADGE_EMERALD,
                                            BADGE_UPPER
                                          )}
                                        >
                                          RUN AVG{" "}
                                          <span className="ml-1 font-medium text-emerald-50/90">
                                            {sessAgg.avg != null
                                              ? sessAgg.avg.toFixed(1)
                                              : "—"}
                                          </span>
                                          <span className="ml-1 text-emerald-100/60">
                                            ({sessAgg.count})
                                          </span>
                                        </span>

                                        <span
                                          className={cx(
                                            BADGE_EMERALD,
                                            BADGE_UPPER
                                          )}
                                        >
                                          REVIEW{" "}
                                          <span className="ml-1 font-medium text-emerald-50/90">
                                            {c.rating_final != null
                                              ? Number(c.rating_final).toFixed(
                                                  1
                                                )
                                              : "—"}
                                          </span>
                                        </span>
                                      </div>

                                      <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                                        <span className="inline-flex items-center gap-1">
                                          <Clock
                                            size={12}
                                            className="opacity-80"
                                          />
                                          {formatDateTime(c.started_at)}
                                        </span>
                                        <ChevronDown
                                          size={16}
                                          className={cx(
                                            "opacity-70 transition-transform",
                                            openAcc ? "rotate-180" : "rotate-0"
                                          )}
                                        />
                                      </div>
                                    </div>

                                    <div className="mt-2 text-[11px] text-muted-foreground">
                                      {c.review_text?.trim()
                                        ? c.review_text.trim().slice(0, 120) +
                                          (c.review_text.trim().length > 120
                                            ? "…"
                                            : "")
                                        : "— sem texto de review —"}
                                    </div>
                                  </button>

                                  {openAcc ? (
                                    <div className="mt-3 space-y-3">
                                      {/* Atalhos */}
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                          variant="outline"
                                          className={cx(
                                            "h-9 rounded-xl",
                                            CLICKABLE
                                          )}
                                          onClick={() => {
                                            setSelectedCycleId(c.id);
                                            setTab("review");
                                          }}
                                          disabled={loading}
                                          title="Abrir este ciclo na aba Review"
                                        >
                                          <FileText
                                            size={14}
                                            className="mr-2"
                                          />
                                          Editar review
                                        </Button>

                                        <Button
                                          variant="outline"
                                          className={cx(
                                            "h-9 rounded-xl",
                                            CLICKABLE
                                          )}
                                          onClick={() => {
                                            setSelectedCycleId(c.id);
                                            setTab("history");
                                          }}
                                          disabled={loading}
                                          title="Ver este ciclo no histórico"
                                        >
                                          <History size={14} className="mr-2" />
                                          Ver no histórico
                                        </Button>

                                        {!timelineSessionsByCycle[c.id] ? (
                                          <Button
                                            variant="outline"
                                            className={cx(
                                              "h-9 rounded-xl",
                                              CLICKABLE
                                            )}
                                            onClick={() =>
                                              loadTimelineSessions(c.id)
                                            }
                                            disabled={loading || isLoadingSess}
                                            title="Carregar runs do ciclo"
                                          >
                                            <RefreshCw
                                              size={14}
                                              className="mr-2"
                                            />
                                            Carregar runs
                                          </Button>
                                        ) : null}
                                      </div>

                                      {/* Review (detalhado) */}
                                      <div className="rounded-2xl border border-border/50 bg-background/40 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div className="text-xs font-semibold text-foreground">
                                            <span
                                              className={cx(
                                                "mr-2",
                                                BADGE_UPPER
                                              )}
                                            >
                                              REVIEW
                                            </span>
                                            <span className="text-muted-foreground">
                                              (texto + nota final)
                                            </span>
                                          </div>

                                          <span
                                            className={cx(
                                              BADGE_EMERALD,
                                              BADGE_UPPER
                                            )}
                                          >
                                            NOTA{" "}
                                            <span className="ml-1 font-medium text-emerald-50/90">
                                              {c.rating_final != null
                                                ? Number(
                                                    c.rating_final
                                                  ).toFixed(1)
                                                : "—"}
                                            </span>
                                          </span>
                                        </div>

                                        <div className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                                          {c.review_text?.trim()
                                            ? c.review_text.trim()
                                            : "— sem texto de review —"}
                                        </div>
                                      </div>

                                      {/* Runs (timeline) */}
                                      <div className="rounded-2xl border border-border/50 bg-background/40 p-3">
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="text-xs font-semibold text-foreground">
                                            <span className={BADGE_UPPER}>
                                              RUNS
                                            </span>{" "}
                                            <span className="text-muted-foreground">
                                              (mais novas primeiro)
                                            </span>
                                          </div>

                                          <span
                                            className={cx(
                                              BADGE_MUTED,
                                              "px-2.5 py-1"
                                            )}
                                          >
                                            {isLoadingSess
                                              ? "carregando…"
                                              : sess
                                              ? `${sess.length} itens`
                                              : "—"}
                                          </span>
                                        </div>

                                        <div className="mt-3 grid gap-2">
                                          {isLoadingSess ? (
                                            <div className="text-sm text-muted-foreground">
                                              Carregando runs…
                                            </div>
                                          ) : sess ? (
                                            sess.length === 0 ? (
                                              <div className="text-sm text-muted-foreground">
                                                Nenhuma run encontrada neste
                                                ciclo.
                                              </div>
                                            ) : (
                                              sess.map((s) => {
                                                const mins = minutesBetween(
                                                  s.started_at,
                                                  s.ended_at
                                                );
                                                const isOpenRun = !s.ended_at;

                                                return (
                                                  <div
                                                    key={`tl-run-${s.id}`}
                                                    className={cx(
                                                      "rounded-2xl border border-border/50 bg-card/20 p-3",
                                                      isOpenRun
                                                        ? "border-emerald-500/25 bg-emerald-500/5"
                                                        : ""
                                                    )}
                                                  >
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                      <div className="flex flex-wrap items-center gap-2">
                                                        <span
                                                          className={cx(
                                                            BADGE_EMERALD,
                                                            BADGE_UPPER
                                                          )}
                                                        >
                                                          {isOpenRun
                                                            ? "AO VIVO"
                                                            : "FINALIZADA"}
                                                        </span>

                                                        <span
                                                          className={cx(
                                                            BADGE_EMERALD,
                                                            BADGE_UPPER
                                                          )}
                                                        >
                                                          SCORE{" "}
                                                          <span className="ml-1 font-medium text-emerald-50/90">
                                                            {s.score != null
                                                              ? Number(
                                                                  s.score
                                                                ).toFixed(1)
                                                              : "—"}
                                                          </span>
                                                        </span>

                                                        <span
                                                          className={cx(
                                                            BADGE_EMERALD,
                                                            BADGE_UPPER
                                                          )}
                                                        >
                                                          MIN{" "}
                                                          <span className="ml-1 font-medium text-emerald-50/90">
                                                            {mins != null
                                                              ? mins
                                                              : "—"}
                                                          </span>
                                                        </span>
                                                      </div>

                                                      <div className="text-[11px] text-muted-foreground">
                                                        {formatDateTime(
                                                          s.started_at
                                                        )}
                                                        {s.ended_at
                                                          ? ` → ${formatDateTime(
                                                              s.ended_at
                                                            )}`
                                                          : ""}
                                                      </div>
                                                    </div>

                                                    <div className="mt-2 text-sm text-muted-foreground">
                                                      {s.note_text?.trim()
                                                        ? s.note_text.trim()
                                                        : "— sem texto —"}
                                                    </div>
                                                  </div>
                                                );
                                              })
                                            )
                                          ) : (
                                            <div className="text-sm text-muted-foreground">
                                              Clique no ciclo para carregar a
                                              timeline.
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </section>
                    </div>
                  ) : null}

                  {/* =========================
                      TAB: HISTORY
                  ========================= */}
                  {tab === "history" ? (
                    <>
                      {/* External ratings (compact pills card) */}
                      <section
                        className={cx(
                          GLASS_CARD,
                          SOFT_RING,
                          "bg-background/35 p-4 sm:p-5"
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-foreground">
                            Notas externas
                          </div>

                          <span className="inline-flex items-center rounded-full border border-border/50 bg-card/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                            {externalRatings.length
                              ? `${externalRatings.length} itens`
                              : "—"}
                          </span>
                        </div>

                        {externalRatings.length ? (
                          <>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {(showExternalAll
                                ? externalRatings
                                : externalRatings.slice(0, 4)
                              ).map((er) => {
                                const n10 = externalTo10(er);

                                const pill = (
                                  <span
                                    className={cx(
                                      "inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-50/90"
                                    )}
                                    title={`${er.source} • ${Number(
                                      er.score
                                    )} / ${Number(
                                      er.scale_max
                                    )} • ${formatDateTime(er.retrieved_at)}`}
                                  >
                                    <span
                                      className={cx(
                                        "max-w-[160px] truncate",
                                        BADGE_UPPER
                                      )}
                                    >
                                      {er.source}
                                    </span>
                                    <span className="text-emerald-100/60">
                                      •
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-emerald-50/90">
                                      <Star size={12} className="opacity-80" />
                                      {n10 != null ? n10.toFixed(1) : "—"}
                                    </span>
                                  </span>
                                );

                                return er.url ? (
                                  <a
                                    key={er.id}
                                    href={er.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="transition hover:opacity-90"
                                    title="Abrir fonte"
                                  >
                                    {pill}
                                  </a>
                                ) : (
                                  <div key={er.id}>{pill}</div>
                                );
                              })}

                              {externalRatings.length > 4 ? (
                                <button
                                  type="button"
                                  onClick={() => setShowExternalAll((v) => !v)}
                                  className={cx(
                                    CLICKABLE,
                                    "inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-50/80 hover:opacity-90"
                                  )}
                                  disabled={loading}
                                >
                                  {showExternalAll
                                    ? "ver menos"
                                    : `ver mais +${externalRatings.length - 4}`}
                                </button>
                              ) : null}
                            </div>

                            {showExternalAll ? (
                              <div className="mt-3 grid gap-2">
                                {externalRatings.map((er) => {
                                  const n10 = externalTo10(er);
                                  return (
                                    <div
                                      key={`row-${er.id}`}
                                      className="rounded-2xl border border-border/50 bg-card/20 p-3"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                          <div
                                            className={cx(
                                              "truncate text-sm font-semibold text-foreground",
                                              BADGE_UPPER
                                            )}
                                          >
                                            {er.source}
                                          </div>
                                          <div className="mt-1 text-[11px] text-muted-foreground">
                                            {formatDateTime(er.retrieved_at)}
                                          </div>
                                        </div>

                                        <div className="shrink-0 text-right">
                                          <div className="text-sm font-semibold text-foreground">
                                            {Number(er.score)} /{" "}
                                            {Number(er.scale_max)}
                                          </div>
                                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                            <Star
                                              size={12}
                                              className="opacity-80"
                                            />
                                            {n10 != null
                                              ? `${n10.toFixed(1)}/10`
                                              : "—"}
                                          </div>
                                        </div>
                                      </div>

                                      {er.url ? (
                                        <a
                                          className="mt-2 inline-flex text-[11px] font-medium text-emerald-300 hover:text-emerald-200"
                                          href={er.url}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          abrir fonte
                                        </a>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div className="mt-3 text-sm text-muted-foreground">
                            Nenhuma nota externa salva para este jogo ainda.
                          </div>
                        )}
                      </section>

                      {/* Cycles history list */}
                      <section
                        className={cx(
                          GLASS_CARD,
                          SOFT_RING,
                          "mt-4 bg-background/35 p-4 sm:p-5"
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold text-foreground">
                            Histórico de ciclos
                          </div>
                          <span className="inline-flex items-center rounded-full border border-border/50 bg-card/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                            {cycles.length ? `${cycles.length} ciclos` : "—"}
                          </span>
                        </div>

                        <div className="mt-1 text-xs text-muted-foreground">
                          Mostra duas médias por ciclo:{" "}
                          <span className="font-semibold text-foreground/80">
                            RUN AVG
                          </span>{" "}
                          (média das runs com score) e{" "}
                          <span className="font-semibold text-foreground/80">
                            REVIEW
                          </span>{" "}
                          (rating_final).
                        </div>

                        <div className="mt-4 grid gap-2">
                          {cycles.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                              Ainda não existem ciclos para este jogo.
                            </div>
                          ) : (
                            cycles.map((c) => {
                              const active = c.id === selectedCycleId;
                              const sess = sessionsAggByCycle[c.id] ?? {
                                avg: null,
                                count: 0,
                              };
                              const hasReview =
                                !!c.review_text?.trim() ||
                                c.rating_final != null;

                              return (
                                <button
                                  key={`hist-${c.id}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCycleId(c.id);
                                    setTab("review"); // atalho
                                  }}
                                  disabled={loading}
                                  className={cx(
                                    CLICKABLE,
                                    "w-full rounded-2xl border border-border/50 bg-card/30 p-3 text-left transition hover:bg-card/40",
                                    active
                                      ? "border-emerald-500/25 bg-emerald-500/5"
                                      : ""
                                  )}
                                  title="Abrir este ciclo na aba Review"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-sm font-semibold text-foreground">
                                        {cycleLabelById[c.id] ??
                                          cycleMonthLabel(c.started_at)}
                                      </div>

                                      <span
                                        className={cx(
                                          BADGE_EMERALD,
                                          BADGE_UPPER
                                        )}
                                      >
                                        {c.status?.name ?? "SEM STATUS"}
                                      </span>

                                      {c.ended_at ? (
                                        <span
                                          className={cx(
                                            BADGE_EMERALD_SOFT,
                                            BADGE_UPPER
                                          )}
                                        >
                                          ENCERRADO
                                        </span>
                                      ) : (
                                        <span
                                          className={cx(
                                            BADGE_EMERALD,
                                            BADGE_UPPER
                                          )}
                                        >
                                          ABERTO
                                        </span>
                                      )}

                                      {hasReview ? (
                                        <span
                                          className={cx(
                                            BADGE_EMERALD,
                                            BADGE_UPPER
                                          )}
                                        >
                                          REVIEW
                                        </span>
                                      ) : null}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                      <span className="inline-flex items-center gap-1">
                                        <Clock
                                          size={12}
                                          className="opacity-80"
                                        />
                                        {formatDateTime(c.started_at)}
                                      </span>

                                      <span
                                        className={cx(
                                          BADGE_EMERALD,
                                          BADGE_UPPER
                                        )}
                                      >
                                        RUN AVG{" "}
                                        <span className="ml-1 font-medium text-emerald-50/90">
                                          {sess.avg != null
                                            ? sess.avg.toFixed(1)
                                            : "—"}
                                        </span>
                                        <span className="ml-1 text-emerald-100/60">
                                          ({sess.count})
                                        </span>
                                      </span>

                                      <span
                                        className={cx(
                                          BADGE_EMERALD,
                                          BADGE_UPPER
                                        )}
                                      >
                                        REVIEW{" "}
                                        <span className="ml-1 font-medium text-emerald-50/90">
                                          {c.rating_final != null
                                            ? Number(c.rating_final).toFixed(1)
                                            : "—"}
                                        </span>
                                      </span>
                                    </div>
                                  </div>

                                  {c.review_text?.trim() ? (
                                    <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                                      {c.review_text.trim()}
                                    </div>
                                  ) : (
                                    <div className="mt-2 text-xs text-muted-foreground/70">
                                      Sem texto de review.
                                    </div>
                                  )}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </section>
                    </>
                  ) : null}
                </div>
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>,
        portalTarget
      )
    : null;
}
