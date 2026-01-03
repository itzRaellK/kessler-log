"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Gamepad2,
  Clock,
  ArrowUpRight,
  Search,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import {
  CycleSessionDrawer,
  type GameRow,
  type StatusRow,
} from "./components/NewSessionDrawer";

/* =========================
   Utils + Styles
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

function dtMs(v: any) {
  if (!v) return -Infinity;
  const t = new Date(String(v)).getTime();
  return Number.isFinite(t) ? t : -Infinity;
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

function cycleMonthLabel(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const m = MONTHS_PT[d.getMonth()] ?? "—";
  return `${m}/${d.getFullYear()}`;
}

const GLASS_CARD =
  "rounded-2xl border border-border/50 bg-card/60 shadow-xl backdrop-blur-xl";
const SOFT_RING = "ring-1 ring-border/20";

const BTN_GREEN =
  "cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300 shadow-sm dark:text-emerald-950";

const CLICKABLE = "cursor-pointer disabled:cursor-not-allowed";

const INPUT_WRAP = "kb-ring kb-ring-focus";
const INPUT_BASE =
  "kb-ring-inner relative h-11 w-full rounded-xl border border-border/70 bg-background/90 ring-1 ring-border/20 shadow-sm transition-all dark:border-border/50 dark:bg-background/70 dark:shadow-none";
const INPUT_EL =
  "h-11 w-full bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground";

/* =========================
   Animated BG (DNA)
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
  mode: "float" | "orbit";
};

function makeSeededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function pick<T>(rng: () => number, arr: readonly T[]) {
  return arr[Math.floor(rng() * arr.length)];
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function bgForHue(hue: Orb["hue"]) {
  if (hue === "violet")
    return "radial-gradient(circle at 30% 30%, rgba(168,85,247,0.28), transparent 60%)";
  if (hue === "emerald")
    return "radial-gradient(circle at 40% 40%, rgba(16,185,129,0.24), transparent 62%)";
  if (hue === "blue")
    return "radial-gradient(circle at 50% 45%, rgba(59,130,246,0.22), transparent 62%)";
  return "radial-gradient(circle at 45% 45%, rgba(244,63,94,0.20), transparent 62%)";
}

function AnimatedBg() {
  const reduceMotion = useReducedMotion();

  const orbs = useMemo<Orb[]>(() => {
    const rng = makeSeededRng(1337);
    const hues: Orb["hue"][] = ["violet", "emerald", "blue", "rose"];
    const list: Orb[] = [];
    const count = 10;

    for (let i = 0; i < count; i++) {
      const hue = pick(rng, hues);
      const big = rng() > 0.65;

      const size = big ? 520 + rng() * 420 : 220 + rng() * 260;
      const opacity = big ? 0.16 + rng() * 0.1 : 0.14 + rng() * 0.1;
      const blur = big ? 56 + rng() * 40 : 34 + rng() * 26;

      const fromSide = Math.floor(rng() * 4);
      const toSide = (fromSide + 2 + Math.floor(rng() * 2)) % 4;

      const start = (() => {
        if (fromSide === 0) return { x: rng() * 100, y: -18 };
        if (fromSide === 1) return { x: 118, y: rng() * 100 };
        if (fromSide === 2) return { x: rng() * 100, y: 118 };
        return { x: -18, y: rng() * 100 };
      })();

      const end = (() => {
        if (toSide === 0) return { x: rng() * 100, y: -18 };
        if (toSide === 1) return { x: 118, y: rng() * 100 };
        if (toSide === 2) return { x: rng() * 100, y: 118 };
        return { x: -18, y: rng() * 100 };
      })();

      const duration = 22 + rng() * 26;
      const delay = rng() * 8;
      const drift = 40 + rng() * 160;
      const mode: Orb["mode"] = rng() > 0.75 ? "orbit" : "float";

      list.push({
        id: `orb-${i}`,
        size,
        x0: start.x,
        y0: start.y,
        x1: end.x,
        y1: end.y,
        drift,
        duration,
        delay,
        opacity,
        blur,
        hue,
        mode,
      });
    }
    return list;
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.035)_1px,transparent_0)] bg-[size:28px_28px]" />

      {orbs.map((o, idx) => {
        const common: CSSProperties = {
          width: o.size,
          height: o.size,
          filter: `blur(${o.blur}px)`,
          opacity: o.opacity,
          background: bgForHue(o.hue),
          mixBlendMode: "overlay",
        };

        if (reduceMotion) {
          const x = lerp(o.x0, o.x1, 0.35);
          const y = lerp(o.y0, o.y1, 0.35);
          return (
            <div
              key={o.id}
              className="absolute rounded-full"
              style={{
                ...common,
                left: `${x}vw`,
                top: `${y}vh`,
                transform: "translate(-50%, -50%)",
              }}
            />
          );
        }

        if (o.mode === "orbit") {
          return (
            <motion.div
              key={o.id}
              className="absolute rounded-full"
              style={{
                ...common,
                left: `${lerp(o.x0, o.x1, 0.5)}vw`,
                top: `${lerp(o.y0, o.y1, 0.5)}vh`,
                transform: "translate(-50%, -50%)",
              }}
              animate={{
                rotate: [0, 360],
                x: [-(o.drift * 0.35), o.drift * 0.35, -(o.drift * 0.35)],
                y: [o.drift * 0.25, -(o.drift * 0.25), o.drift * 0.25],
                scale: [1, 1.06, 1],
              }}
              transition={{
                rotate: {
                  duration: o.duration * 1.25,
                  ease: "linear",
                  repeat: Infinity,
                  delay: o.delay,
                },
                x: {
                  duration: o.duration,
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: o.delay,
                },
                y: {
                  duration: o.duration * 0.9,
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: o.delay * 0.8,
                },
                scale: {
                  duration: 10 + (idx % 5) * 2,
                  ease: "easeInOut",
                  repeat: Infinity,
                },
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
   Extra Types for page
========================= */

