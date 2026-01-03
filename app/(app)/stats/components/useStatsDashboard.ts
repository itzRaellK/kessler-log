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

  rating_final: number;
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
  avgFinalRating: number | null;
  lastFinalRating: number | null;

  finishedSessions: number;
  avgSessionScore: number | null; // ponderada por qtd de sessões
  avgSessionMinutes: number | null; // ponderada por qtd de sessões

  reviewsWritten: number;
  avgReviewedFinalRating: number | null;

  externalRatingsCount: number; // qtd de registros externos no recorte
  externalRatings: Array<{ label: string; score: number; url: string | null }>; // lista (sem média)

  totalMinutes: number;
};

export type RecentRatingPoint = {
  label: string; // y-axis
  rating_final: number;
  avg_score_finished: number | null;
  external_rating: number | null; // valor “representativo” (latest por jogo)
};

export type TimelinePoint = {
  ts: number; // x numérico
  rating_final: number;
  avg_score_finished: number | null;
  external_rating: number | null;
};

export type TopTimePoint = {
  game_title: string;
  minutes: number;
};

export type DashboardData = {
  kpis: DashboardKpis;
  recentRatings: RecentRatingPoint[];
  timeline: TimelinePoint[];
  topTimeByGame: TopTimePoint[];
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

function pickLatestExternalByGame(externals: ExternalRatingRow[]) {
  const map = new Map<string, { score: number; t: number | null }>();

  for (const r of externals) {
    const score = r.score_0_10;
    if (score == null || !Number.isFinite(score)) continue;

    const t = r.retrieved_at ? new Date(r.retrieved_at).getTime() : null;
    const cur = map.get(r.game_id);

    if (!cur) {
      map.set(r.game_id, { score, t });
      continue;
    }

    // se tem data, usa a mais recente; se não tem, mantém o primeiro
    if (t != null && (cur.t == null || t > cur.t)) {
      map.set(r.game_id, { score, t });
    }
  }

  return map;
}

function deriveDashboard(
  rows: CycleRow[],
  externals: ExternalRatingRow[]
): DashboardData {
  const cycles = rows.length;
  const openCycles = rows.filter((r) => !r.ended_at).length;

  // ratings
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

  // reviews
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

  // externas: lista (sem média) + “valor representativo” por jogo (latest) pra charts
  const latestByGame = pickLatestExternalByGame(externals);
  const externalRatingsCount = externals.filter(
    (r) => r.score_0_10 != null && Number.isFinite(Number(r.score_0_10))
  ).length;

  // para mostrar no KPI: “todas” (lista)
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
    // ordena por score desc só pra ficar “visualmente útil”
    .sort((a, b) => b.score - a.score);

  // séries
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

  // top tempo por jogo
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
    period: "last30", // ✅ padrão
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

  const loadDashboardData = useCallback(async () => {
    const cols =
      "cycle_id,game_id,game_title,status_id,status_name,started_at,ended_at,rating_final,review_text," +
      "sessions_count_finished,total_minutes_finished,avg_session_minutes_finished,avg_score_finished";

    const { data, error } = await buildCyclesQuery(cols).limit(2000);
    if (error) throw error;

    const rows = (data ?? []) as any as CycleRow[];

    // externas (todas) pros jogos do recorte
    const gameIds = Array.from(new Set(rows.map((r) => r.game_id))).filter(
      Boolean
    );

    let externals: ExternalRatingRow[] = [];
    if (gameIds.length) {
      const { data: exData, error: exErr } = await supabase
        .schema("kesslerlog")
        .from("vw_external_ratings_norm")
        .select("game_id,source,score_0_10,url,retrieved_at")
        .in("game_id", gameIds)
        .limit(5000);

      if (exErr) throw exErr;
      externals = (exData ?? []) as any;
    }

    setDashboard(deriveDashboard(rows, externals));
  }, [buildCyclesQuery]);

  const loadFeedPage = useCallback(
    async (offset: number, append: boolean) => {
      const { startIso, endIso } = buildRange(filters);

      let q = supabase
        .schema("kesslerlog")
        .from("vw_ratings_feed")
        .select(
          "cycle_id,game_id,game_title,platform,cover_url,status_id,status_name,started_at,ended_at,rating_final,review_text," +
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

      const rows = (data ?? []) as any as FeedRow[];
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
