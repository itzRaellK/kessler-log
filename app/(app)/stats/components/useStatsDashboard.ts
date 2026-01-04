"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/* =========================
   Types
========================= */

export type PeriodPreset = "last30" | "last90" | "month" | "year" | "all";

export type StatsFilters = {
  period: PeriodPreset;
  q: string; // filtro por título (server-side)
  gameId: string | null;
  statusId: string | null;
  month: number | null; // 1..12 (só quando period="month")
  year: number | null; // (quando period="month" | "year")
};

export type StatusOption = { id: string; name: string; slug: string | null };
export type GameOption = {
  id: string;
  title: string;
  platform: string | null;
  cover_url: string | null;
};

export type FeedRow = {
  cycle_id: string;
  game_id: string;
  game_title: string;
  platform: string | null;
  cover_url: string | null;

  status_id: string;
  status_name: string | null;

  started_at: string;
  ended_at: string | null;

  rating_final: number | null;
  review_text: string | null;

  sessions_count_finished: number | null;
  total_minutes_finished: number | null;
  avg_score_finished: number | null;
  last_session_started_at: string | null;
};

export type CycleRow = {
  cycle_id: string;
  game_id: string;
  game_title: string;

  status_id: string;
  status_name: string | null;

  started_at: string;
  ended_at: string | null;

  rating_final: number | null;
  review_text: string | null;

  sessions_count_finished: number | null;
  total_minutes_finished: number | null;
  avg_session_minutes_finished: number | null;
  avg_score_finished: number | null;

  last_session_started_at: string | null; // ✅ p/ “últimos jogos do mês”
};

export type ExternalRatingRow = {
  game_id: string;
  source: string | null;
  score_0_10: number | null;
  url: string | null;
  retrieved_at: string | null;
};

export type DashboardKpis = {
  cycles: number;
  openCycles: number;

  ratedCycles: number;
  avgFinalRating: number | null; // aqui é “média das reviews” (rating_final)
  lastFinalRating: number | null;

  finishedSessions: number;
  avgSessionScore: number | null; // ponderada por qtd de sessões
  avgSessionMinutes: number | null; // ponderada por qtd de sessões

  reviewsWritten: number;
  avgReviewedFinalRating: number | null;

  // (vamos parar de usar isso na UI depois; por enquanto não quebra)
  externalRatingsCount: number;
  externalRatings: Array<{ label: string; score: number; url: string | null }>;

  totalMinutes: number;
};

export type RecentRatingPoint = {
  label: string;
  rating_final: number;
  avg_score_finished: number | null;
  external_rating: number | null;
};

export type TimelinePoint = {
  ts: number;
  rating_final: number;
  avg_score_finished: number | null;
  external_rating: number | null;
};

export type TopTimePoint = {
  game_title: string;
  minutes: number;
};

/* =========================
   ✅ Novos datasets (pra sua nova página)
========================= */

export type HoursByMonthGame = {
  game_id: string;
  title: string;
  minutes: number;
  hours: number;
  percent: number; // 0..100
};

export type HoursByMonthPoint = {
  month: number; // 1..12
  label: string; // "Jan"
  minutes: number;
  hours: number;
  games: HoursByMonthGame[]; // breakdown p/ tooltip
};

export type DonutGamePoint = {
  game_id: string;
  title: string;
  minutes: number;
  hours: number;
  percent: number; // 0..100

  avg_review: number | null; // média do rating_final (reviews)
  avg_session_score: number | null; // ponderado por sessions_count_finished
  external_rating: number | null; // latest external por jogo (0..10)
};

export type DonutMonthData = {
  year: number;
  month: number;
  label: string; // "Jan/2026"
  totalMinutes: number;
  games: DonutGamePoint[];
};

export type DashboardData = {
  kpis: DashboardKpis;

  // antigos (mantidos por compat)
  recentRatings: RecentRatingPoint[];
  timeline: TimelinePoint[];
  topTimeByGame: TopTimePoint[];

  // ✅ novos
  hoursByMonth: HoursByMonthPoint[]; // barras por mês no ano
  donutMonth: DonutMonthData | null; // donut do mês
};