type CycleRow = {
  id: string;
  game_id: string;
  status_id: string;
  started_at: string;
  ended_at: string | null;
  status: StatusRow | null;
};

type OpenSessionRow = {
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
  avg_score_finished: number | null;
  last_session_started_at: string | null;
};

type RecentSessionRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  score: number | null;
  note_text: string | null;
  cycle: {
    id: string;
    game: GameRow;
  } | null;
};

/* =========================
   Page
========================= */

export default function RunsPage() {
  const DEFAULT_VISIBLE = 20;
  const STEP_VISIBLE = 20;

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);

  // agora mostramos o ciclo mais novo por jogo (não só o ativo)
  const [latestCycleByGame, setLatestCycleByGame] = useState<
    Record<string, CycleRow | null>
  >({});

  const [statsByCycle, setStatsByCycle] = useState<
    Record<string, CycleStatsRow>
  >({});

  const [openSessionByCycle, setOpenSessionByCycle] = useState<
    Record<string, OpenSessionRow | null>
  >({});

  const [recentSessions, setRecentSessions] = useState<RecentSessionRow[]>([]);

  // search
  const [q, setQ] = useState("");
  const qNorm = useMemo(() => normalizeText(q), [q]);
  const [visibleLimit, setVisibleLimit] = useState(DEFAULT_VISIBLE);

  // drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerGameId, setDrawerGameId] = useState<string | null>(null);

  async function loadUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const uid = data.user?.id ?? null;
    setUserId(uid);
    return uid;
  }

  async function loadStatuses() {
    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("game_statuses")
      .select("id,name,slug,is_active")
      .order("name", { ascending: true });

    if (error) throw error;
    setStatuses((data ?? []) as any);
  }

  async function loadGames() {
    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("games")
      .select("id,title,platform,cover_url,external_url,created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    setGames((data ?? []) as any);
  }

  // pega o ciclo mais novo de cada jogo
  async function loadLatestCycles() {
    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("game_cycles")
      .select(
        `
        id, game_id, status_id, started_at, ended_at,
        status:game_statuses(id,name,slug,is_active)
      `
      )
      .order("started_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    const map: Record<string, CycleRow | null> = {};
    for (const row of (data ?? []) as any[]) {
      const gid = String(row.game_id);
      if (!map[gid]) map[gid] = row as CycleRow; // como vem ordenado desc, o primeiro é o mais novo
    }

    setLatestCycleByGame(map);
    return map;
  }

  async function loadStatsForCycles(cycleIds: string[]) {
    if (!cycleIds.length) {
      setStatsByCycle({});
      return;
    }

    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("vw_cycle_stats")
      .select("*")
      .in("cycle_id", cycleIds);

    if (error) throw error;

    const map: Record<string, CycleStatsRow> = {};
    for (const r of (data ?? []) as any[]) {
      const cid = r?.cycle_id ? String(r.cycle_id) : null;
      if (!cid) continue;

      const sessionsCount = Number(r.sessions_count_finished ?? 0) || 0;
      const totalMin = Number(r.total_minutes_finished ?? 0) || 0;

      const avgScoreRaw = r.avg_score_finished ?? null;
      const avgScore = avgScoreRaw == null ? null : Number(avgScoreRaw);

      const lastAt = r.last_session_started_at ?? null;

      map[cid] = {
        cycle_id: cid,
        sessions_count_finished: sessionsCount,
        total_minutes_finished: totalMin,
        avg_score_finished: Number.isFinite(avgScore as number)
          ? avgScore
          : null,
        last_session_started_at: lastAt,
      };
    }

    setStatsByCycle((prev) => ({ ...prev, ...map }));
  }

  async function loadOpenSessions(cycleIds: string[]) {
    if (!cycleIds.length) {
      setOpenSessionByCycle({});
      return;
    }

    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("play_sessions")
      .select("id,cycle_id,started_at,ended_at,note_text,score")
      .in("cycle_id", cycleIds)
      .is("ended_at", null);

    if (error) throw error;

    const map: Record<string, OpenSessionRow | null> = {};
    for (const id of cycleIds) map[id] = null;

    for (const s of (data ?? []) as any[]) {
      const cid = String(s.cycle_id);
      map[cid] = {
        id: String(s.id),
        cycle_id: cid,
        started_at: String(s.started_at),
        ended_at: s.ended_at ?? null,
        note_text: s.note_text ?? null,
        score: s.score == null ? null : Number(s.score),
      };
    }

    setOpenSessionByCycle(map);
  }

  async function loadRecentSessions() {
    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("play_sessions")
      .select(
        `
        id, started_at, ended_at, score, note_text,
        cycle:game_cycles(
          id,
          game:games(id,title,platform,cover_url,external_url)
        )
      `
      )
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(10);

    if (error) throw error;
    setRecentSessions((data ?? []) as any);
  }

  async function loadAll() {
    setLoading(true);
    setMsg(null);
    setVisibleLimit(DEFAULT_VISIBLE);

    try {
      const uid = userId ?? (await loadUser());
      if (!uid) throw new Error("Você precisa estar logado. Vá para /login.");

      await Promise.all([loadStatuses(), loadGames()]);
      const map = await loadLatestCycles();

      const cycleIds = Object.values(map)
        .filter(Boolean)
        .map((c) => (c as CycleRow).id);

      await Promise.all([
        loadStatsForCycles(cycleIds),
        loadOpenSessions(cycleIds),
        loadRecentSessions(),
      ]);
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  /* =========================
     Derived list
  ========================= */

  const enrichedGames = useMemo(() => {
    const list = [...games];

    list.sort((a, b) => {
      const cyA = latestCycleByGame[a.id];
      const cyB = latestCycleByGame[b.id];

      // 1) prioriza quem tem sessão aberta no ciclo mais novo
      const hasOpenA = !!(cyA?.id && openSessionByCycle[cyA.id]?.id);
      const hasOpenB = !!(cyB?.id && openSessionByCycle[cyB.id]?.id);
      if (hasOpenA !== hasOpenB) return hasOpenA ? -1 : 1;

      // 2) depois, prioriza quem tem ciclo (vs sem ciclo)
      const hasCycleA = !!cyA?.id;
      const hasCycleB = !!cyB?.id;
      if (hasCycleA !== hasCycleB) return hasCycleA ? -1 : 1;

      // 3) depois, ordena por última atividade (stats vs sessão aberta)
      const lastA = (() => {
        const cid = cyA?.id ?? null;
        const open = cid ? openSessionByCycle[cid] : null;
        const stats = cid ? statsByCycle[cid] : null;
        return dtMs(stats?.last_session_started_at ?? null) >=
          dtMs(open?.started_at ?? null)
          ? stats?.last_session_started_at
          : open?.started_at ?? null;
      })();

      const lastB = (() => {
        const cid = cyB?.id ?? null;
        const open = cid ? openSessionByCycle[cid] : null;
        const stats = cid ? statsByCycle[cid] : null;
        return dtMs(stats?.last_session_started_at ?? null) >=
          dtMs(open?.started_at ?? null)
          ? stats?.last_session_started_at
          : open?.started_at ?? null;
      })();

      const d = dtMs(lastB) - dtMs(lastA);
      if (d !== 0) return d;

      return normalizeText(a.title).localeCompare(normalizeText(b.title));
    });

    return list;
  }, [games, latestCycleByGame, openSessionByCycle, statsByCycle]);

  const filteredGames = useMemo(() => {
    if (!qNorm) return enrichedGames;
    return enrichedGames.filter((g) =>
      normalizeText(g.title ?? "").includes(qNorm)
    );
  }, [enrichedGames, qNorm]);

  const visibleGames = useMemo(() => {
    if (qNorm) return filteredGames;
    return filteredGames.slice(0, visibleLimit);
  }, [filteredGames, qNorm, visibleLimit]);

  const canShowMore = !qNorm && visibleLimit < filteredGames.length;

  /* =========================
     Effects
  ========================= */

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!qNorm) setVisibleLimit(DEFAULT_VISIBLE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qNorm]);

  /* =========================
     Render
  ========================= */

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-background">
      <AnimatedBg />

      <CycleSessionDrawer
        open={drawerOpen}
        onOpenChange={(v) => setDrawerOpen(v)}
        userId={userId}
        games={games}
        statuses={statuses}
        initialGameId={drawerGameId}
        onMutated={loadAll}
      />

      <div className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 pb-8 pt-24 sm:px-6 xl:max-w-7xl 2xl:max-w-screen-2xl">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Sessões
            </h1>
            <p className="mt-1 text-sm text-muted-foreground/90">
              Biblioteca de jogos + ciclos + runs no drawer “em foco”.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className={cx("h-10 rounded-xl", CLICKABLE)}
              onClick={loadAll}
              disabled={loading}
              title="Recarregar"
            >
              <RefreshCw size={16} className="mr-2" />
              Recarregar
            </Button>
          </div>
        </div>

        {/* Notice / Error */}
        {msg ? (
          <div
            className={cx(
              GLASS_CARD,
              SOFT_RING,
              "p-4",
              msg.toLowerCase().includes("erro") ||
                msg.toLowerCase().includes("falh")
                ? "border-destructive/40"
                : "border-emerald-500/25"
            )}
          >
            <div className="flex items-start gap-2">
              {msg.toLowerCase().includes("erro") ||
              msg.toLowerCase().includes("falh") ? (
                <AlertTriangle className="mt-0.5" size={16} />
              ) : (
                <CheckCircle2 className="mt-0.5" size={16} />
              )}
              <div className="text-sm text-muted-foreground">{msg}</div>
            </div>
          </div>
        ) : null}

        {/* Games (GRID ONLY) */}
        <section className={cx(GLASS_CARD, SOFT_RING, "p-6")}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-foreground">
              Jogos{" "}
              <span className="text-muted-foreground">({games.length})</span>
              <span className="ml-2 text-[11px] text-muted-foreground">
                {qNorm
                  ? `• resultados: ${filteredGames.length}`
                  : `• mostrando: ${Math.min(
                      visibleLimit,
                      filteredGames.length
                    )} de ${filteredGames.length}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-[11px] text-muted-foreground">
                {loading ? "Carregando…" : "Atualizado"}
              </div>

              <div className="w-[300px] max-w-[75vw]">
                <div className={INPUT_WRAP}>
                  <div className={INPUT_BASE}>
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      className={cx(INPUT_EL, "pl-9 pr-3")}
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Buscar jogo..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {visibleGames.length ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleGames.map((g) => {
                const cycle = latestCycleByGame[g.id] ?? null;
                const cid = cycle?.id ?? null;

                const openSess = cid ? openSessionByCycle[cid] ?? null : null;
                const hasOpen = !!openSess?.id && !openSess?.ended_at;

                const stats = cid ? statsByCycle[cid] : null;

                const lastAt =
                  dtMs(stats?.last_session_started_at) >=
                  dtMs(openSess?.started_at)
                    ? stats?.last_session_started_at ?? null
                    : openSess?.started_at ?? null;

                const cycleLabel = cycle
                  ? `ciclo: ${cycleMonthLabel(cycle.started_at)}${
                      cycle.ended_at ? " • encerrado" : ""
                    }`
                  : null;

                return (
                  <div
                    key={g.id}
                    className={cx(
                      "relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 shadow-xl backdrop-blur-xl",
                      SOFT_RING
                    )}
                  >
                    <div className="absolute inset-0 opacity-60">
                      <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-2xl" />
                      <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-violet-500/10 blur-2xl" />
                    </div>

                    <div className="relative">
                      <div className="aspect-[16/10] w-full overflow-hidden border-b border-border/50 bg-background/30">
                        {g.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.cover_url}
                            alt={g.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Gamepad2 size={22} />
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {g.title}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{g.platform ?? "—"}</span>

                          <span className="opacity-60">•</span>

                          {cycle ? (
                            <>
                              <span className="inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-200">
                                {cycle.status?.name ?? "status"}
                              </span>

                              <span className="inline-flex items-center rounded-full border border-border/50 bg-card/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                                {cycleLabel}
                              </span>

                              {hasOpen ? (
                                <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                                  sessão em andamento
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-border/50 bg-card/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                              sem ciclos
                            </span>
                          )}

                          <span className="opacity-60">•</span>

                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} className="opacity-80" />
                            {lastAt
                              ? `última atividade: ${timeAgoShort(lastAt)}`
                              : "—"}
                          </span>

                          {cycle &&
                          typeof stats?.total_minutes_finished === "number" ? (
                            <>
                              <span className="opacity-60">•</span>
                              <span className="text-muted-foreground">
                                {stats.total_minutes_finished} min •{" "}
                                {stats.sessions_count_finished} sessões
                              </span>
                            </>
                          ) : null}

                          {g.external_url ? (
                            <>
                              <span className="opacity-60">•</span>
                              <a
                                className="inline-flex items-center gap-1 text-emerald-500 hover:text-emerald-500"
                                href={g.external_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                abrir fonte <ArrowUpRight size={12} />
                              </a>
                            </>
                          ) : null}
                        </div>

                        <div className="mt-4">
                          <Button
                            className={cx(BTN_GREEN, CLICKABLE, "h-10 w-full")}
                            onClick={() => {
                              setDrawerGameId(g.id);
                              setDrawerOpen(true);
                            }}
                            disabled={loading}
                            title="Abrir drawer desse jogo (você escolhe o ciclo lá dentro)"
                          >
                            <Play size={16} className="mr-2" />
                            {hasOpen ? "Continuar" : "Nova Sessão"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {games.length === 0
                ? "Nenhum jogo cadastrado ainda."
                : qNorm
                ? "Nenhum resultado para sua busca."
                : "Sem itens para mostrar."}
            </div>
          )}

          {canShowMore ? (
            <div className="mt-6 flex flex-col items-center gap-2">
              <Button
                variant="outline"
                className={cx("h-11 rounded-xl", CLICKABLE)}
                onClick={() => setVisibleLimit((v) => v + STEP_VISIBLE)}
                disabled={loading}
                title="Carregar mais jogos"
              >
                Ver mais
              </Button>
              <div className="text-[11px] text-muted-foreground">
                Mostrando {Math.min(visibleLimit, filteredGames.length)} de{" "}
                {filteredGames.length}
              </div>
            </div>
          ) : null}
        </section>

        {/* Recent sessions */}
        <section className={cx(GLASS_CARD, SOFT_RING, "p-6")}>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">
              Sessões recentes{" "}
              <span className="text-muted-foreground">
                ({recentSessions.length})
              </span>
            </div>
          </div>

          {recentSessions.length ? (
            <ul className="space-y-3">
              {recentSessions.map((s) => {
                const g = s.cycle?.game ?? null;
                return (
                  <li
                    key={s.id}
                    className={cx(
                      "rounded-2xl border border-border/50 bg-card/40 p-4 backdrop-blur-xl shadow-xl",
                      SOFT_RING
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cx(
                          "shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-background/40",
                          "w-16 h-20"
                        )}
                      >
                        {g?.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={g.cover_url}
                            alt={g.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Gamepad2 size={18} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {g?.title ?? "—"}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{g?.platform ?? "—"}</span>
                          <span className="opacity-60">•</span>
                          <span>{timeAgoShort(s.started_at)}</span>
                          {s.score != null ? (
                            <>
                              <span className="opacity-60">•</span>
                              <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                                score {Number(s.score).toFixed(1)}
                              </span>
                            </>
                          ) : null}
                        </div>

                        {s.note_text ? (
                          <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                            {s.note_text}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-sm text-muted-foreground">
              Sem sessões finalizadas ainda.
            </div>
          )}
        </section>

        {!userId ? (
          <div className="text-xs text-muted-foreground/70">
            Você não está logado.{" "}
            <Link className="underline" href="/login">
              Ir para login
            </Link>
            .
          </div>
        ) : null}
      </div>
    </main>
  );
}
