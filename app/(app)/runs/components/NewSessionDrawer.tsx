"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  X,
  Timer as TimerIcon,
  Play,
  Pause,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

/* =========================
   Utils
========================= */

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function formatHHMMSS(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
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
  status?: StatusRow | null;
};

type SessionRow = {
  id: string;
  cycle_id: string;
  started_at: string;
  ended_at: string | null;
  note_text: string | null;
  score: number | null;
};

type CycleStatsRow = {
  cycle_id: string;
  sessions_count_finished: number;
  total_minutes_finished: number;
  avg_session_minutes_finished: number;
  avg_score_finished: number | null;
  last_session_started_at: string | null;
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
   Tabs
========================= */

type TabKey = "cycles" | "runs";

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

export function CycleSessionDrawer({
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

  // tabs
  const [tab, setTab] = useState<TabKey>("runs");

  // game (sem “trocar”/search aqui — a page decide o jogo)
  const [selectedGameId, setSelectedGameId] = useState<string | null>(
    initialGameId ?? null
  );

  const selectedGame = useMemo(
    () => games.find((g) => g.id === selectedGameId) ?? null,
    [games, selectedGameId]
  );

  // cycles
  const [cycles, setCycles] = useState<CycleRow[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const selectedCycle = useMemo(
    () => cycles.find((c) => c.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId]
  );

  // stats + sessions
  const [cycleStats, setCycleStats] = useState<CycleStatsRow | null>(null);
  const [openSession, setOpenSession] = useState<SessionRow | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const hasOpen = !!openSession?.id && !openSession?.ended_at;

  // statuses
  const activeStatuses = useMemo(
    () => (statuses ?? []).filter((s) => s.is_active ?? true),
    [statuses]
  );
  const statusList = (activeStatuses.length ? activeStatuses : statuses) ?? [];

  // drafts
  const [noteText, setNoteText] = useState("");
  const [scoreText, setScoreText] = useState("");

  // timer (visual)
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const [baseStartMs, setBaseStartMs] = useState<number | null>(null);
  const [accumSec, setAccumSec] = useState(0);

  const elapsed = useMemo(() => {
    if (!baseStartMs) return accumSec;
    const nowSec = Math.floor((Date.now() - baseStartMs) / 1000);
    return Math.max(0, accumSec + (paused ? 0 : nowSec));
  }, [baseStartMs, accumSec, paused, tick]);

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

  // init open
  useEffect(() => {
    if (!open) return;

    setMsg(null);
    setLoading(false);

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

  // load cycles when game changes
  useEffect(() => {
    if (!open) return;
    if (!selectedGameId) {
      setCycles([]);
      setSelectedCycleId(null);
      return;
    }

    let alive = true;

    async function loadCycles(gameId: string) {
      setLoading(true);
      setMsg(null);

      try {
        const { data, error } = await supabase
          .schema("kesslerlog")
          .from("game_cycles")
          .select(
            `
              id, game_id, status_id, started_at, ended_at,
              status:game_statuses(id,name,slug,is_active)
            `
          )
          .eq("game_id", gameId)
          .order("started_at", { ascending: false })
          .limit(80);

        if (error) throw error;

        const list = (data ?? []) as any as CycleRow[];
        if (!alive) return;

        setCycles(list);

        // default = ciclo mais novo
        const newestId = list[0]?.id ?? null;
        setSelectedCycleId((prev) =>
          prev && list.some((c) => c.id === prev) ? prev : newestId
        );

        // se não houver ciclo, manda pra aba cycles
        if (!newestId) setTab("cycles");
      } catch (e: any) {
        if (!alive) return;
        setMsg(e?.message ?? "Erro ao carregar ciclos");
        setCycles([]);
        setSelectedCycleId(null);
        setTab("cycles");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadCycles(selectedGameId);

    return () => {
      alive = false;
    };
  }, [open, selectedGameId]);

  // cycle labels (Dez/2025) + desambiguação se tiver mais de um no mês
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

  // load cycle context when selectedCycle changes
  useEffect(() => {
    if (!open) return;
    if (!selectedCycleId) {
      setCycleStats(null);
      setOpenSession(null);
      setSessions([]);
      setPaused(false);
      setAccumSec(0);
      setBaseStartMs(Date.now());
      setNoteText("");
      setScoreText("");
      return;
    }

    let alive = true;

    async function loadCycleContext(cycleId: string) {
      setLoading(true);
      setMsg(null);

      try {
        const { data: st, error: e1 } = await supabase
          .schema("kesslerlog")
          .from("vw_cycle_stats")
          .select(
            "cycle_id,sessions_count_finished,total_minutes_finished,avg_session_minutes_finished,avg_score_finished,last_session_started_at"
          )
          .eq("cycle_id", cycleId)
          .maybeSingle();

        if (e1) throw e1;

        const { data: os, error: e2 } = await supabase
          .schema("kesslerlog")
          .from("play_sessions")
          .select("id,cycle_id,started_at,ended_at,note_text,score")
          .eq("cycle_id", cycleId)
          .is("ended_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (e2) throw e2;

        const { data: hist, error: e3 } = await supabase
          .schema("kesslerlog")
          .from("play_sessions")
          .select("id,cycle_id,started_at,ended_at,note_text,score")
          .eq("cycle_id", cycleId)
          .order("started_at", { ascending: false })
          .limit(14);

        if (e3) throw e3;

        if (!alive) return;

        setCycleStats((st ?? null) as any as CycleStatsRow | null);
        const openRow = (os ?? null) as any as SessionRow | null;
        setOpenSession(openRow);
        setSessions((hist ?? []) as any as SessionRow[]);

        // sync timer + fields
        if (openRow?.id && !openRow.ended_at) {
          const ms = new Date(openRow.started_at).getTime();
          setPaused(false);
          setAccumSec(0);
          setBaseStartMs(Number.isFinite(ms) ? ms : Date.now());
          setNoteText(openRow.note_text ?? "");
          setScoreText(
            openRow.score != null
              ? String(Number(openRow.score).toFixed(1))
              : ""
          );
          setTab("runs");
        } else {
          setPaused(false);
          setAccumSec(0);
          setBaseStartMs(Date.now());
          setNoteText("");
          setScoreText("");
        }
      } catch (e: any) {
        if (!alive) return;
        setMsg(e?.message ?? "Erro ao carregar contexto do ciclo");
        setCycleStats(null);
        setOpenSession(null);
        setSessions([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    loadCycleContext(selectedCycleId);

    return () => {
      alive = false;
    };
  }, [open, selectedCycleId]);

  // ticking
  useEffect(() => {
    if (!open) return;
    if (!hasOpen) return;
    if (paused) return;
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [open, hasOpen, paused]);

  /* =========================
     Timer controls (visual)
  ========================= */

  function resetTimer() {
    setPaused(false);
    setAccumSec(0);
    if (openSession?.started_at && hasOpen) {
      const ms = new Date(openSession.started_at).getTime();
      setBaseStartMs(Number.isFinite(ms) ? ms : Date.now());
      return;
    }
    setBaseStartMs(Date.now());
  }

  function pauseTimer() {
    if (paused) return;
    if (baseStartMs) {
      const nowSec = Math.floor((Date.now() - baseStartMs) / 1000);
      setAccumSec((v) => v + Math.max(0, nowSec));
    }
    setPaused(true);
    setBaseStartMs(Date.now());
  }

  function resumeTimer() {
    if (!paused) return;
    setPaused(false);
    setBaseStartMs(Date.now());
  }

  /* =========================
     DB actions
  ========================= */

  async function refreshCycleContext(cycleId: string) {
    const { data: st } = await supabase
      .schema("kesslerlog")
      .from("vw_cycle_stats")
      .select(
        "cycle_id,sessions_count_finished,total_minutes_finished,avg_session_minutes_finished,avg_score_finished,last_session_started_at"
      )
      .eq("cycle_id", cycleId)
      .maybeSingle();
    setCycleStats((st ?? null) as any);

    const { data: os } = await supabase
      .schema("kesslerlog")
      .from("play_sessions")
      .select("id,cycle_id,started_at,ended_at,note_text,score")
      .eq("cycle_id", cycleId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setOpenSession((os ?? null) as any);

    const { data: hist } = await supabase
      .schema("kesslerlog")
      .from("play_sessions")
      .select("id,cycle_id,started_at,ended_at,note_text,score")
      .eq("cycle_id", cycleId)
      .order("started_at", { ascending: false })
      .limit(14);
    setSessions((hist ?? []) as any);
  }

  async function refreshCyclesAndSelect(cycleIdToSelect?: string | null) {
    if (!selectedGameId) return;

    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("game_cycles")
      .select(
        `
          id, game_id, status_id, started_at, ended_at,
          status:game_statuses(id,name,slug,is_active)
        `
      )
      .eq("game_id", selectedGameId)
      .order("started_at", { ascending: false })
      .limit(80);

    if (error) throw error;

    const list = (data ?? []) as any as CycleRow[];
    setCycles(list);

    const nextId =
      cycleIdToSelect && list.some((c) => c.id === cycleIdToSelect)
        ? cycleIdToSelect
        : list[0]?.id ?? null;

    setSelectedCycleId(nextId);
    if (!nextId) setTab("cycles");
  }

  async function createNewCycle() {
    if (!selectedGameId) return;

    const statusId = statusList[0]?.id ?? null;
    if (!statusId) {
      setMsg("Você precisa ter pelo menos 1 status cadastrado.");
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const uid = await requireUserId();

      const { data, error } = await supabase
        .schema("kesslerlog")
        .from("game_cycles")
        .insert({
          user_id: uid,
          game_id: selectedGameId,
          status_id: statusId,
        })
        .select("id")
        .single();

      if (error) throw error;

      const newId = (data as any)?.id as string;
      await refreshCyclesAndSelect(newId);

      setMsg("Novo ciclo criado ✅");
      setTab("cycles");
      await onMutated?.();
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao criar novo ciclo");
    } finally {
      setLoading(false);
    }
  }

  async function deleteCycle(cycleId: string) {
    const isSelected = selectedCycleId === cycleId;
    const isCycleWithOpenSession = hasOpen && openSession?.cycle_id === cycleId;

    const ok = window.confirm(
      isCycleWithOpenSession
        ? "Excluir este ciclo com uma sessão aberta? Se houver restrição no banco, pode falhar."
        : "Excluir este ciclo? (Se existirem sessões vinculadas, o banco pode bloquear a exclusão.)"
    );
    if (!ok) return;

    setLoading(true);
    setMsg(null);

    try {
      const { error } = await supabase
        .schema("kesslerlog")
        .from("game_cycles")
        .delete()
        .eq("id", cycleId);

      if (error) throw error;

      if (isSelected) {
        setOpenSession(null);
        setSessions([]);
        setCycleStats(null);
        setPaused(false);
        setAccumSec(0);
        setBaseStartMs(Date.now());
        setNoteText("");
        setScoreText("");
      }

      await refreshCyclesAndSelect(isSelected ? null : selectedCycleId);
      setMsg("Ciclo excluído ✅");
      await onMutated?.();
    } catch (e: any) {
      setMsg(
        e?.message ?? "Erro ao excluir ciclo (talvez existam sessões ligadas)"
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateCycleStatus(nextStatusId: string) {
    if (!selectedCycleId) return;

    setLoading(true);
    setMsg(null);

    try {
      const { error } = await supabase
        .schema("kesslerlog")
        .from("game_cycles")
        .update({ status_id: nextStatusId })
        .eq("id", selectedCycleId);

      if (error) throw error;

      setCycles((prev) =>
        prev.map((c) =>
          c.id === selectedCycleId
            ? {
                ...c,
                status_id: nextStatusId,
                status:
                  statusList.find((s) => s.id === nextStatusId) ??
                  c.status ??
                  null,
              }
            : c
        )
      );
      await onMutated?.();
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao atualizar status");
    } finally {
      setLoading(false);
    }
  }

  async function startSession() {
    if (!selectedCycleId) return;

    const cycle = selectedCycle;
    if (!cycle) return;

    if (cycle.ended_at) {
      setMsg("Este ciclo está encerrado. Escolha outro ciclo ou crie um novo.");
      return;
    }

    if (hasOpen) {
      setMsg("Já existe uma sessão aberta neste ciclo ✅");
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const uid = await requireUserId();

      const { data, error } = await supabase
        .schema("kesslerlog")
        .from("play_sessions")
        .insert({
          user_id: uid,
          cycle_id: selectedCycleId,
          note_text: noteText.trim() ? noteText.trim() : null,
        })
        .select("id,cycle_id,started_at,ended_at,note_text,score")
        .single();

      if (error) throw error;

      const sess = data as any as SessionRow;
      setOpenSession(sess);

      const ms = new Date(sess.started_at).getTime();
      setPaused(false);
      setAccumSec(0);
      setBaseStartMs(Number.isFinite(ms) ? ms : Date.now());

      setMsg("Sessão iniciada ✅");

      await refreshCycleContext(selectedCycleId);
      setTab("runs");
      await onMutated?.();
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao iniciar sessão");
    } finally {
      setLoading(false);
    }
  }

  async function finishSession() {
    if (!openSession?.id) {
      setMsg("Não existe sessão aberta.");
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const score = parseScoreInput(scoreText);
      const note = noteText.trim() ? noteText.trim() : null;

      const patch: any = { ended_at: new Date().toISOString() };
      patch.score = score == null ? null : score;
      patch.note_text = note;

      const { error } = await supabase
        .schema("kesslerlog")
        .from("play_sessions")
        .update(patch)
        .eq("id", openSession.id);

      if (error) throw error;

      setMsg("Sessão finalizada ✅");
      setOpenSession(null);

      setPaused(false);
      setAccumSec(0);
      setBaseStartMs(Date.now());
      setScoreText("");
      setNoteText("");

      if (selectedCycleId) {
        await refreshCycleContext(selectedCycleId);
      }

      await onMutated?.();
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao finalizar sessão");
    } finally {
      setLoading(false);
    }
  }

  async function deleteSession(sessionId: string) {
    if (!selectedCycleId) return;

    const row = sessions.find((s) => s.id === sessionId) ?? null;
    const isOpenRow = row ? !row.ended_at : openSession?.id === sessionId;

    const ok = window.confirm(
      isOpenRow
        ? "Excluir esta sessão aberta? Isso vai cancelar o timer e remover a sessão do banco."
        : "Excluir esta sessão? Essa ação não pode ser desfeita."
    );
    if (!ok) return;

    setLoading(true);
    setMsg(null);

    try {
      const { error } = await supabase
        .schema("kesslerlog")
        .from("play_sessions")
        .delete()
        .eq("id", sessionId);

      if (error) throw error;

      if (openSession?.id === sessionId) {
        setOpenSession(null);
        setPaused(false);
        setAccumSec(0);
        setBaseStartMs(Date.now());
        setScoreText("");
        setNoteText("");
      }

      await refreshCycleContext(selectedCycleId);
      await onMutated?.();
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao excluir sessão");
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     UI derived
  ========================= */

  const portalTarget = typeof window !== "undefined" ? document.body : null;

  const isMsgError =
    !!msg &&
    (msg.toLowerCase().includes("erro") ||
      msg.toLowerCase().includes("falh") ||
      msg.toLowerCase().includes("exception"));

  const bigTime = hasOpen ? formatHHMMSS(elapsed) : "00:00:00";

  const canStart = !loading && !!selectedCycleId && !hasOpen;
  const canPause = !loading && hasOpen;

  const headerBadge = hasOpen
    ? "Sessão em andamento"
    : selectedCycle?.id
    ? selectedCycle.ended_at
      ? "Ciclo encerrado"
      : "Pronto pra nova sessão"
    : "Sem ciclo";

  const timerStateLabel = hasOpen
    ? paused
      ? "Pausado (visual)"
      : "Rodando"
    : selectedCycle?.ended_at
    ? "Ciclo encerrado"
    : "Pronto pra iniciar";

  const headerCycleLabel = selectedCycle?.id
    ? cycleLabelById[selectedCycle.id] ??
      cycleMonthLabel(selectedCycle.started_at)
    : "— selecione um ciclo —";

  /* =========================
     Render
  ========================= */

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
                onClick={close}
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
                aria-label="Ciclo e sessões"
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
                              <TimerIcon size={18} className="opacity-70" />
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
                              {headerBadge}
                            </span>
                          </div>

                          {/* labels only (bigger) */}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full border border-border/50 bg-card/40 px-3 py-1.5 text-xs font-semibold">
                              ciclo{" "}
                              <span className="ml-2 font-medium text-foreground/90">
                                {headerCycleLabel}
                              </span>
                            </span>

                            <span className="inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200">
                              {selectedCycle?.status?.name ?? "sem status"}
                            </span>

                            <span className="inline-flex items-center rounded-full border border-border/50 bg-card/40 px-3 py-1.5 text-xs font-semibold">
                              runs{" "}
                              <span className="ml-2 font-medium text-foreground/90">
                                {cycleStats?.sessions_count_finished ?? 0}
                              </span>
                            </span>

                            <span className="inline-flex items-center rounded-full border border-border/50 bg-card/40 px-3 py-1.5 text-xs font-semibold">
                              total{" "}
                              <span className="ml-2 font-medium text-foreground/90">
                                {cycleStats?.total_minutes_finished ?? 0} min
                              </span>
                            </span>

                            <span className="inline-flex items-center rounded-full border border-border/50 bg-card/40 px-3 py-1.5 text-xs font-semibold">
                              última{" "}
                              <span className="ml-2 font-medium text-foreground/90">
                                {formatDateTime(
                                  cycleStats?.last_session_started_at
                                )}
                              </span>
                            </span>

                            {hasOpen ? (
                              <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                                LIVE
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
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

                  {/* Tabs */}
                  <div
                    className={cx(GLASS_CARD, SOFT_RING, "mb-4 bg-card/40 p-2")}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <TabButton
                        active={tab === "cycles"}
                        onClick={() => setTab("cycles")}
                        disabled={loading}
                        title="Gerenciar ciclos"
                      >
                        <RefreshCw size={14} className="opacity-80" />
                        Ciclos
                        <span className="ml-1 rounded-full border border-border/50 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {cycles.length}
                        </span>
                      </TabButton>

                      <TabButton
                        active={tab === "runs"}
                        onClick={() => setTab("runs")}
                        disabled={loading || !selectedCycleId}
                        title={
                          !selectedCycleId
                            ? "Selecione/crie um ciclo antes"
                            : "Timer + anotações + histórico"
                        }
                      >
                        <TimerIcon size={14} className="opacity-80" />
                        Runs
                        {hasOpen ? (
                          <span className="ml-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                            LIVE
                          </span>
                        ) : null}
                      </TabButton>
                    </div>
                  </div>

                  {/* ======= TAB: CYCLES ======= */}
                  {tab === "cycles" ? (
                    <div className="space-y-4">
                      {/* ✅ trocado: Status do ciclo primeiro */}
                      <section
                        className={cx(
                          GLASS_CARD,
                          SOFT_RING,
                          "bg-background/35 p-4 sm:p-5"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              Status do ciclo
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Troque o status (Zerado, Abandonado, etc).
                              Encerrar aqui é só o status — não apaga nada.
                            </div>
                          </div>

                          {selectedCycle?.ended_at ? (
                            <span className="inline-flex items-center rounded-full border border-border/50 bg-card/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                              encerrado em{" "}
                              {formatDateTime(selectedCycle.ended_at)}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                          {statusList.map((s) => {
                            const active = selectedCycle?.status_id === s.id;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                disabled={!selectedCycle?.id || loading}
                                onClick={() => updateCycleStatus(s.id)}
                                className={cx(
                                  CLICKABLE,
                                  "shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition",
                                  active
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                    : "border-border/50 bg-card/30 text-muted-foreground hover:bg-card/40"
                                )}
                                title={s.name}
                              >
                                {s.name}
                              </button>
                            );
                          })}
                        </div>

                        {!selectedCycle?.id ? (
                          <div className="mt-3 text-[11px] text-muted-foreground">
                            Sem ciclo selecionado. Selecione/crie um ciclo
                            abaixo.
                          </div>
                        ) : (
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              className={cx("h-10 rounded-xl", CLICKABLE)}
                              onClick={() => setTab("runs")}
                              disabled={loading}
                              title="Ir para Runs"
                            >
                              <TimerIcon
                                size={16}
                                className="mr-2 opacity-80"
                              />
                              Ir para Runs
                            </Button>
                          </div>
                        )}
                      </section>

                      {/* ✅ trocado: Ciclos do jogo depois */}
                      <section
                        className={cx(
                          GLASS_CARD,
                          SOFT_RING,
                          "bg-background/35 p-4 sm:p-5"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              Ciclos do jogo
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Aqui você cria, seleciona e pode excluir ciclos. O
                              ciclo ativo controla onde as runs ficam.
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              className={cx(BTN_GREEN, CLICKABLE, "h-10")}
                              onClick={createNewCycle}
                              disabled={loading || !selectedGameId}
                              title="Criar um novo ciclo"
                            >
                              <Plus size={16} className="mr-2" />
                              Criar ciclo
                            </Button>

                            <Button
                              variant="outline"
                              className={cx("h-10 rounded-xl", CLICKABLE)}
                              onClick={() =>
                                selectedGameId
                                  ? refreshCyclesAndSelect(selectedCycleId)
                                  : null
                              }
                              disabled={loading || !selectedGameId}
                              title="Recarregar ciclos"
                            >
                              <RefreshCw size={16} className="mr-2" />
                              Atualizar
                            </Button>
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
                              return (
                                <div
                                  key={c.id}
                                  className={cx(
                                    "rounded-2xl border border-border/50 bg-card/30 p-3",
                                    active
                                      ? "border-emerald-500/25 bg-emerald-500/5"
                                      : ""
                                  )}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <button
                                      type="button"
                                      className={cx(
                                        CLICKABLE,
                                        "min-w-0 text-left"
                                      )}
                                      onClick={() => setSelectedCycleId(c.id)}
                                      disabled={loading}
                                      title="Selecionar este ciclo"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <div className="text-sm font-semibold text-foreground">
                                          {cycleLabelById[c.id] ??
                                            cycleMonthLabel(c.started_at)}
                                        </div>

                                        <span className="inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-200">
                                          {c.status?.name ?? "sem status"}
                                        </span>

                                        {c.ended_at ? (
                                          <span className="inline-flex items-center rounded-full border border-border/50 bg-card/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                                            encerrado
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                                            aberto
                                          </span>
                                        )}
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

                                    <div className="flex items-center gap-2">
                                      <Button
                                        variant="outline"
                                        className={cx(
                                          "h-10 rounded-xl",
                                          CLICKABLE,
                                          active
                                            ? "border-emerald-500/25 hover:bg-emerald-500/10"
                                            : ""
                                        )}
                                        onClick={() => setSelectedCycleId(c.id)}
                                        disabled={loading}
                                        title="Selecionar"
                                      >
                                        Selecionar
                                      </Button>

                                      <button
                                        type="button"
                                        className={cx(
                                          "inline-flex items-center justify-center rounded-xl border border-border/50 bg-background/40 p-2 text-muted-foreground transition hover:bg-background/60",
                                          CLICKABLE
                                        )}
                                        onClick={() => deleteCycle(c.id)}
                                        disabled={loading}
                                        title="Excluir ciclo"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div className="mt-3 text-[11px] text-muted-foreground">
                          Dica: se o banco bloquear exclusão por sessões
                          vinculadas, apague as runs primeiro na aba Runs.
                        </div>
                      </section>
                    </div>
                  ) : null}

                  {/* ======= TAB: RUNS ======= */}
                  {tab === "runs" ? (
                    <div className="space-y-4">
                      {/* 1) Timer */}
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
                              Timer
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {timerStateLabel}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {hasOpen ? (
                              <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                                LIVE
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-border/50 bg-card/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                                sem sessão
                              </span>
                            )}

                            <span className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm">
                              <TimerIcon size={16} className="opacity-80" />
                              <span className="font-mono">
                                {hasOpen ? "rodando" : "—"}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-border/50 bg-background/40 p-4 sm:p-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                              <div className="text-[11px] text-muted-foreground">
                                {hasOpen
                                  ? `início: ${formatDateTime(
                                      openSession?.started_at
                                    )}`
                                  : selectedCycle?.ended_at
                                  ? "ciclo encerrado — crie um novo ciclo"
                                  : "clique em “Iniciar” para abrir uma sessão"}
                              </div>

                              <div className="mt-2 font-mono text-5xl font-black tracking-tight sm:text-6xl">
                                <span className="bg-gradient-to-r from-violet-300 via-emerald-200 to-sky-200 bg-clip-text text-transparent">
                                  {bigTime}
                                </span>
                              </div>

                              <div className="mt-2 text-[11px] text-muted-foreground">
                                Uma sessão aberta por ciclo (evita dois timers
                                no mesmo ciclo).
                              </div>
                            </div>

                            <div className="w-full sm:w-[320px]">
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  className={cx(BTN_GREEN, CLICKABLE, "h-11")}
                                  onClick={startSession}
                                  disabled={
                                    !canStart || !!selectedCycle?.ended_at
                                  }
                                  title="Iniciar nova sessão (run) neste ciclo"
                                >
                                  <Play size={16} className="mr-2" />
                                  Iniciar
                                </Button>

                                <Button
                                  variant="outline"
                                  className={cx("h-11 rounded-xl", CLICKABLE)}
                                  onClick={() =>
                                    paused ? resumeTimer() : pauseTimer()
                                  }
                                  disabled={!canPause}
                                  title="Pausar/Continuar (apenas visual)"
                                >
                                  <Pause size={16} className="mr-2" />
                                  {paused ? "Voltar" : "Pausar"}
                                </Button>
                              </div>

                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <Button
                                  variant="outline"
                                  className={cx("h-11 rounded-xl", CLICKABLE)}
                                  onClick={resetTimer}
                                  disabled={loading}
                                  title="Resetar timer (apenas visual)"
                                >
                                  <RefreshCw size={16} className="mr-2" />
                                  Reset
                                </Button>

                                <Button
                                  variant="outline"
                                  className={cx("h-11 rounded-xl", CLICKABLE)}
                                  onClick={() => setTab("cycles")}
                                  disabled={loading}
                                  title="Ir para Ciclos"
                                >
                                  <RefreshCw
                                    size={16}
                                    className="mr-2 opacity-80"
                                  />
                                  Ciclos
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* 2) Anotações da sessão */}
                      <section
                        className={cx(
                          GLASS_CARD,
                          SOFT_RING,
                          "bg-background/35 p-4 sm:p-5"
                        )}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              Anotações da sessão
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Texto livre + nota (0..10). “Finalizar” salva e
                              fecha a sessão.
                            </div>
                          </div>

                          {hasOpen ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                              sessão aberta
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-border/50 bg-card/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                              sem sessão
                            </span>
                          )}
                        </div>

                        <div className="mt-4">
                          <div className={TEXTAREA_BASE}>
                            <textarea
                              className="min-h-[260px] w-full resize-none bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                              placeholder="O que rolou na sessão? Progresso, bugs, sentimento..."
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              disabled={loading}
                            />
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-[240px_1fr] sm:items-end">
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground">
                              Nota da sessão (0..10)
                            </label>
                            <div className="mt-2">
                              <div className={INPUT_BASE}>
                                <input
                                  className={INPUT_EL}
                                  value={scoreText}
                                  onChange={(e) => setScoreText(e.target.value)}
                                  placeholder="ex: 7.5"
                                  inputMode="decimal"
                                  disabled={loading}
                                />
                              </div>
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              (pode deixar em branco)
                            </div>
                          </div>

                          <div className="sm:justify-self-end">
                            <Button
                              className={cx(
                                BTN_GREEN,
                                CLICKABLE,
                                "h-11 w-full sm:w-auto px-6"
                              )}
                              onClick={finishSession}
                              disabled={loading || !hasOpen}
                              title={
                                hasOpen
                                  ? "Finalizar e salvar a sessão"
                                  : "Inicie uma sessão para finalizar"
                              }
                            >
                              <CheckCircle2 size={16} className="mr-2" />
                              Finalizar
                            </Button>
                          </div>
                        </div>

                        {!hasOpen ? (
                          <div className="mt-3 text-[11px] text-muted-foreground">
                            Dica: “Iniciar” abre a sessão (timer). Aí você
                            escreve e usa “Finalizar”.
                          </div>
                        ) : null}
                      </section>

                      {/* 3) Histórico */}
                      <section
                        className={cx(
                          GLASS_CARD,
                          SOFT_RING,
                          "bg-background/35 p-4 sm:p-5"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              Histórico do ciclo
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Últimas sessões (runs). Você pode excluir qualquer
                              uma.
                            </div>
                          </div>

                          <span className="text-[11px] text-muted-foreground">
                            {sessions.length
                              ? `${sessions.length} mostradas`
                              : "—"}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-2">
                          {sessions.length === 0 ? (
                            <div className="text-sm text-muted-foreground">
                              Ainda não tem sessões neste ciclo.
                            </div>
                          ) : (
                            sessions.map((s) => {
                              const mins = minutesBetween(
                                s.started_at,
                                s.ended_at
                              );
                              const isOpenRow = !s.ended_at;

                              return (
                                <div
                                  key={s.id}
                                  className={cx(
                                    "rounded-2xl border border-border/50 bg-card/30 p-3",
                                    isOpenRow
                                      ? "border-emerald-500/25 bg-emerald-500/5"
                                      : ""
                                  )}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <div className="text-sm font-semibold text-foreground">
                                        {isOpenRow
                                          ? "Sessão aberta"
                                          : "Sessão finalizada"}
                                      </div>
                                      {isOpenRow ? (
                                        <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                                          ao vivo
                                        </span>
                                      ) : null}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <div className="text-[11px] text-muted-foreground">
                                        {formatDateTime(s.started_at)}
                                        {s.ended_at
                                          ? ` → ${formatDateTime(s.ended_at)}`
                                          : ""}
                                        {mins != null ? ` • ${mins} min` : ""}
                                      </div>

                                      <button
                                        type="button"
                                        className={cx(
                                          "inline-flex items-center justify-center rounded-xl border border-border/50 bg-background/40 p-2 text-muted-foreground transition hover:bg-background/60",
                                          CLICKABLE
                                        )}
                                        onClick={() => deleteSession(s.id)}
                                        disabled={loading}
                                        title="Excluir sessão"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                    <span className="inline-flex items-center rounded-full border border-border/50 bg-background/40 px-2.5 py-1 font-semibold">
                                      nota{" "}
                                      <span className="ml-1 font-medium text-foreground/90">
                                        {s.score != null
                                          ? Number(s.score).toFixed(1)
                                          : "—"}
                                      </span>
                                    </span>

                                    <span className="line-clamp-1">
                                      {s.note_text?.trim()
                                        ? s.note_text.trim()
                                        : "— sem texto —"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div className="mt-4 text-[11px] text-muted-foreground">
                          Dica: quando quiser rejogar, cria um “Novo ciclo”. O
                          histórico fica por ciclo.
                        </div>
                      </section>
                    </div>
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
