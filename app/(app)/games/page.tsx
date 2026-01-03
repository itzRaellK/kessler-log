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
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Gamepad2,
  Clock,
  Search,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  Star,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import {
  GameFullDrawer,
  type ExternalRatingRow,
  type SaveGameInput,
} from "./components/GameFullDrawer";

/* =========================
   Utils + Styles
========================= */

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
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

function normalizeText(input: string) {
  return (input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const GLASS_CARD =
  "rounded-2xl border border-border/60 bg-card/80 shadow-xl backdrop-blur-xl dark:border-border/50 dark:bg-card/60";
const GLASS_ITEM =
  "rounded-2xl border border-border/60 bg-card/75 shadow-xl backdrop-blur-xl dark:border-border/50 dark:bg-card/40";

const SOFT_RING = "ring-1 ring-border/20";

const BTN_GREEN =
  "cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300 shadow-sm dark:text-emerald-950";

const BTN_GREEN_OUTLINE =
  "cursor-pointer rounded-xl border border-emerald-500/30 bg-emerald-500/12 text-emerald-900 hover:bg-emerald-500/18 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15";

const LINK_GREEN =
  "text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200";

const CLICKABLE = "cursor-pointer disabled:cursor-not-allowed";

const INPUT_WRAP = "kb-ring kb-ring-focus";
const INPUT_BASE =
  "kb-ring-inner relative h-11 w-full rounded-xl border border-border/70 bg-background/95 ring-1 ring-border/20 shadow-sm transition-all dark:border-border/50 dark:bg-background/70 dark:shadow-none";
const INPUT_EL =
  "h-11 w-full bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground";

function fmtScore(score: number, scaleMax: number) {
  const s = Number.isFinite(score) ? score : 0;
  const m = Number.isFinite(scaleMax) && scaleMax > 0 ? scaleMax : 100;

  const scoreTxt = m <= 10 ? s.toFixed(1) : String(Math.round(s));
  const maxTxt = m <= 10 ? m.toFixed(0) : String(Math.round(m));
  return `${scoreTxt}/${maxTxt}`;
}

function fmtMyScore(n: number | null | undefined) {
  if (!Number.isFinite(n as number)) return "—";
  const v = Number(n);
  if (v > 10) return String(Math.round(v));
  return v.toFixed(1);
}

function dtMs(v: any) {
  if (!v) return -Infinity;
  const t = new Date(String(v)).getTime();
  return Number.isFinite(t) ? t : -Infinity;
}

function maxIso(a: string | null | undefined, b: string | null | undefined) {
  return dtMs(a) >= dtMs(b) ? a ?? null : b ?? null;
}

/* =========================
   Small UI bits
========================= */

type ViewMode = "list" | "grid";

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="flex w-fit items-center gap-1 rounded-xl border border-border/60 bg-card/70 p-1 backdrop-blur-sm dark:border-border/50 dark:bg-card/50">
      <button
        type="button"
        onClick={() => onChange("list")}
        className={cx(
          CLICKABLE,
          "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
          value === "list"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={value === "list"}
        title="Lista"
      >
        <List size={14} />
        Lista
      </button>

      <button
        type="button"
        onClick={() => onChange("grid")}
        className={cx(
          CLICKABLE,
          "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
          value === "grid"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-pressed={value === "grid"}
        title="Cards"
      >
        <LayoutGrid size={14} />
        Cards
      </button>
    </div>
  );
}

function NotesLine({
  sessionAvg,
  finalAvg,
}: {
  sessionAvg: number | null;
  finalAvg: number | null;
}) {
  const BADGE =
    "inline-flex w-full items-center justify-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none backdrop-blur-sm";

  const EMERALD =
    "border-emerald-500/25 bg-emerald-500/12 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200";

  return (
    <div className="grid grid-cols-2 gap-2">
      <span
        className={cx(BADGE, EMERALD)}
        title="Sua nota (média das sessões) • última registrada"
      >
        <Star size={11} className="opacity-85" />
        Sessão: {fmtMyScore(sessionAvg)}
      </span>

      <span
        className={cx(BADGE, EMERALD)}
        title="Sua nota (review final) • última registrada"
      >
        <Star size={11} className="opacity-85" />
        Review: {fmtMyScore(finalAvg)}
      </span>
    </div>
  );
}

function ExternalRatingsGrid({ ratings }: { ratings: ExternalRatingRow[] }) {
  const sorted = [...(ratings ?? [])].sort(
    (a, b) => dtMs(b.retrieved_at) - dtMs(a.retrieved_at)
  );

  const top = sorted.slice(0, 4);
  const extra = Math.max(0, sorted.length - top.length);

  const slots: Array<ExternalRatingRow | { id: string; __more: true }> = [
    ...top,
  ];
  if (extra > 0 && slots.length === 4) {
    slots[3] = { id: `more-${extra}`, __more: true };
  }

  const BADGE =
    "flex min-w-0 items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none backdrop-blur-sm";

  const VIOLET =
    "border-violet-500/25 bg-violet-500/12 text-violet-900 dark:bg-violet-500/10 dark:text-violet-200";

  if (!slots.length) {
    return (
      <div className="rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[10px] text-muted-foreground dark:border-border/50 dark:bg-card/40">
        Sem reviews externas.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {slots.map((r) => {
        const isMore = (r as any).__more;
        if (isMore) {
          return (
            <div
              key={(r as any).id}
              className={cx(
                "flex items-center justify-center rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none",
                "border-violet-500/20 bg-violet-500/12 text-violet-900 dark:bg-violet-500/10 dark:text-violet-200"
              )}
              title="Mais reviews externas"
            >
              +{extra}
            </div>
          );
        }

        const rr = r as ExternalRatingRow;

        return (
          <div
            key={rr.id}
            title={rr.url ?? undefined}
            className={cx(BADGE, VIOLET)}
          >
            <Star size={11} className="opacity-85 shrink-0" />
            <span className="min-w-0 truncate">{rr.source.toUpperCase()}</span>
            <span className="ml-auto shrink-0 opacity-95">
              {fmtScore(rr.score, rr.scale_max)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

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
      const opacity = big ? 0.14 + rng() * 0.08 : 0.12 + rng() * 0.08;
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.03)_1px,transparent_0)] bg-[size:28px_28px]" />

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
   DB Types
========================= */

type GameRow = {
  id: string;
  title: string;
  platform: string | null;
  cover_url: string | null;

  external_source: string | null;
  external_id: string | null;
  external_url: string | null;

  created_at: string;
};

type RatingsByGame = Record<string, ExternalRatingRow[]>;

type MyNotesByGame = Record<
  string,
  {
    session_avg: number | null;
    final_review_avg: number | null;
    session_at: string | null;
    final_at: string | null;
  }
>;

/* =========================
   Page
========================= */

export default function GamesPage() {
  const DEFAULT_VISIBLE = 20;
  const STEP_VISIBLE = 20;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const qFromUrl = searchParams.get("q") ?? "";
  const gameIdFromUrl = searchParams.get("gameId");

  const openedOnce = useRef(false);

  const [rows, setRows] = useState<GameRow[]>([]);
  const [ratingsByGame, setRatingsByGame] = useState<RatingsByGame>({});

  const [myNotesByGame, setMyNotesByGame] = useState<MyNotesByGame>({});

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerGame, setDrawerGame] = useState<GameRow | null>(null);

  const [q, setQ] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [visibleLimit, setVisibleLimit] = useState(DEFAULT_VISIBLE);

  // injeta q vindo da URL
  useEffect(() => {
    setQ(qFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qFromUrl]);

  const qNorm = useMemo(() => normalizeText(q), [q]);

  const filteredRows = useMemo(() => {
    if (!qNorm) return rows;
    return rows.filter((g) => normalizeText(g.title ?? "").includes(qNorm));
  }, [rows, qNorm]);

  const visibleRows = useMemo(() => {
    if (qNorm) return filteredRows;
    return filteredRows.slice(0, visibleLimit);
  }, [filteredRows, qNorm, visibleLimit]);

  const canShowMore = !qNorm && visibleLimit < filteredRows.length;

  function openCreateDrawer() {
    setMsg(null);
    setDrawerGame(null);
    setDrawerOpen(true);
  }

  function openFullDrawer(g: GameRow) {
    setMsg(null);
    setDrawerGame(g);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerGame(null);
  }

  async function loadUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const uid = data.user?.id ?? null;
    setUserId(uid);
    return uid;
  }

  async function loadGames() {
    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("games")
      .select(
        "id,title,platform,cover_url,external_source,external_id,external_url,created_at"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    setRows((data ?? []) as GameRow[]);
  }

  async function loadRatings() {
    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("external_ratings")
      .select("id,game_id,source,score,scale_max,url,retrieved_at")
      .order("source", { ascending: true })
      .order("retrieved_at", { ascending: false });

    if (error) throw error;

    const map: RatingsByGame = {};
    for (const r of (data ?? []) as any[]) {
      const gid = r.game_id as string;
      (map[gid] ??= []).push({
        id: r.id,
        game_id: gid,
        source: r.source,
        score: Number(r.score),
        scale_max: Number(r.scale_max),
        url: r.url ?? null,
        retrieved_at: r.retrieved_at,
      });
    }
    setRatingsByGame(map);
  }

  async function loadMyNotesSafe() {
    try {
      const sessMap: Record<string, { v: number; at: string | null }> = {};
      try {
        const { data, error } = await supabase
          .schema("kesslerlog")
          .from("vw_cycle_stats")
          .select("*");

        if (!error) {
          for (const row of (data ?? []) as any[]) {
            const gid = row?.game_id as string | undefined;
            if (!gid) continue;

            const avg = Number(
              row?.avg_score ??
                row?.avg_session_score ??
                row?.avg_score_sessions ??
                row?.avg_score_value
            );

            if (!Number.isFinite(avg)) continue;

            const at = (row?.last_session_started_at ??
              row?.last_session_at ??
              row?.last_session_started ??
              row?.updated_at ??
              row?.created_at ??
              null) as string | null;

            const prev = sessMap[gid];
            if (!prev || dtMs(at) > dtMs(prev.at)) {
              sessMap[gid] = { v: avg, at };
            }
          }
        }
      } catch {
        // ignore
      }

      const finalMap: Record<string, { v: number; at: string | null }> = {};
      try {
        const { data, error } = await supabase
          .schema("kesslerlog")
          .from("game_cycles")
          .select("*")
          .not("ended_at", "is", null);

        if (!error) {
          for (const row of (data ?? []) as any[]) {
            const gid = row?.game_id as string | undefined;
            if (!gid) continue;

            const candidate =
              row?.final_review_avg ??
              row?.final_review_score ??
              row?.review_score ??
              row?.final_score ??
              row?.score_final ??
              row?.nota_final ??
              null;

            const v = Number(candidate);
            if (!Number.isFinite(v)) continue;

            const at = (row?.reviewed_at ??
              row?.ended_at ??
              row?.updated_at ??
              row?.created_at ??
              null) as string | null;

            const prev = finalMap[gid];
            if (!prev || dtMs(at) > dtMs(prev.at)) {
              finalMap[gid] = { v, at };
            }
          }
        }
      } catch {
        // ignore
      }

      const merged: MyNotesByGame = {};
      const gids = new Set([...Object.keys(sessMap), ...Object.keys(finalMap)]);

      for (const gid of gids) {
        merged[gid] = {
          session_avg: sessMap[gid]?.v ?? null,
          final_review_avg: finalMap[gid]?.v ?? null,
          session_at: sessMap[gid]?.at ?? null,
          final_at: finalMap[gid]?.at ?? null,
        };
      }

      setMyNotesByGame(merged);
    } catch {
      setMyNotesByGame({});
    }
  }

  async function loadAll() {
    setLoading(true);
    setMsg(null);
    setVisibleLimit(DEFAULT_VISIBLE);

    try {
      const uid = userId ?? (await loadUser());
      if (!uid) throw new Error("Você precisa estar logado. Vá para /login.");

      await Promise.all([loadGames(), loadRatings()]);
      loadMyNotesSafe();
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  async function saveGameFromDrawer(
    input: SaveGameInput,
    editingId: string | null
  ): Promise<{ ok: boolean; gameId?: string; gameTitle?: string }> {
    setLoading(true);
    setMsg(null);

    try {
      const uid = userId ?? (await loadUser());
      if (!uid) throw new Error("Você precisa estar logado. Vá para /login.");

      if (editingId) {
        const { error } = await supabase
          .schema("kesslerlog")
          .from("games")
          .update(input)
          .eq("id", editingId);

        if (error) throw error;

        setDrawerGame((prev) =>
          prev && prev.id === editingId
            ? {
                ...prev,
                title: input.title,
                platform: input.platform,
                cover_url: input.cover_url,
                external_source: input.external_source,
                external_id: input.external_id,
                external_url: input.external_url,
              }
            : prev
        );

        await loadGames();
        loadMyNotesSafe();
        setMsg("Jogo atualizado ✅");

        if (!qNorm) setVisibleLimit(DEFAULT_VISIBLE);
        return { ok: true, gameId: editingId, gameTitle: input.title };
      }

      const { data, error } = await supabase
        .schema("kesslerlog")
        .from("games")
        .insert({ user_id: uid, ...input })
        .select(
          "id,title,platform,cover_url,external_source,external_id,external_url,created_at"
        )
        .single();

      if (error) throw error;

      const created = data as GameRow;

      setDrawerGame(created);

      await loadGames();
      loadMyNotesSafe();
      setMsg("Jogo adicionado ✅");

      if (!qNorm) setVisibleLimit(DEFAULT_VISIBLE);
      return { ok: true, gameId: created.id, gameTitle: created.title };
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao salvar jogo");
      return { ok: false };
    } finally {
      setLoading(false);
    }
  }

  async function upsertExternalRatingForGame(
    gameId: string,
    input: {
      source: string;
      score: number;
      scale_max: number;
      url: string | null;
    }
  ): Promise<boolean> {
    setLoading(true);
    setMsg(null);

    try {
      const uid = userId ?? (await loadUser());
      if (!uid) throw new Error("Você precisa estar logado. Vá para /login.");

      const payload = {
        user_id: uid,
        game_id: gameId,
        source: input.source.trim().toLowerCase(),
        score: input.score,
        scale_max: input.scale_max,
        url: input.url,
        retrieved_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .schema("kesslerlog")
        .from("external_ratings")
        .upsert(payload, { onConflict: "user_id,game_id,source" });

      if (error) throw error;

      await loadRatings();
      setMsg("Avaliação externa salva ✅");
      return true;
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao salvar avaliação externa");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function deleteExternalRatingForGame(
    gameId: string,
    ratingId: string
  ): Promise<boolean> {
    setLoading(true);
    setMsg(null);

    try {
      const uid = userId ?? (await loadUser());
      if (!uid) throw new Error("Você precisa estar logado. Vá para /login.");

      const { error } = await supabase
        .schema("kesslerlog")
        .from("external_ratings")
        .delete()
        .eq("id", ratingId);

      if (error) throw error;

      await loadRatings();
      setMsg("Avaliação externa excluída ✅");
      return true;
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao excluir avaliação externa");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function deleteGame(gameId: string, titleForConfirm: string) {
    const ok = window.confirm(
      `Excluir "${titleForConfirm}"?\n\nIsso vai apagar também ciclos, sessões e avaliações externas vinculadas a esse jogo.`
    );
    if (!ok) return;

    setLoading(true);
    setMsg(null);

    try {
      const uid = userId ?? (await loadUser());
      if (!uid) throw new Error("Você precisa estar logado. Vá para /login.");

      const { error } = await supabase
        .schema("kesslerlog")
        .from("games")
        .delete()
        .eq("id", gameId);

      if (error) throw error;

      if (drawerGame?.id === gameId) closeDrawer();

      await Promise.all([loadGames(), loadRatings()]);
      loadMyNotesSafe();

      setMsg("Jogo excluído ✅");
      if (!qNorm) setVisibleLimit(DEFAULT_VISIBLE);
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao excluir jogo");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!qNorm) setVisibleLimit(DEFAULT_VISIBLE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qNorm]);

  // abre o drawer se vier gameId na URL (e remove gameId depois)
  useEffect(() => {
    if (openedOnce.current) return;
    if (!gameIdFromUrl) return;

    const g = rows.find((x) => x.id === gameIdFromUrl);
    if (!g) return;

    openFullDrawer(g);
    openedOnce.current = true;

    const p = new URLSearchParams(searchParams.toString());
    p.delete("gameId");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameIdFromUrl, rows]);

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-background">
      <AnimatedBg />

      <div className="relative z-10 mx-auto max-w-6xl space-y-6 px-4 pb-8 pt-24 sm:px-6 xl:max-w-7xl 2xl:max-w-screen-2xl">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Jogos
            </h1>
            <p className="mt-1 text-sm text-muted-foreground/90">
              Cadastre jogos e acompanhe suas métricas (notas e reviews).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle value={viewMode} onChange={setViewMode} />

            <Button
              className={cx(BTN_GREEN, CLICKABLE, "h-10")}
              onClick={openCreateDrawer}
              disabled={loading}
              title="Cadastrar novo jogo"
            >
              <Plus size={16} className="mr-2" />
              Adicionar jogo
            </Button>

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
              <div className="text-sm text-foreground/75 dark:text-muted-foreground">
                {msg}
              </div>
            </div>
          </div>
        ) : null}

        {/* List / Grid */}
        <section className={cx(GLASS_CARD, SOFT_RING, "p-6")}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-foreground">
              Seus jogos{" "}
              <span className="text-muted-foreground">({rows.length})</span>
              <span className="ml-2 text-[11px] text-muted-foreground">
                {qNorm
                  ? `• resultados: ${filteredRows.length}`
                  : `• mostrando: ${Math.min(
                      visibleLimit,
                      filteredRows.length
                    )} de ${filteredRows.length}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-[11px] text-muted-foreground">
                {loading ? "Carregando…" : "Atualizado"}
              </div>

              <div className="w-[260px] max-w-[70vw]">
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
                      placeholder="Buscar jogo... (sem acentos)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {visibleRows.length ? (
            viewMode === "list" ? (
              <ul className="space-y-3">
                {visibleRows.map((g) => {
                  const ratings = ratingsByGame[g.id] ?? [];
                  const mySess = myNotesByGame[g.id]?.session_avg ?? null;
                  const myFinal = myNotesByGame[g.id]?.final_review_avg ?? null;

                  const lastAt = maxIso(
                    myNotesByGame[g.id]?.session_at ?? null,
                    myNotesByGame[g.id]?.final_at ?? null
                  );

                  return (
                    <li
                      key={g.id}
                      className={cx(
                        "relative overflow-hidden p-4",
                        GLASS_ITEM,
                        SOFT_RING
                      )}
                    >
                      <div className="absolute inset-0 opacity-60">
                        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-2xl" />
                        <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-violet-500/10 blur-2xl" />
                      </div>

                      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        {/* esquerda */}
                        <div className="flex items-start gap-4">
                          <div
                            className={cx(
                              "shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-background/55 dark:border-border/50 dark:bg-background/40",
                              "w-20 h-28 sm:w-24 sm:h-36 lg:w-28 lg:h-40"
                            )}
                          >
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

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-foreground">
                              {g.title}
                            </div>

                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              <span>{g.platform ?? "—"}</span>

                              {g.external_source ? (
                                <>
                                  <span className="opacity-60">•</span>
                                  <span className="inline-flex items-center gap-1">
                                    <span className="font-semibold">
                                      {g.external_source}
                                    </span>
                                    {g.external_id ? (
                                      <span className="opacity-80">
                                        ({g.external_id})
                                      </span>
                                    ) : null}
                                  </span>
                                </>
                              ) : null}

                              <span className="opacity-60">•</span>

                              <span className="inline-flex items-center gap-1">
                                <Clock size={12} className="opacity-80" />
                                {lastAt
                                  ? `última atividade: ${timeAgoShort(lastAt)}`
                                  : `adicionado: ${timeAgoShort(g.created_at)}`}
                              </span>

                              {g.external_url ? (
                                <>
                                  <span className="opacity-60">•</span>
                                  <a
                                    className={cx(
                                      "inline-flex items-center gap-1 text-[11px] font-semibold",
                                      LINK_GREEN
                                    )}
                                    href={g.external_url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    abrir fonte <ArrowUpRight size={12} />
                                  </a>
                                </>
                              ) : null}
                            </div>

                            <div className="mt-3 space-y-2">
                              <NotesLine
                                sessionAvg={mySess}
                                finalAvg={myFinal}
                              />
                              <ExternalRatingsGrid ratings={ratings} />
                            </div>
                          </div>
                        </div>

                        {/* direita (ações) */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            className={cx(
                              "h-10 rounded-xl",
                              CLICKABLE,
                              "border-emerald-500/25 hover:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                            )}
                            onClick={() => openFullDrawer(g)}
                            disabled={loading}
                            title="Editar"
                          >
                            <Pencil size={16} className="mr-2" />
                            Editar
                          </Button>

                          <Button
                            variant="outline"
                            className={cx(
                              "h-10 rounded-xl",
                              CLICKABLE,
                              "border-destructive/30 hover:bg-destructive/10"
                            )}
                            onClick={() => deleteGame(g.id, g.title)}
                            disabled={loading}
                            title="Excluir"
                          >
                            <Trash2 size={16} className="mr-2" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleRows.map((g) => {
                  const ratings = ratingsByGame[g.id] ?? [];
                  const mySess = myNotesByGame[g.id]?.session_avg ?? null;
                  const myFinal = myNotesByGame[g.id]?.final_review_avg ?? null;

                  const lastAt = maxIso(
                    myNotesByGame[g.id]?.session_at ?? null,
                    myNotesByGame[g.id]?.final_at ?? null
                  );

                  return (
                    <div
                      key={g.id}
                      className={cx(
                        "relative overflow-hidden",
                        GLASS_ITEM,
                        SOFT_RING
                      )}
                    >
                      <div className="absolute inset-0 opacity-60">
                        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-2xl" />
                        <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-violet-500/10 blur-2xl" />
                      </div>

                      <div className="relative">
                        <div className="aspect-[16/10] w-full overflow-hidden border-b border-border/60 bg-background/55 dark:border-border/50 dark:bg-background/30">
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

                          <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-background/10 to-transparent dark:from-background/35" />
                        </div>

                        <div className="p-4">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {g.title}
                          </div>

                          <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                            {g.platform ? `${g.platform} • ` : ""}
                            {lastAt
                              ? `última atividade: ${timeAgoShort(lastAt)}`
                              : `adicionado: ${timeAgoShort(g.created_at)}`}
                            {g.external_source ? ` • ${g.external_source}` : ""}
                          </div>

                          <div className="mt-3 space-y-2">
                            {g.external_url ? (
                              <a
                                className={cx(
                                  "inline-flex items-center gap-1 text-[11px] font-semibold",
                                  LINK_GREEN
                                )}
                                href={g.external_url}
                                target="_blank"
                                rel="noreferrer"
                                title="Abrir fonte externa"
                              >
                                Fonte <ArrowUpRight size={12} />
                              </a>
                            ) : null}

                            <NotesLine sessionAvg={mySess} finalAvg={myFinal} />
                            <ExternalRatingsGrid ratings={ratings} />
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className={cx(
                                "h-9 rounded-xl text-xs",
                                CLICKABLE,
                                "border-emerald-500/25 hover:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                              )}
                              onClick={() => openFullDrawer(g)}
                              disabled={loading}
                              title="Editar"
                            >
                              <Pencil size={14} className="mr-1" />
                              Editar
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className={cx(
                                "h-9 rounded-xl text-xs",
                                CLICKABLE,
                                "border-destructive/30 hover:bg-destructive/10"
                              )}
                              onClick={() => deleteGame(g.id, g.title)}
                              disabled={loading}
                              title="Excluir"
                            >
                              <Trash2 size={14} className="mr-1" />
                              Excluir
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            <div className="text-sm text-muted-foreground">
              {rows.length === 0
                ? "Nenhum jogo cadastrado ainda."
                : qNorm
                ? "Nenhum resultado para sua busca."
                : "Sem itens para mostrar."}
            </div>
          )}

          {/* Ver mais (somente quando NÃO está buscando) */}
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
                Mostrando {Math.min(visibleLimit, filteredRows.length)} de{" "}
                {filteredRows.length}
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
          </div>
        ) : null}
      </div>

      {/* =========================
          Drawer Único: Cadastro completo
      ========================= */}
      <GameFullDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        game={
          drawerGame
            ? {
                id: drawerGame.id,
                title: drawerGame.title,
                platform: drawerGame.platform,
                cover_url: drawerGame.cover_url,
                external_source: drawerGame.external_source,
                external_id: drawerGame.external_id,
                external_url: drawerGame.external_url,
              }
            : null
        }
        ratings={drawerGame ? ratingsByGame[drawerGame.id] ?? [] : []}
        loading={loading}
        msg={msg}
        onSaveGame={saveGameFromDrawer}
        onUpsertRating={upsertExternalRatingForGame}
        onDeleteRating={deleteExternalRatingForGame}
      />
    </main>
  );
}
