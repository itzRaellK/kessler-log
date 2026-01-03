"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import {
  Clock,
  Trophy,
  XCircle,
  Gamepad2,
  Star,
  ChevronRight,
  Sparkles,
  Flame,
  ArrowUpRight,
  MessageSquareText,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

/* =========================
   Utils
========================= */

type RangeMode = "7d" | "14d" | "30d";

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function hoursToHuman(hours: number) {
  const totalMin = Math.round((hours || 0) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fmt1(v: unknown) {
  const n = typeof v === "number" ? v : v == null ? null : Number(v);
  if (n == null || Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

function toRangeDays(r: RangeMode) {
  return r === "7d" ? 7 : r === "14d" ? 14 : 30;
}

function toTimeHM(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDayKey(iso: string) {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

function dayLabelFromIso(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const t0 = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime();
  const diffDays = Math.round((t0 - d0) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";

  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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

/* =========================
   Styles (light/dark readable)
========================= */

const GLASS_CARD =
  "rounded-2xl border border-border/60 bg-card/80 shadow-xl backdrop-blur-xl " +
  "dark:border-border/50 dark:bg-card/60";

const GLASS_ITEM =
  "rounded-2xl border border-border/60 bg-card/75 shadow-xl backdrop-blur-xl " +
  "dark:border-border/50 dark:bg-card/40";

const SOFT_RING = "ring-1 ring-border/30 dark:ring-border/20";

/* =========================
   Small components
========================= */

type BadgeVariant = "emerald" | "violet" | "slate";

function MetricBadge(props: {
  variant: BadgeVariant;
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  const { variant, icon, label, value } = props;

  const cls =
    variant === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"
      : variant === "violet"
      ? "border-violet-500/30 bg-violet-500/12 text-violet-800 dark:bg-violet-500/10 dark:text-violet-200"
      : "border-border/60 bg-card/70 text-muted-foreground dark:border-border/50 dark:bg-card/40";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        "backdrop-blur-sm",
        cls
      )}
    >
      <span className="opacity-80">{icon}</span>
      <span className="opacity-80">{label}</span>
      <span className="font-bold text-foreground">{value}</span>
    </span>
  );
}

function RangePills(props: {
  value: RangeMode;
  onChange: (v: RangeMode) => void;
}) {
  const { value, onChange } = props;
  return (
    <div className="flex w-fit items-center gap-1 rounded-xl border border-border/60 bg-card/70 p-1 backdrop-blur-sm dark:border-border/50 dark:bg-card/50">
      {(["7d", "14d", "30d"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cx(
            "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
            value === m
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-pressed={value === m}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

/* =========================
   KPI Card
========================= */

function KpiCard(props: {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  accent?: "emerald" | "violet" | "blue" | "rose" | "none";
  delta?: string;
}) {
  const { title, value, icon, accent = "none", delta } = props;

  const accentCls =
    accent === "emerald"
      ? "border-emerald-500/25"
      : accent === "violet"
      ? "border-violet-500/25"
      : accent === "blue"
      ? "border-blue-500/25"
      : accent === "rose"
      ? "border-rose-500/25"
      : "border-border/60 dark:border-border/50";

  const glow =
    accent === "none"
      ? ""
      : accent === "emerald"
      ? "before:bg-emerald-500/10"
      : accent === "violet"
      ? "before:bg-violet-500/10"
      : accent === "blue"
      ? "before:bg-blue-500/10"
      : "before:bg-rose-500/10";

  return (
    <div
      className={cx(
        "relative overflow-hidden",
        "rounded-2xl border bg-card/80 p-4 shadow-xl backdrop-blur-xl dark:bg-card/50",
        SOFT_RING,
        accentCls,
        "before:absolute before:-right-20 before:-top-20 before:h-48 before:w-48 before:rounded-full before:blur-2xl before:content-['']",
        glow
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </div>
        </div>
        <div className="text-muted-foreground">{icon}</div>
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </div>
        {delta ? (
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {delta}
          </div>
        ) : null}
      </div>
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
    const count = 12;

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
      <div
        className="
          absolute inset-0 bg-[size:28px_28px]
          bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)]
          dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.035)_1px,transparent_0)]
        "
      />

      {orbs.map((o, idx) => {
        const common: CSSProperties = {
          width: o.size,
          height: o.size,
          filter: `blur(${o.blur}px)`,
          opacity: o.opacity,
          background: bgForHue(o.hue),
        };

        const orbCls =
          "absolute rounded-full [mix-blend-mode:multiply] dark:[mix-blend-mode:overlay]";

        if (reduceMotion) {
          const x = lerp(o.x0, o.x1, 0.35);
          const y = lerp(o.y0, o.y1, 0.35);
          return (
            <div
              key={o.id}
              className={orbCls}
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
              className={orbCls}
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
            className={orbCls}
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

      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/25 to-background/70 dark:from-background/10 dark:via-background/5 dark:to-background/20" />
    </div>
  );
}

/* =========================
   DB payload types
========================= */

type HomeKpis = {
  sessions: number;
  timeHours: number;
  avgSessionScore: number | null;
  avgReviewScore: number | null;
  playingNow: number;
  finished: number;
  dropped: number;
  monthHours: number;
  streakDays: number;
};

type ContinueCard = {
  cycleId: string;
  gameId: string;
  game: string;
  status: string;
  statusSlug: string | null;
  hours: number | null;
  avgSession: number | null;
  avgReview: number | null;
  lastSessionAt: string | null;
};

type TimelineKind = "SESSION_END" | "REVIEW";

type TimelineItem = {
  kind: TimelineKind;
  at: string;
  cycleId: string;
  note?: string | null;
  score?: number | null;
  ratingFinal?: number | null;
};

type CycleMini = {
  id: string;
  gameTitle: string;
  statusName: string;
  statusSlug: string | null;
};

/* =========================
   Home (DB)
========================= */

export default function HomePage() {
  const [range, setRange] = useState<RangeMode>("7d");

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [kpis, setKpis] = useState<HomeKpis>({
    sessions: 0,
    timeHours: 0,
    avgSessionScore: null,
    avgReviewScore: null,
    playingNow: 0,
    finished: 0,
    dropped: 0,
    monthHours: 0,
    streakDays: 0,
  });

  const [continueCards, setContinueCards] = useState<ContinueCard[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [cycleMap, setCycleMap] = useState<Record<string, CycleMini>>({});

  // covers pro "Continuar"
  const [coverByGameId, setCoverByGameId] = useState<
    Record<string, string | null>
  >({});

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErrMsg(null);

      const rangeDays = toRangeDays(range);

      // 1) tenta RPC (melhor abordagem)
      const rpcRes = await supabase.rpc("rpc_home_dashboard", {
        p_range_days: rangeDays,
      });

      if (rpcRes.error) {
        if (!alive) return;
        setErrMsg(
          `Falhou ao carregar via rpc_home_dashboard: ${rpcRes.error.message}. ` +
            `Crie a function no Postgres (recomendado) ou me peça um fallback 100% via selects.`
        );
        setLoading(false);
        return;
      }

      const payload = (rpcRes.data ?? {}) as any;

      const nextKpis = (payload.kpis ?? {}) as Partial<HomeKpis>;
      const nextContinue = (payload.continue ?? []) as ContinueCard[];
      const nextTimeline = (payload.timeline ?? []) as TimelineItem[];

      if (!alive) return;

      setKpis((prev) => ({
        ...prev,
        ...nextKpis,
        sessions: Number(nextKpis.sessions ?? 0),
        timeHours: Number(nextKpis.timeHours ?? 0),
        monthHours: Number(nextKpis.monthHours ?? 0),
        playingNow: Number(nextKpis.playingNow ?? 0),
        finished: Number(nextKpis.finished ?? 0),
        dropped: Number(nextKpis.dropped ?? 0),
        streakDays: Number(nextKpis.streakDays ?? 0),
        avgSessionScore:
          nextKpis.avgSessionScore == null
            ? null
            : Number(nextKpis.avgSessionScore),
        avgReviewScore:
          nextKpis.avgReviewScore == null
            ? null
            : Number(nextKpis.avgReviewScore),
      }));

      setContinueCards(Array.isArray(nextContinue) ? nextContinue : []);
      setTimeline(Array.isArray(nextTimeline) ? nextTimeline : []);

      // 2) busca covers dos jogos do "Continuar"
      const gameIds = Array.from(
        new Set(
          (Array.isArray(nextContinue) ? nextContinue : [])
            .map((c) => c.gameId)
            .filter(Boolean)
        )
      );

      if (gameIds.length) {
        const { data: gamesData, error: gamesErr } = await supabase
          .schema("kesslerlog")
          .from("games")
          .select("id, cover_url")
          .in("id", gameIds);

        if (!gamesErr && gamesData) {
          const map: Record<string, string | null> = {};
          for (const row of gamesData as any[]) {
            map[String(row.id)] = row.cover_url ?? null;
          }
          if (alive) setCoverByGameId(map);
        }
      } else {
        if (alive) setCoverByGameId({});
      }

      // 3) enriquece Timeline com game/status (via relationship)
      const cycleIds = Array.from(
        new Set(
          (Array.isArray(nextTimeline) ? nextTimeline : [])
            .map((t) => t.cycleId)
            .filter(Boolean)
        )
      );

      if (cycleIds.length) {
        const { data: cycles, error: cyclesErr } = await supabase
          .schema("kesslerlog")
          .from("game_cycles")
          .select("id, games(title), game_statuses(name,slug)")
          .in("id", cycleIds);

        if (!cyclesErr && cycles) {
          const map: Record<string, CycleMini> = {};
          for (const row of cycles as any[]) {
            map[row.id] = {
              id: row.id,
              gameTitle: row.games?.title ?? "Jogo",
              statusName: row.game_statuses?.name ?? "Status",
              statusSlug: row.game_statuses?.slug ?? null,
            };
          }
          if (alive) setCycleMap(map);
        }
      } else {
        setCycleMap({});
      }

      if (alive) setLoading(false);
    }

    load();

    return () => {
      alive = false;
    };
  }, [range]);

  const groupedTimeline = useMemo(() => {
    const groups = new Map<
      string,
      {
        label: string;
        items: Array<{
          id: string;
          when: string;
          kind: TimelineKind;
          game: string;
          title: string;
          subtitle: string;
          meta?: { score?: number; reviewAvg?: number };
        }>;
      }
    >();

    for (const t of timeline) {
      const key = toDayKey(t.at);
      const label = dayLabelFromIso(t.at);
      const game = cycleMap[t.cycleId]?.gameTitle ?? "Jogo";

      const title =
        t.kind === "SESSION_END" ? "Sessão finalizada" : "Review atualizada";

      const subtitle =
        t.kind === "SESSION_END"
          ? t.note?.trim()
            ? t.note.trim()
            : "Sessão encerrada."
          : t.ratingFinal != null
          ? "Nota final atualizada."
          : "Review/nota final atualizada.";

      const meta =
        t.kind === "SESSION_END"
          ? { score: t.score ?? undefined }
          : { reviewAvg: t.ratingFinal ?? undefined };

      const item = {
        id: `${t.kind}-${t.cycleId}-${t.at}`,
        when: toTimeHM(t.at),
        kind: t.kind,
        game,
        title,
        subtitle,
        meta,
      };

      if (!groups.has(key)) groups.set(key, { label, items: [] });
      groups.get(key)!.items.push(item);
    }

    const arr = Array.from(groups.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([, v]) => ({
        ...v,
        items: v.items.sort((a, b) => (a.when < b.when ? 1 : -1)),
      }));

    return arr;
  }, [timeline, cycleMap]);

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-background">
      <AnimatedBg />

      <div className="relative z-10 mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Home
            </h1>
            <p className="mt-1 text-sm text-muted-foreground/90">
              Seu diário de jogatinas — sessões, notas e reviews por ciclo.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <RangePills value={range} onChange={setRange} />
          </div>
        </div>

        {errMsg ? (
          <section className={cx(GLASS_CARD, SOFT_RING, "p-6")}>
            <div className="text-sm font-semibold text-foreground">Erro</div>
            <p className="mt-2 text-sm text-muted-foreground">{errMsg}</p>
          </section>
        ) : null}

        {/* KPIs */}
        <section className="space-y-3">
          <div className="grid gap-3 lg:grid-cols-5">
            <KpiCard
              title="Jogando agora"
              value={
                <span className="text-emerald-700 dark:text-emerald-300">
                  {kpis.playingNow}
                </span>
              }
              icon={<Gamepad2 size={16} />}
              accent="emerald"
            />
            <KpiCard
              title="Finalizados"
              value={kpis.finished}
              icon={<Trophy size={16} />}
              accent="none"
            />
            <KpiCard
              title="Dropados"
              value={kpis.dropped}
              icon={<XCircle size={16} />}
              accent="none"
            />
            <KpiCard
              title="Horas no mês"
              value={hoursToHuman(kpis.monthHours)}
              icon={<Clock size={16} />}
              accent="none"
            />
            <KpiCard
              title="Sessões"
              value={kpis.sessions}
              icon={<CalendarDays size={16} />}
              accent="none"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <KpiCard
              title="Média sessão"
              value={fmt1(kpis.avgSessionScore)}
              icon={<Star size={16} />}
              accent="emerald"
            />
            <KpiCard
              title="Média review"
              value={fmt1(kpis.avgReviewScore)}
              icon={<Sparkles size={16} />}
              accent="violet"
            />
            <KpiCard
              title="Streak"
              value={
                <span className="text-emerald-700 dark:text-emerald-300">
                  {kpis.streakDays} dias
                </span>
              }
              icon={<Flame size={16} />}
              accent="emerald"
            />
          </div>

          {loading ? (
            <div className="text-xs text-muted-foreground/80">Carregando…</div>
          ) : null}

          <p className="text-[11px] text-muted-foreground/70">
            *Para “Finalizados/Dropados” funcionar perfeito, padronize slugs dos
            status (ex: <span className="font-semibold">finished</span>,{" "}
            <span className="font-semibold">dropped</span>).
          </p>
        </section>

        {/* Continuar */}
        <section className={cx(GLASS_CARD, SOFT_RING, "p-6")}>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground">
              Continuar de onde parou
            </div>

            <Link
              href="/games"
              className="cursor-pointer text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
            >
              Ver todos <ChevronRight size={14} className="inline-block" />
            </Link>
          </div>

          {continueCards.length ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {continueCards.map((g) => {
                const coverUrl = coverByGameId[g.gameId] ?? null;

                return (
                  <div
                    key={g.cycleId}
                    className={cx(
                      "relative overflow-hidden",
                      // deixa altura mais consistente no grid
                      "h-full flex flex-col",
                      GLASS_ITEM,
                      SOFT_RING
                    )}
                  >
                    <div className="absolute inset-0 opacity-70">
                      <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-2xl" />
                      <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-violet-500/10 blur-2xl" />
                    </div>

                    <div className="relative">
                      {/* cover */}
                      <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border/60 bg-background/40 dark:border-border/50 dark:bg-background/20">
                        {coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={coverUrl}
                            alt={g.game}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Gamepad2 size={22} />
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-background/15 to-transparent dark:from-background/35" />
                      </div>

                      <div className="relative p-5 flex flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-foreground">
                              {g.game}
                            </div>
                            <div className="mt-0.5 truncate text-xs text-muted-foreground">
                              {g.status}
                            </div>
                          </div>

                          <span
                            className={cx(
                              "rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm",
                              g.statusSlug === "playing" ||
                                g.statusSlug === "replaying"
                                ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"
                                : g.statusSlug === "paused"
                                ? "border-amber-500/30 bg-amber-500/12 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
                                : "border-blue-500/30 bg-blue-500/12 text-blue-900 dark:bg-blue-500/10 dark:text-blue-200"
                            )}
                          >
                            {g.status}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{timeAgoShort(g.lastSessionAt)}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock size={12} className="opacity-80" />{" "}
                            {g.hours == null ? "—" : hoursToHuman(g.hours)}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <MetricBadge
                            variant="emerald"
                            icon={<Star size={12} />}
                            label="sessão"
                            value={
                              g.avgSession == null
                                ? "—"
                                : Number(g.avgSession).toFixed(1)
                            }
                          />
                          <MetricBadge
                            variant="violet"
                            icon={<Sparkles size={12} />}
                            label="review"
                            value={
                              g.avgReview == null
                                ? "—"
                                : Number(g.avgReview).toFixed(1)
                            }
                          />
                        </div>

                        <Button
                          className="mt-4 h-10 w-full cursor-pointer rounded-xl"
                          asChild
                        >
                          <Link href="/games">Continuar</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Nada em andamento ainda. Comece adicionando um jogo em{" "}
              <span className="font-semibold">Jogos</span>.
            </div>
          )}
        </section>

        {/* Timeline */}
        <section className={cx(GLASS_CARD, SOFT_RING, "p-6")}>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">
                Timeline
              </div>
              <div className="mt-1 text-xs text-muted-foreground/90">
                Últimos eventos e contexto.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <MetricBadge
                variant="slate"
                icon={<Flame size={12} />}
                label="Streak"
                value={`${kpis.streakDays}d`}
              />
              <MetricBadge
                variant="emerald"
                icon={<Star size={12} />}
                label="Sessão"
                value={fmt1(kpis.avgSessionScore)}
              />
              <MetricBadge
                variant="violet"
                icon={<Sparkles size={12} />}
                label="Review"
                value={fmt1(kpis.avgReviewScore)}
              />
            </div>
          </div>

          {groupedTimeline.length ? (
            <div className="space-y-6">
              {groupedTimeline.map((g) => (
                <div key={g.label}>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="text-xs font-semibold text-foreground">
                      {g.label}
                    </div>
                    <div className="h-px flex-1 bg-border/70 dark:bg-border/60" />
                  </div>

                  <div className="relative pl-4">
                    <div className="absolute left-1 top-1 h-full w-px bg-border/70 dark:bg-border/60" />

                    <div className="space-y-3">
                      {g.items.map((t) => {
                        const kindCfg = (() => {
                          if (t.kind === "SESSION_END")
                            return {
                              dot: "bg-emerald-600 dark:bg-emerald-400",
                              chip: (
                                <MetricBadge
                                  variant="emerald"
                                  icon={<Star size={12} />}
                                  label="Sessão"
                                  value={
                                    t.meta?.score != null
                                      ? t.meta.score.toFixed(1)
                                      : "—"
                                  }
                                />
                              ),
                            };
                          return {
                            dot: "bg-violet-600 dark:bg-violet-400",
                            chip: (
                              <MetricBadge
                                variant="violet"
                                icon={<Sparkles size={12} />}
                                label="Review"
                                value={
                                  t.meta?.reviewAvg != null
                                    ? t.meta.reviewAvg.toFixed(1)
                                    : "—"
                                }
                              />
                            ),
                          };
                        })();

                        return (
                          <div
                            key={t.id}
                            className={cx(
                              "relative overflow-hidden p-5",
                              GLASS_ITEM,
                              SOFT_RING
                            )}
                          >
                            <div
                              className={cx(
                                "absolute -left-[7px] top-6 h-3 w-3 rounded-full",
                                kindCfg.dot
                              )}
                            />

                            <div className="absolute inset-0 opacity-60">
                              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-2xl" />
                              <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-violet-500/10 blur-2xl" />
                            </div>

                            <div className="relative flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="truncate text-sm font-semibold text-foreground">
                                    {t.title}
                                  </div>
                                  <span className="text-[11px] text-muted-foreground">
                                    • {t.game}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    • {t.when}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground/90">
                                  {t.subtitle}
                                </div>
                              </div>

                              <div className="flex flex-col items-end gap-2">
                                {kindCfg.chip}
                                <button className="cursor-pointer inline-flex items-center gap-1 rounded-xl border border-border/60 bg-card/70 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground backdrop-blur-sm dark:border-border/50 dark:bg-card/50">
                                  Abrir <ArrowUpRight size={12} />
                                </button>
                              </div>
                            </div>

                            {t.kind === "SESSION_END" ? (
                              <div className="relative mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/70 px-2 py-1 backdrop-blur-sm dark:border-border/50 dark:bg-card/40">
                                  <MessageSquareText
                                    size={12}
                                    className="opacity-80"
                                  />
                                  {t.subtitle?.trim() ? "nota" : "sem nota"}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Sem eventos ainda. Finalize uma sessão para começar a alimentar a
              timeline.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
