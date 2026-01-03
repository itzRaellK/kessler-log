"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/* =========================
   Types
========================= */

export type StatsFilters = {
  q: string;
  gameId: string | null;
  statusId: string | null;
  month: number | null; // 1..12 | null = todos
  year: number | null; // ex: 2026 | null = todos
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

export type DashboardKpis = {
  cycles: number;
  ratedCycles: number;
  avgCycleRating: number | null;
  totalMinutes: number;
  finishedSessions: number;
};

export type ChartSeriesPoint = {
  label: string; // ex: "Jan/26" ou "05/01"
  value: number;
  count: number;
};

export type HistogramBucket = { bucket: number; total: number };

export type DashboardData = {
  kpis: DashboardKpis;
  ratingTrend: ChartSeriesPoint[]; // média de rating por período
  statusBreakdown: { status: string; total: number }[];
  ratingHistogram: HistogramBucket[]; // 0..10
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
  const { year, month } = filters;
  if (!year) return {};

  // ano inteiro
  if (!month) {
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0));
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  // mês específico
  const m = clamp(month, 1, 12) - 1;
  const start = new Date(Date.UTC(year, m, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, m + 1, 1, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function deriveDashboard(
  rows: CycleRow[],
  filters: StatsFilters
): DashboardData {
  const cycles = rows.length;

  let ratedCycles = 0;
  let sumRating = 0;

  let totalMinutes = 0;
  let finishedSessions = 0;

  const statusMap = new Map<string, number>();
  const hist = new Array(11).fill(0); // 0..10 buckets
  const trendMap = new Map<string, { sum: number; count: number }>();

  const byDay = !!(filters.year && filters.month); // se filtrou mês, trend por dia

  for (const r of rows) {
    const statusLabel = r.status_name ?? "Sem status";
    statusMap.set(statusLabel, (statusMap.get(statusLabel) ?? 0) + 1);

    totalMinutes += safeNum(r.total_minutes_finished);
    finishedSessions += safeNum(r.sessions_count_finished);

    if (r.rating_final != null) {
      const rf = Number(r.rating_final);
      if (Number.isFinite(rf)) {
        ratedCycles++;
        sumRating += rf;

        const b = clamp(Math.floor(rf), 0, 10);
        hist[b] += 1;

        const d = new Date(r.started_at);
        const label = byDay
          ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
          : `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;

        const cur = trendMap.get(label) ?? { sum: 0, count: 0 };
        cur.sum += rf;
        cur.count += 1;
        trendMap.set(label, cur);
      }
    }
  }

  const avgCycleRating = ratedCycles ? round1(sumRating / ratedCycles) : null;

  // trend ordenado (quando é mês/dia, ordena por data real)
  const ratingTrend: ChartSeriesPoint[] = Array.from(trendMap.entries()).map(
    ([label, v]) => ({
      label,
      value: round1(v.sum / Math.max(1, v.count)),
      count: v.count,
    })
  );

  // ordenação “boa o bastante”
  if (byDay) {
    ratingTrend.sort((a, b) => {
      const [da, ma] = a.label.split("/").map(Number);
      const [db, mb] = b.label.split("/").map(Number);
      return ma * 40 + da - (mb * 40 + db);
    });
  } else {
    // tenta reordenar por ano/mês interpretando "Mon/YY"
    const monthIndex = (mon: string) => MESES_PT.indexOf(mon);
    ratingTrend.sort((a, b) => {
      const [ma, ya] = a.label.split("/");
      const [mb, yb] = b.label.split("/");
      const A = (Number(ya) || 0) * 12 + monthIndex(ma);
      const B = (Number(yb) || 0) * 12 + monthIndex(mb);
      return A - B;
    });
  }

  const statusBreakdown = Array.from(statusMap.entries())
    .map(([status, total]) => ({ status, total }))
    .sort((a, b) => b.total - a.total);

  const ratingHistogram: HistogramBucket[] = hist.map((total, bucket) => ({
    bucket,
    total,
  }));

  return {
    kpis: {
      cycles,
      ratedCycles,
      avgCycleRating,
      totalMinutes,
      finishedSessions,
    },
    ratingTrend,
    statusBreakdown,
    ratingHistogram,
  };
}

/* =========================
   Hook
========================= */

export function useStatsDashboard(): UseStatsDashboardResult {
  const now = new Date();
  const DEFAULT_FILTERS: StatsFilters = {
    q: "",
    gameId: null,
    statusId: null,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };

  const [filters, _setFilters] = useState<StatsFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const yearOptions = useMemo(() => makeYearOptions(), []);
  const monthOptions = useMemo(
    () => MESES_PT.map((m, i) => ({ value: i + 1, label: m })),
    []
  );

  // game search (para filtro)
  const [gameQuery, setGameQuery] = useState("");
  const [gameOptions, setGameOptions] = useState<GameOption[]>([]);

  // feed paginado
  const PAGE = 10;
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [feedOffset, setFeedOffset] = useState(0);
  const [feedHasMore, setFeedHasMore] = useState(false);

  // dashboard data
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  // evita race conditions
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

      // range por data (baseado no started_at do ciclo)
      if (startIso && endIso)
        q = q.gte("started_at", startIso).lt("started_at", endIso);

      // busca por título (server-side)
      const qq = filters.q.trim();
      if (qq) q = q.ilike("game_title", `%${qq}%`);

      return q;
    },
    [filters]
  );

  const loadDashboardData = useCallback(async () => {
    // pega “amostra grande o bastante” pra gráfico ficar bom
    const cols =
      "cycle_id,game_id,game_title,status_id,status_name,started_at,ended_at,rating_final,review_text,sessions_count_finished,total_minutes_finished,avg_session_minutes_finished,avg_score_finished";

    const { data, error } = await buildCyclesQuery(cols).limit(1200);
    if (error) throw error;

    const rows = (data ?? []) as any as CycleRow[];
    setDashboard(deriveDashboard(rows, filters));
  }, [buildCyclesQuery, filters]);

  const loadFeedPage = useCallback(
    async (offset: number, append: boolean) => {
      const { startIso, endIso } = buildRange(filters);

      let q = supabase
        .schema("kesslerlog")
        .from("vw_ratings_feed")
        .select(
          "cycle_id,game_id,game_title,platform,cover_url,status_id,status_name,started_at,ended_at,rating_final,review_text,sessions_count_finished,total_minutes_finished,avg_score_finished,last_session_started_at"
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
      // sempre reseta feed na atualização
      await loadFeedPage(0, false);
      if (reqIdRef.current === rid) setFeedOffset(0);
    } catch (e: any) {
      if (reqIdRef.current === rid) {
        setError(e?.message ?? "Erro ao carregar dashboard");
      }
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

  // debounce do gameQuery (options do combobox)
  useEffect(() => {
    const t = setTimeout(() => {
      loadGameOptions(gameQuery).catch(() => {});
    }, 220);
    return () => clearTimeout(t);
  }, [gameQuery, loadGameOptions]);

  // quando filtros mudam -> reseta feed e recarrega dashboard
  useEffect(() => {
    const t = setTimeout(() => {
      refreshAll();
    }, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
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
