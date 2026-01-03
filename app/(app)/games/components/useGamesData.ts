"use client";

import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/* =========================
   Types
========================= */

export type GameRow = {
  id: string;
  title: string;
  platform: string | null;
  cover_url: string | null;

  external_source: string | null;
  external_id: string | null;
  external_url: string | null;

  created_at: string;
};

export type StatusRow = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type ActiveByGame = Record<
  string,
  { count: number; lastStartedAt: string | null; activeCycleId: string | null }
>;

export type ExternalRatingRow = {
  id: string;
  game_id: string;
  source: string;
  score: number;
  scale_max: number;
  url: string | null;
  retrieved_at: string;
};

export type RatingsByGame = Record<string, ExternalRatingRow[]>;

export type GameUpsertInput = {
  title: string;
  platform?: string | null;
  cover_url?: string | null;
  external_source?: string | null;
  external_id?: string | null;
  external_url?: string | null;
};

export type ExternalRatingUpsertInput = {
  source: string;
  score: number;
  scale_max: number;
  url?: string | null;
};

/* =========================
   Helpers
========================= */

function clampNum(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function pickDefaultStartStatusId(list: StatusRow[]) {
  const bySlug = (slug: string) =>
    list.find((x) => x.is_active && x.slug === slug)?.id ?? null;

  return (
    bySlug("playing") ??
    bySlug("jogando") ??
    list.find((x) => x.is_active)?.id ??
    null
  );
}

/* =========================
   Hook
========================= */

export function useGamesData() {
  const [rows, setRows] = useState<GameRow[]>([]);
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [activeByGame, setActiveByGame] = useState<ActiveByGame>({});
  const [ratingsByGame, setRatingsByGame] = useState<RatingsByGame>({});

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  // status selecionado para iniciar ciclo
  const [statusToStart, setStatusToStart] = useState<string | null>(null);

  const hasStatuses = useMemo(
    () => statuses.some((s) => s.is_active),
    [statuses]
  );

  const loadUser = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;

    const uid = data.user?.id ?? null;
    setUserId(uid);
    return uid;
  }, []);

  const loadStatuses = useCallback(async () => {
    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("game_statuses")
      .select("id,slug,name,sort_order,is_active")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;

    const list = (data ?? []) as StatusRow[];
    setStatuses(list);

    // set default apenas na primeira carga
    setStatusToStart((prev) => prev ?? pickDefaultStartStatusId(list));
  }, []);

  const loadGames = useCallback(async () => {
    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("games")
      .select(
        "id,title,platform,cover_url,external_source,external_id,external_url,created_at"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    setRows((data ?? []) as GameRow[]);
  }, []);

  const loadActiveCounts = useCallback(async () => {
    const { data, error } = await supabase
      .schema("kesslerlog")
      .from("game_cycles")
      .select("id,game_id,started_at,status_id")
      .is("ended_at", null);

    if (error) throw error;

    const map: ActiveByGame = {};
    for (const r of (data ?? []) as any[]) {
      const gid = r.game_id as string;
      const startedAt = r.started_at as string;

      const prev = map[gid] ?? {
        count: 0,
        lastStartedAt: null,
        activeCycleId: null,
      };

      const nextCount = prev.count + 1;
      const nextLast =
        !prev.lastStartedAt ||
        new Date(startedAt).getTime() > new Date(prev.lastStartedAt).getTime()
          ? startedAt
          : prev.lastStartedAt;

      const nextActiveId =
        !prev.lastStartedAt ||
        new Date(startedAt).getTime() >= new Date(prev.lastStartedAt).getTime()
          ? (r.id as string)
          : prev.activeCycleId;

      map[gid] = {
        count: nextCount,
        lastStartedAt: nextLast,
        activeCycleId: nextActiveId,
      };
    }

    setActiveByGame(map);
  }, []);

  const loadRatings = useCallback(async () => {
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
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    try {
      const uid = userId ?? (await loadUser());
      if (!uid) throw new Error("Você precisa estar logado. Vá para /login.");

      await Promise.all([
        loadStatuses(),
        loadGames(),
        loadActiveCounts(),
        loadRatings(),
      ]);
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [
    loadActiveCounts,
    loadGames,
    loadRatings,
    loadStatuses,
    loadUser,
    userId,
  ]);

  const ensureDefaultStatuses = useCallback(async () => {
    setLoading(true);
    setMsg(null);

    try {
      const uid = userId ?? (await loadUser());
      if (!uid) throw new Error("Você precisa estar logado. Vá para /login.");

      const defaults = [
        { slug: "playing", name: "Jogando", sort_order: 10 },
        { slug: "paused", name: "Pausado", sort_order: 20 },
        { slug: "replaying", name: "Rejogando", sort_order: 30 },
        { slug: "finished", name: "Finalizado", sort_order: 40 },
        { slug: "dropped", name: "Dropado", sort_order: 50 },
      ].map((x) => ({ ...x, user_id: uid, is_active: true }));

      const { error } = await supabase
        .schema("kesslerlog")
        .from("game_statuses")
        .upsert(defaults, { onConflict: "user_id,slug" });

      if (error) throw error;

      await loadStatuses();
      setMsg("Status padrão criados ✅");
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao criar status padrão");
    } finally {
      setLoading(false);
    }
  }, [loadStatuses, loadUser, userId]);

  const upsertGame = useCallback(
    async (input: GameUpsertInput, editingId?: string | null) => {
      setLoading(true);
      setMsg(null);

      try {
        const uid = userId ?? (await loadUser());
        if (!uid) throw new Error("Você precisa estar logado. Vá para /login.");

        const payload = {
          title: input.title.trim(),
          platform: input.platform?.trim() ? input.platform.trim() : null,
          cover_url: input.cover_url?.trim() ? input.cover_url.trim() : null,

          external_source: input.external_source?.trim()
            ? input.external_source.trim()
            : null,
          external_id: input.external_id?.trim()
            ? input.external_id.trim()
            : null,
          external_url: input.external_url?.trim()
            ? input.external_url.trim()
            : null,
        };

        if (!payload.title) throw new Error("Título é obrigatório.");

        if (editingId) {
          const { error } = await supabase
            .schema("kesslerlog")
            .from("games")
            .update(payload)
            .eq("id", editingId);

          if (error) throw error;

          await loadGames();
          setMsg("Jogo atualizado ✅");
        } else {
          const { error } = await supabase
            .schema("kesslerlog")
            .from("games")
            .insert({ user_id: uid, ...payload });

          if (error) throw error;

          await loadGames();
          setMsg("Jogo adicionado ✅");
        }

        return true;
      } catch (e: any) {
        setMsg(e?.message ?? "Erro ao salvar jogo");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadGames, loadUser, userId]
  );

  const deleteGame = useCallback(
    async (gameId: string) => {
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

        await Promise.all([loadGames(), loadActiveCounts(), loadRatings()]);
        setMsg("Jogo excluído ✅");
        return true;
      } catch (e: any) {
        setMsg(e?.message ?? "Erro ao excluir jogo");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [loadActiveCounts, loadGames, loadRatings, loadUser, userId]
  );

  const startCycle = useCallback(
    async (gameId: string, statusId?: string | null) => {
      setLoading(true);
      setMsg(null);

      try {
        const uid = userId ?? (await loadUser());
        if (!uid) throw new Error("Você precisa estar logado. Vá para /login.");

        if (!statuses.length) {
          throw new Error(
            "Você ainda não tem status. Clique em “Criar status padrão”."
          );
        }

        const stId =
          statusId ?? statusToStart ?? pickDefaultStartStatusId(statuses);
        if (!stId) throw new Error("Escolha um status para iniciar o ciclo.");

        const active = activeByGame[gameId]?.count ?? 0;
        if (active > 0) {
          throw new Error(
            "Este jogo já tem ciclo ativo. Finalize/encerre antes de iniciar outro."
          );
        }

        const payload = {
          user_id: uid,
          game_id: gameId,
          status_id: stId,
          started_at: new Date().toISOString(),
          ended_at: null,
        };

        const { error } = await supabase
          .schema("kesslerlog")
          .from("game_cycles")
          .insert(payload);

        if (error) throw error;

        await loadActiveCounts();
        setMsg("Ciclo iniciado ✅");
        return true;
      } catch (e: any) {
        setMsg(e?.message ?? "Erro ao iniciar ciclo");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [activeByGame, loadActiveCounts, loadUser, statuses, statusToStart, userId]
  );

  const upsertExternalRating = useCallback(
    async (gameId: string, input: ExternalRatingUpsertInput) => {
      setLoading(true);
      setMsg(null);

      try {
        const uid = userId ?? (await loadUser());
        if (!uid) throw new Error("Você precisa estar logado. Vá para /login.");

        const src = input.source.trim().toLowerCase();
        if (!src) throw new Error("Informe a fonte (ex: steam, igdb, rawg).");

        const scale = Number(String(input.scale_max).replace(",", "."));
        const score = Number(String(input.score).replace(",", "."));

        if (!Number.isFinite(scale) || scale <= 0)
          throw new Error("scale_max inválido.");
        if (!Number.isFinite(score)) throw new Error("score inválido.");

        const scoreClamped = clampNum(score, 0, scale);

        const payload = {
          user_id: uid,
          game_id: gameId,
          source: src,
          score: scoreClamped,
          scale_max: scale,
          url: input.url?.trim() ? input.url.trim() : null,
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
    },
    [loadRatings, loadUser, userId]
  );

  const deleteExternalRating = useCallback(
    async (ratingId: string) => {
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
    },
    [loadRatings, loadUser, userId]
  );

  return {
    // state
    rows,
    statuses,
    activeByGame,
    ratingsByGame,
    userId,
    loading,
    msg,
    setMsg,

    // computed
    hasStatuses,
    statusToStart,
    setStatusToStart,

    // actions
    loadAll,
    ensureDefaultStatuses,
    upsertGame,
    deleteGame,
    startCycle,
    upsertExternalRating,
    deleteExternalRating,
  };
}