export type UseStatsDashboardResult = {
  loading: boolean;
  error: string | null;

  filters: StatsFilters;
  setFilters: (patch: Partial<StatsFilters>) => void;
  resetFilters: () => void;

  statusOptions: StatusOption[];
  yearOptions: number[];
  monthOptions: { value: number; label: string }[];
  periodOptions: { value: PeriodPreset; label: string }[];

  gameQuery: string;
  setGameQuery: (v: string) => void;
  gameOptions: GameOption[];

  dashboard: DashboardData | null;

  feed: FeedRow[];
  feedHasMore: boolean;
  feedLoadMore: () => Promise<void>;
  refreshAll: () => Promise<void>;
};

/* =========================
   Helpers
========================= */

const MESES_PT = [
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

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function makeYearOptions() {
  const now = new Date();
  const y = now.getFullYear();
  const list: number[] = [];
  for (let i = y - 5; i <= y + 1; i++) list.push(i);
  return list;
}

function buildRange(filters: StatsFilters): {
  startIso?: string;
  endIso?: string;
} {
  const now = new Date();

  if (filters.period === "all") return {};

  if (filters.period === "last30" || filters.period === "last90") {
    const days = filters.period === "last30" ? 30 : 90;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { startIso: start.toISOString(), endIso: now.toISOString() };
  }

  // month/year
  const year = filters.year ?? now.getFullYear();

  if (filters.period === "year") {
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  // month
  const month = clamp(filters.month ?? now.getMonth() + 1, 1, 12);
  const m = month - 1;
  const start = new Date(Date.UTC(year, m, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, m + 1, 1, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function yearRangeIso(year: number) {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0)).toISOString();
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0)).toISOString();
  return { start, end };
}

function getMonthFromIso(iso: string) {
  // iso -> Date in UTC-ish (ok pra agrupar)
  const d = new Date(iso);
  const m = d.getUTCMonth() + 1;
  return clamp(m, 1, 12);
}

function pickLatestExternalByGame(externals: ExternalRatingRow[]) {
  const map = new Map<
    string,
    { score: number; t: number | null; url: string | null }
  >();

  for (const r of externals) {
    const score = r.score_0_10;
    if (score == null || !Number.isFinite(score)) continue;

    const t = r.retrieved_at ? new Date(r.retrieved_at).getTime() : null;
    const cur = map.get(r.game_id);

    if (!cur) {
      map.set(r.game_id, { score: Number(score), t, url: r.url ?? null });
      continue;
    }

    if (t != null && (cur.t == null || t > cur.t)) {
      map.set(r.game_id, { score: Number(score), t, url: r.url ?? null });
    }
  }

  return map;
}

function deriveHoursByMonth(
  rowsYear: CycleRow[],
  year: number
): HoursByMonthPoint[] {
  const byMonth: Array<{
    minutes: number;
    byGame: Map<string, { title: string; minutes: number }>;
  }> = Array.from({ length: 12 }, () => ({
    minutes: 0,
    byGame: new Map(),
  }));

  for (const r of rowsYear) {
    // garante ano
    const d = new Date(r.started_at);
    const y = d.getUTCFullYear();
    if (y !== year) continue;

    const m = getMonthFromIso(r.started_at); // 1..12
    const idx = m - 1;

    const mins = safeNum(r.total_minutes_finished);
    if (mins <= 0) continue;

    byMonth[idx].minutes += mins;

    const cur = byMonth[idx].byGame.get(r.game_id) ?? {
      title: r.game_title,
      minutes: 0,
    };
    cur.minutes += mins;
    byMonth[idx].byGame.set(r.game_id, cur);
  }

  return byMonth.map((slot, idx) => {
    const total = slot.minutes;
    const games: HoursByMonthGame[] = Array.from(slot.byGame.entries())
      .map(([game_id, v]) => ({
        game_id,
        title: v.title,
        minutes: Math.round(v.minutes),
        hours: round1(v.minutes / 60),
        percent: total > 0 ? round1((v.minutes / total) * 100) : 0,
      }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 10); // tooltip top 10

    return {
      month: idx + 1,
      label: MESES_PT[idx],
      minutes: Math.round(total),
      hours: round1(total / 60),
      games,
    };
  });
}

function deriveDonutMonth(
  rowsYear: CycleRow[],
  externals: ExternalRatingRow[],
  year: number,
  month: number
): DonutMonthData | null {
  const targetMonth = clamp(month, 1, 12);
  const latestExternal = pickLatestExternalByGame(externals);

  // filtra ciclos do mês
  const monthRows = rowsYear.filter((r) => {
    const d = new Date(r.started_at);
    return (
      d.getUTCFullYear() === year &&
      getMonthFromIso(r.started_at) === targetMonth
    );
  });

  if (!monthRows.length) {
    return {
      year,
      month: targetMonth,
      label: `${MESES_PT[targetMonth - 1]}/${year}`,
      totalMinutes: 0,
      games: [],
    };
  }

  // agrega por jogo
  type Agg = {
    title: string;
    minutes: number;

    // reviews
    reviewSum: number;
    reviewCount: number;

    // session score (ponderado por sessões)
    scoreWeightedSum: number;
    scoreWeight: number;
  };

  const map = new Map<string, Agg>();

  for (const r of monthRows) {
    const mins = safeNum(r.total_minutes_finished);

    const cur = map.get(r.game_id) ?? {
      title: r.game_title,
      minutes: 0,
      reviewSum: 0,
      reviewCount: 0,
      scoreWeightedSum: 0,
      scoreWeight: 0,
    };

    cur.minutes += mins;

    if (r.rating_final != null && Number.isFinite(Number(r.rating_final))) {
      cur.reviewSum += Number(r.rating_final);
      cur.reviewCount += 1;
    }

    const sess = safeNum(r.sessions_count_finished);
    if (
      sess > 0 &&
      r.avg_score_finished != null &&
      Number.isFinite(Number(r.avg_score_finished))
    ) {
      cur.scoreWeightedSum += Number(r.avg_score_finished) * sess;
      cur.scoreWeight += sess;
    }

    map.set(r.game_id, cur);
  }

  const totalMinutes = Array.from(map.values()).reduce(
    (acc, v) => acc + v.minutes,
    0
  );

  const gamesAll: DonutGamePoint[] = Array.from(map.entries())
    .map(([game_id, v]) => {
      const ext = latestExternal.get(game_id)?.score ?? null;

      return {
        game_id,
        title: v.title,
        minutes: Math.round(v.minutes),
        hours: round1(v.minutes / 60),
        percent:
          totalMinutes > 0 ? round1((v.minutes / totalMinutes) * 100) : 0,

        avg_review: v.reviewCount ? round1(v.reviewSum / v.reviewCount) : null,
        avg_session_score: v.scoreWeight
          ? round1(v.scoreWeightedSum / v.scoreWeight)
          : null,
        external_rating: ext != null ? round1(ext) : null,
      };
    })
    .sort((a, b) => b.minutes - a.minutes);

  // top N + (opcional) agrupar resto em "Outros"
  const TOP = 8;
  let games = gamesAll;
  if (gamesAll.length > TOP) {
    const top = gamesAll.slice(0, TOP);
    const rest = gamesAll.slice(TOP);

    const restMinutes = rest.reduce((acc, g) => acc + g.minutes, 0);
    const restPercent = rest.reduce((acc, g) => acc + g.percent, 0);

    top.push({
      game_id: "__others__",
      title: "Outros",
      minutes: Math.round(restMinutes),
      hours: round1(restMinutes / 60),
      percent: round1(restPercent),
      avg_review: null,
      avg_session_score: null,
      external_rating: null,
    });

    games = top;
  }

  return {
    year,
    month: targetMonth,
    label: `${MESES_PT[targetMonth - 1]}/${year}`,
    totalMinutes: Math.round(totalMinutes),
    games,
  };
}

function deriveDashboard(
  rows: CycleRow[],
  externals: ExternalRatingRow[]
): Omit<DashboardData, "hoursByMonth" | "donutMonth"> {
  const cycles = rows.length;
  const openCycles = rows.filter((r) => !r.ended_at).length;

  // ratings (reviews)
  const rated = rows
    .filter(
      (r) => r.rating_final != null && Number.isFinite(Number(r.rating_final))
    )
    .sort(
      (a, b) =>
        new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    );

  const ratedCycles = rated.length;
  const sumFinal = rated.reduce((acc, r) => acc + Number(r.rating_final), 0);
  const avgFinalRating = ratedCycles ? round1(sumFinal / ratedCycles) : null;
  const lastFinalRating = ratedCycles
    ? round1(Number(rated[0].rating_final))
    : null;

  // sessões (ponderado por qtd sessões)
  let finishedSessions = 0;
  let sumScoreWeighted = 0;
  let sumMinutesWeighted = 0;
  let weightSessionsScore = 0;
  let weightSessionsMinutes = 0;

  let totalMinutes = 0;

  for (const r of rows) {
    const sess = safeNum(r.sessions_count_finished);
    const mins = safeNum(r.total_minutes_finished);
    totalMinutes += mins;
    finishedSessions += sess;

    if (
      sess > 0 &&
      r.avg_score_finished != null &&
      Number.isFinite(Number(r.avg_score_finished))
    ) {
      sumScoreWeighted += Number(r.avg_score_finished) * sess;
      weightSessionsScore += sess;
    }

    if (
      sess > 0 &&
      r.avg_session_minutes_finished != null &&
      Number.isFinite(Number(r.avg_session_minutes_finished))
    ) {
      sumMinutesWeighted += Number(r.avg_session_minutes_finished) * sess;
      weightSessionsMinutes += sess;
    }
  }

  const avgSessionScore = weightSessionsScore
    ? round1(sumScoreWeighted / weightSessionsScore)
    : null;
  const avgSessionMinutes = weightSessionsMinutes
    ? round1(sumMinutesWeighted / weightSessionsMinutes)
    : null;

  // reviews written
  const reviewed = rows.filter((r) => (r.review_text ?? "").trim().length > 0);
  const reviewsWritten = reviewed.length;

  const reviewedRated = reviewed.filter(
    (r) => r.rating_final != null && Number.isFinite(Number(r.rating_final))
  );
  const avgReviewedFinalRating = reviewedRated.length
    ? round1(
        reviewedRated.reduce((acc, r) => acc + Number(r.rating_final), 0) /
          reviewedRated.length
      )
    : null;

  // externas (mantido por compat — vamos tirar da UI depois)
  const latestByGame = pickLatestExternalByGame(externals);
  const externalRatingsCount = externals.filter(
    (r) => r.score_0_10 != null && Number.isFinite(Number(r.score_0_10))
  ).length;

  const gameTitleById = new Map<string, string>();
  for (const r of rows) gameTitleById.set(r.game_id, r.game_title);

  const externalRatingsList = externals
    .filter(
      (r) => r.score_0_10 != null && Number.isFinite(Number(r.score_0_10))
    )
    .map((r) => {
      const title = gameTitleById.get(r.game_id) ?? "Jogo";
      const src = (r.source ?? "externa").trim() || "externa";
      return {
        label: `${title} • ${src}`,
        score: round2(Number(r.score_0_10)),
        url: r.url ?? null,
      };
    })
    .sort((a, b) => b.score - a.score);

  // séries antigas (baseadas em ciclos com nota)
  const recentRatings: RecentRatingPoint[] = rated.slice(0, 12).map((r) => {
    const d = new Date(r.started_at);
    const ddmm = d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
    const ext = latestByGame.get(r.game_id)?.score ?? null;

    return {
      label: `${r.game_title} • ${ddmm}`,
      rating_final: round1(Number(r.rating_final)),
      avg_score_finished:
        r.avg_score_finished != null
          ? round1(Number(r.avg_score_finished))
          : null,
      external_rating: ext != null ? round1(ext) : null,
    };
  });

  const timeline: TimelinePoint[] = rated
    .slice()
    .sort(
      (a, b) =>
        new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    )
    .map((r) => {
      const ts = new Date(r.started_at).getTime();
      const ext = latestByGame.get(r.game_id)?.score ?? null;

      return {
        ts,
        rating_final: round1(Number(r.rating_final)),
        avg_score_finished:
          r.avg_score_finished != null
            ? round1(Number(r.avg_score_finished))
            : null,
        external_rating: ext != null ? round1(ext) : null,
      };
    });

  // top tempo por jogo (no recorte do período)
  const minutesByGame = new Map<string, { title: string; minutes: number }>();
  for (const r of rows) {
    const cur = minutesByGame.get(r.game_id) ?? {
      title: r.game_title,
      minutes: 0,
    };
    cur.minutes += safeNum(r.total_minutes_finished);
    minutesByGame.set(r.game_id, cur);
  }

  const topTimeByGame: TopTimePoint[] = Array.from(minutesByGame.values())
    .map((v) => ({ game_title: v.title, minutes: Math.round(v.minutes) }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10);

  return {
    kpis: {
      cycles,
      openCycles,

      ratedCycles,
      avgFinalRating,
      lastFinalRating,

      finishedSessions,
      avgSessionScore,
      avgSessionMinutes,

      reviewsWritten,
      avgReviewedFinalRating,

      externalRatingsCount,
      externalRatings: externalRatingsList,

      totalMinutes: Math.round(totalMinutes),
    },
    recentRatings,
    timeline,
    topTimeByGame,
  };
}

/* =========================
   Hook
========================= */

export function useStatsDashboard(): UseStatsDashboardResult {
  const now = new Date();

  const DEFAULT_FILTERS: StatsFilters = {
    period: "last30",
    q: "",
    gameId: null,
    statusId: null,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };

  const periodOptions = useMemo(
    () => [
      { value: "last30" as const, label: "Últimos 30 dias" },
      { value: "last90" as const, label: "Últimos 90 dias" },
      { value: "month" as const, label: "Mês" }, // ✅ estava faltando
      { value: "year" as const, label: "Ano" },
      { value: "all" as const, label: "Tudo" },
    ],
    []
  );

  const [filters, _setFilters] = useState<StatsFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const yearOptions = useMemo(() => makeYearOptions(), []);
  const monthOptions = useMemo(
    () => MESES_PT.map((m, i) => ({ value: i + 1, label: m })),
    []
  );

  // game search (combobox)
  const [gameQuery, setGameQuery] = useState("");
  const [gameOptions, setGameOptions] = useState<GameOption[]>([]);

  // feed paginado
  const PAGE = 10;
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [feedOffset, setFeedOffset] = useState(0);
  const [feedHasMore, setFeedHasMore] = useState(false);

  // dashboard
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  // evita race
  const reqIdRef = useRef(0);
  const nextReqId = () => {
    reqIdRef.current += 1;
    return reqIdRef.current;
  };

  const setFilters = useCallback((patch: Partial<StatsFilters>) => {
    _setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    _setFilters(DEFAULT_FILTERS);
    setGameQuery("");
  }, [DEFAULT_FILTERS]);

  const loadStatusOptions = useCallback(async () => {
    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("game_statuses")
      .select("id,name,slug")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    setStatusOptions((data ?? []) as any);
  }, []);

  const loadGameOptions = useCallback(async (q: string) => {
    const qq = q.trim();
    if (!qq) {
      setGameOptions([]);
      return;
    }

    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("games")
      .select("id,title,platform,cover_url")
      .ilike("title", `%${qq}%`)
      .order("title", { ascending: true })
      .limit(20);

    if (error) throw error;
    setGameOptions((data ?? []) as any);
  }, []);

  const buildCyclesQuery = useCallback(
    (cols: string) => {
      const { startIso, endIso } = buildRange(filters);

      let q = supabase
        .schema("kesslerlog")
        .from("vw_cycles_enriched")
        .select(cols)
        .order("started_at", { ascending: false });

      if (filters.gameId) q = q.eq("game_id", filters.gameId);
      if (filters.statusId) q = q.eq("status_id", filters.statusId);

      if (startIso && endIso)
        q = q.gte("started_at", startIso).lt("started_at", endIso);

      const qq = filters.q.trim();
      if (qq) q = q.ilike("game_title", `%${qq}%`);

      return q;
    },
    [filters]
  );

  const buildYearCyclesQuery = useCallback(
    (cols: string, year: number) => {
      const { start, end } = yearRangeIso(year);

      let q = supabase
        .schema("kesslerlog")
        .from("vw_cycles_enriched")
        .select(cols)
        .order("started_at", { ascending: false });

      if (filters.gameId) q = q.eq("game_id", filters.gameId);
      if (filters.statusId) q = q.eq("status_id", filters.statusId);

      // ano inteiro
      q = q.gte("started_at", start).lt("started_at", end);

      const qq = filters.q.trim();
      if (qq) q = q.ilike("game_title", `%${qq}%`);

      return q;
    },
    [filters.gameId, filters.statusId, filters.q]
  );

  const loadDashboardData = useCallback(async () => {
    // 🔹 cols do período (KPIs e afins)
    const colsPeriod =
      "cycle_id,game_id,game_title,status_id,status_name,started_at,ended_at,rating_final,review_text," +
      "sessions_count_finished,total_minutes_finished,avg_session_minutes_finished,avg_score_finished,last_session_started_at";

    // 🔹 ano selecionado (pro gráfico de horas/mês + donut do mês)
    const nowYear = new Date().getFullYear();
    const selectedYear = filters.year ?? nowYear;

    const [periodRes, yearRes] = await Promise.all([
      buildCyclesQuery(colsPeriod).limit(5000),
      buildYearCyclesQuery(colsPeriod, selectedYear).limit(10000),
    ]);

    if (periodRes.error) throw periodRes.error;
    if (yearRes.error) throw yearRes.error;

    const rowsPeriod = (periodRes.data ?? []) as any as CycleRow[];
    const rowsYear = (yearRes.data ?? []) as any as CycleRow[];

    // externals para jogos relevantes (ano inteiro — serve pro donut do mês)
    const yearGameIds = Array.from(
      new Set(rowsYear.map((r) => r.game_id))
    ).filter(Boolean) as string[];

    let externals: ExternalRatingRow[] = [];
    if (yearGameIds.length) {
      const { data: exData, error: exErr } = await supabase
        .schema("kesslerlog")
        .from("vw_external_ratings_norm")
        .select("game_id,source,score_0_10,url,retrieved_at")
        .in("game_id", yearGameIds)
        .limit(5000);

      if (exErr) throw exErr;
      externals = (exData ?? []) as any;
    }

    // ✅ dashboard antigo (compat)
    const base = deriveDashboard(rowsPeriod, externals);

    // ✅ barras horas por mês (ano)
    const hoursByMonth = deriveHoursByMonth(rowsYear, selectedYear);

    // ✅ donut do mês
    const now = new Date();
    const donutYear = selectedYear;
    const donutMonth =
      filters.period === "month"
        ? clamp(filters.month ?? now.getMonth() + 1, 1, 12)
        : clamp(now.getMonth() + 1, 1, 12);

    const donutMonthData = deriveDonutMonth(
      rowsYear,
      externals,
      donutYear,
      donutMonth
    );

    setDashboard({
      ...base,
      hoursByMonth,
      donutMonth: donutMonthData,
    });
  }, [
    buildCyclesQuery,
    buildYearCyclesQuery,
    filters.year,
    filters.period,
    filters.month,
  ]);

  const loadFeedPage = useCallback(
    async (offset: number, append: boolean) => {
      const { startIso, endIso } = buildRange(filters);

      // ✅ feed baseado em ciclos (com ou sem nota)
      let q = supabase
        .schema("kesslerlog")
        .from("vw_cycles_enriched")
        .select(
          "cycle_id,game_id,game_title,status_id,status_name,started_at,ended_at,rating_final,review_text," +
            "sessions_count_finished,total_minutes_finished,avg_score_finished,last_session_started_at"
        )
        .order("started_at", { ascending: false })
        .order("cycle_id", { ascending: false })
        .range(offset, offset + PAGE - 1);

      if (filters.gameId) q = q.eq("game_id", filters.gameId);
      if (filters.statusId) q = q.eq("status_id", filters.statusId);

      if (startIso && endIso)
        q = q.gte("started_at", startIso).lt("started_at", endIso);

      const qq = filters.q.trim();
      if (qq) q = q.ilike("game_title", `%${qq}%`);

      const { data, error } = await q;
      if (error) throw error;

      const baseRows = (data ?? []) as any[] as Array<
        Omit<FeedRow, "platform" | "cover_url">
      >;

      // completa platform/cover_url via games
      const gameIds = Array.from(
        new Set(baseRows.map((r) => r.game_id))
      ).filter(Boolean) as string[];

      const gameMap = new Map<
        string,
        { platform: string | null; cover_url: string | null }
      >();
      if (gameIds.length) {
        const { data: gData, error: gErr } = await supabase
          .schema("kesslerlog")
          .from("games")
          .select("id,platform,cover_url")
          .in("id", gameIds);

        if (gErr) throw gErr;

        for (const g of (gData ?? []) as any[]) {
          gameMap.set(g.id, {
            platform: (g.platform ?? null) as any,
            cover_url: (g.cover_url ?? null) as any,
          });
        }
      }

      const rows: FeedRow[] = baseRows.map((r) => {
        const extra = gameMap.get((r as any).game_id);
        return {
          ...(r as any),
          platform: extra?.platform ?? null,
          cover_url: extra?.cover_url ?? null,
        };
      });

      setFeedHasMore(rows.length === PAGE);

      if (append) setFeed((prev) => [...prev, ...rows]);
      else setFeed(rows);
    },
    [filters]
  );

  const refreshAll = useCallback(async () => {
    const rid = nextReqId();
    setLoading(true);
    setError(null);

    try {
      await Promise.all([loadStatusOptions(), loadDashboardData()]);
      await loadFeedPage(0, false);
      if (reqIdRef.current === rid) setFeedOffset(0);
    } catch (e: any) {
      if (reqIdRef.current === rid)
        setError(e?.message ?? "Erro ao carregar dashboard");
    } finally {
      if (reqIdRef.current === rid) setLoading(false);
    }
  }, [loadDashboardData, loadFeedPage, loadStatusOptions]);

  const feedLoadMore = useCallback(async () => {
    if (!feedHasMore || loading) return;
    const next = feedOffset + PAGE;
    setLoading(true);
    setError(null);

    try {
      await loadFeedPage(next, true);
      setFeedOffset(next);
    } catch (e: any) {
      setError(e?.message ?? "Erro ao carregar mais");
    } finally {
      setLoading(false);
    }
  }, [feedHasMore, feedOffset, loadFeedPage, loading]);

  // init
  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounce gameQuery (options do combobox)
  useEffect(() => {
    const t = setTimeout(() => {
      loadGameOptions(gameQuery).catch(() => {});
    }, 220);
    return () => clearTimeout(t);
  }, [gameQuery, loadGameOptions]);

  // quando filtros mudam -> recarrega tudo
  useEffect(() => {
    const t = setTimeout(() => {
      refreshAll();
    }, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.period,
    filters.gameId,
    filters.statusId,
    filters.month,
    filters.year,
    filters.q,
  ]);

  return {
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
  };
}
