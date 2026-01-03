"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Gamepad2,
  Search,
  ArrowUpRight,
  Star,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { ReviewDrawer } from "./components/ReviewDrawer";

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

const GLASS_CARD =
  "rounded-2xl border border-border/50 bg-card/60 shadow-xl backdrop-blur-xl";
const SOFT_RING = "ring-1 ring-border/20";

const BTN_GREEN =
  "cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300 shadow-sm dark:text-emerald-950";

const BTN_VIOLET =
  "cursor-pointer rounded-xl bg-gradient-to-r from-violet-500 to-violet-400 text-violet-950 hover:from-violet-400 hover:to-violet-300 shadow-sm dark:text-violet-950";

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
   Types
========================= */

type StatusRow = {
  id: string;
  name: string;
  slug: string | null;
  is_active?: boolean | null;
};

type GameRow = {
  id: string;
  title: string;
  platform: string | null;
  cover_url: string | null;
  external_url: string | null;
  created_at?: string | null;
};

type CycleRow = {
  id: string;
  game_id: string;
  status_id: string;
  started_at: string;
  ended_at: string | null;
  review_text: string | null;
  rating_final: number | null;
  status: StatusRow | null;
};

/* =========================
   Page
========================= */

export default function ReviewsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const qFromUrl = searchParams.get("q") ?? "";
  const gameIdFromUrl = searchParams.get("gameId");
  const openedOnce = useRef(false);

  const DEFAULT_VISIBLE = 20;
  const STEP_VISIBLE = 20;

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [latestCycleByGame, setLatestCycleByGame] = useState<
    Record<string, CycleRow | null>
  >({});

  // search
  const [q, setQ] = useState("");
  const qNorm = useMemo(() => normalizeText(q), [q]);
  const [visibleLimit, setVisibleLimit] = useState(DEFAULT_VISIBLE);

  // drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerGameId, setDrawerGameId] = useState<string | null>(null);

  // injeta q vindo da URL (Topbar / links)
  useEffect(() => {
    setQ(qFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qFromUrl]);

  function setQAndUrl(next: string) {
    setQ(next);

    const p = new URLSearchParams(searchParams.toString());
    const cleaned = next?.trim() ?? "";
    if (cleaned) p.set("q", next);
    else p.delete("q");

    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // abre o drawer se vier gameId na URL (e remove gameId depois)
  useEffect(() => {
    if (openedOnce.current) return;
    if (!gameIdFromUrl) return;

    setDrawerGameId(gameIdFromUrl);
    setDrawerOpen(true);
    openedOnce.current = true;

    const p = new URLSearchParams(searchParams.toString());
    p.delete("gameId");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameIdFromUrl]);

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

  async function loadLatestCycles() {
    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("game_cycles")
      .select(
        `
        id, game_id, status_id, started_at, ended_at,
        review_text, rating_final,
        status:game_statuses(id,name,slug,is_active)
      `
      )
      .order("started_at", { ascending: false })
      .limit(800);

    if (error) throw error;

    const map: Record<string, CycleRow | null> = {};
    for (const row of (data ?? []) as any[]) {
      const gid = String(row.game_id);
      if (!map[gid]) map[gid] = row as CycleRow; // primeiro é o mais novo
    }

    setLatestCycleByGame(map);
  }

  async function loadAll() {
    setLoading(true);
    setMsg(null);
    setVisibleLimit(DEFAULT_VISIBLE);

    try {
      const uid = userId ?? (await loadUser());
      if (!uid) throw new Error("Você precisa estar logado. Vá para /login.");

      await Promise.all([loadStatuses(), loadGames()]);
      await loadLatestCycles();
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

      // 1) prioriza ciclos abertos (ended_at null)
      const openA = !!cyA?.id && !cyA?.ended_at;
      const openB = !!cyB?.id && !cyB?.ended_at;
      if (openA !== openB) return openA ? -1 : 1;

      // 2) prioriza quem já tem review (texto ou nota)
      const hasRevA = !!(cyA?.review_text?.trim() || cyA?.rating_final != null);
      const hasRevB = !!(cyB?.review_text?.trim() || cyB?.rating_final != null);
      if (hasRevA !== hasRevB) return hasRevA ? -1 : 1;

      // 3) ordena por data do ciclo mais recente (started_at)
      const da = cyA?.started_at
        ? new Date(cyA.started_at).getTime()
        : -Infinity;
      const db = cyB?.started_at
        ? new Date(cyB.started_at).getTime()
        : -Infinity;
      const d = db - da;
      if (d !== 0) return d;

      return normalizeText(a.title).localeCompare(normalizeText(b.title));
    });

    return list;
  }, [games, latestCycleByGame]);

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

  const isMsgError =
    !!msg &&
    (msg.toLowerCase().includes("erro") ||
      msg.toLowerCase().includes("falh") ||
      msg.toLowerCase().includes("exception"));

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-background">
      <AnimatedBg />

      <ReviewDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        userId={userId}
        games={games as any}
        statuses={statuses as any}
        initialGameId={drawerGameId}
        onMutated={loadAll}
      />

      <div className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 pb-8 pt-24 sm:px-6 xl:max-w-7xl 2xl:max-w-screen-2xl">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Reviews
            </h1>
            <p className="mt-1 text-sm text-muted-foreground/90">
              Escreva a review final, dê a nota e encerre o ciclo do jogo (no
              drawer).
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
              isMsgError ? "border-destructive/40" : "border-emerald-500/25"
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

        {/* Search + Grid */}
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

              <div className="w-[320px] max-w-[75vw]">
                <div className={INPUT_WRAP}>
                  <div className={INPUT_BASE}>
                    <Search
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <input
                      className={cx(INPUT_EL, "pl-9 pr-3")}
                      value={q}
                      onChange={(e) => setQAndUrl(e.target.value)}
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

                const hasCycle = !!cycle?.id;
                const ended = !!cycle?.ended_at;
                const hasReview = !!(
                  cycle?.review_text?.trim() || cycle?.rating_final != null
                );

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

                          {hasCycle ? (
                            <>
                              <span className="inline-flex items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-200">
                                {cycle?.status?.name ?? "status"}
                              </span>

                              {ended ? (
                                <span className="inline-flex items-center rounded-full border border-border/50 bg-card/40 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                                  encerrado
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                                  aberto
                                </span>
                              )}

                              {hasReview ? (
                                <span className="inline-flex items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold text-sky-200">
                                  review
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
                            <Star size={12} className="opacity-80" />
                            {cycle?.rating_final != null
                              ? Number(cycle.rating_final).toFixed(1)
                              : "—"}
                          </span>

                          {cycle?.started_at ? (
                            <>
                              <span className="opacity-60">•</span>
                              <span>
                                ciclo: {formatDateShort(cycle.started_at)}{" "}
                                {cycle.ended_at
                                  ? `→ ${formatDateShort(cycle.ended_at)}`
                                  : ""}
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

                        {cycle?.review_text?.trim() ? (
                          <div className="mt-3 line-clamp-3 text-xs text-muted-foreground">
                            {cycle.review_text.trim()}
                          </div>
                        ) : (
                          <div className="mt-3 text-xs text-muted-foreground/70">
                            {hasCycle
                              ? "Sem review ainda. Clique em “Abrir review”."
                              : "Sem ciclo ainda. Crie um ciclo na tela de Sessões."}
                          </div>
                        )}

                        <div className="mt-4 grid gap-2">
                          <Button
                            className={cx(
                              ended ? BTN_VIOLET : BTN_GREEN,
                              CLICKABLE,
                              "h-10 w-full"
                            )}
                            onClick={() => {
                              setDrawerGameId(g.id);
                              setDrawerOpen(true);
                            }}
                            disabled={loading}
                            title="Abrir drawer de review (você escolhe o ciclo lá dentro)"
                          >
                            <FileText size={16} className="mr-2" />
                            {hasReview ? "Abrir review" : "Escrever review"}
                          </Button>

                          {!hasCycle ? (
                            <div className="text-[11px] text-muted-foreground">
                              Precisa de ciclo:{" "}
                              <Link className="underline" href="/runs">
                                ir para Sessões
                              </Link>
                              .
                            </div>
                          ) : null}

                          {cycle?.started_at ? (
                            <div className="text-[11px] text-muted-foreground">
                              última ação:{" "}
                              {timeAgoShort(cycle.ended_at ?? cycle.started_at)}
                            </div>
                          ) : null}
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
