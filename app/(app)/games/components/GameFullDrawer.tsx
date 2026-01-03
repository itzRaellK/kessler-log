// app/(...)/games/components/GameFullDrawer.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Link2,
  Pencil,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RightDrawer } from "./RightDrawer";

/* =========================
   Utils + Styles (DNA)
========================= */

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

const GLASS_CARD =
  "rounded-2xl border border-border/50 bg-card/60 shadow-xl backdrop-blur-xl";
const SOFT_RING = "ring-1 ring-border/20";

const BTN_GREEN =
  "cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300 shadow-sm dark:text-emerald-950";

const BTN_GREEN_OUTLINE =
  "cursor-pointer rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15";

const CLICKABLE = "cursor-pointer disabled:cursor-not-allowed";

const INPUT_WRAP = "kb-ring kb-ring-focus";
const INPUT_BASE =
  "kb-ring-inner relative h-11 w-full rounded-xl border border-border/70 bg-background/90 ring-1 ring-border/20 shadow-sm transition-all dark:border-border/50 dark:bg-background/70 dark:shadow-none";
const INPUT_EL =
  "h-11 w-full bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground";

function clampNum(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtScore(score: number, scaleMax: number) {
  const s = Number.isFinite(score) ? score : 0;
  const m = Number.isFinite(scaleMax) && scaleMax > 0 ? scaleMax : 100;

  const scoreTxt = m <= 10 ? s.toFixed(1) : String(Math.round(s));
  const maxTxt = m <= 10 ? m.toFixed(0) : String(Math.round(m));
  return `${scoreTxt}/${maxTxt}`;
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
   Types
========================= */

export type StatusRow = {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type ExternalRatingRow = {
  id: string;
  game_id: string;
  source: string;
  score: number;
  scale_max: number;
  url: string | null;
  retrieved_at: string;
};

export type GameFormSeed = {
  id?: string | null;
  title?: string | null;
  platform?: string | null;
  cover_url?: string | null;
  external_source?: string | null;
  external_id?: string | null;
  external_url?: string | null;
};

export type SaveGameInput = {
  title: string;
  platform: string | null;
  cover_url: string | null;
  external_source: string | null;
  external_id: string | null;
  external_url: string | null;
};

export type SaveExternalRatingInput = {
  source: string;
  score: number;
  scale_max: number;
  url: string | null;
};

type SaveGameResult = {
  ok: boolean;
  gameId?: string;
  gameTitle?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;

  /** null = criar / seed = editar */
  game: GameFormSeed | null;

  /** ratings do jogo (se existir id) */
  ratings: ExternalRatingRow[];

  loading?: boolean;
  msg?: string | null;

  /** salva jogo (insert/update) */
  onSaveGame: (
    input: SaveGameInput,
    editingId: string | null
  ) => Promise<SaveGameResult> | SaveGameResult;

  /** ratings */
  onUpsertRating: (
    gameId: string,
    input: SaveExternalRatingInput
  ) => Promise<boolean> | boolean;

  onDeleteRating: (
    gameId: string,
    ratingId: string
  ) => Promise<boolean> | boolean;
};

/* =========================
   Small UI: Tabs
========================= */

type TabKey = "game" | "ratings";

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

export function GameFullDrawer({
  open,
  onClose,
  game,
  ratings,
  loading = false,
  msg,
  onSaveGame,
  onUpsertRating,
  onDeleteRating,
}: Props) {
  const titleRef = useRef<HTMLInputElement | null>(null);

  // ======= Tabs =======
  const [tab, setTab] = useState<TabKey>("game");

  // ======= JOGO (form) =======
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedGameId, setSavedGameId] = useState<string | null>(null);
  const [savedGameTitle, setSavedGameTitle] = useState<string>("");

  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const [externalSource, setExternalSource] = useState("");
  const [externalId, setExternalId] = useState("");
  const [externalUrl, setExternalUrl] = useState("");

  const [formError, setFormError] = useState<string | null>(null);

  const isEditing = !!editingId;
  const canSave = useMemo(() => title.trim().length > 0, [title]);

  // ======= RATINGS (list + form) =======
  const [editingSource, setEditingSource] = useState<string | null>(null);
  const [rSource, setRSource] = useState("");
  const [rScore, setRScore] = useState("");
  const [rScaleMax, setRScaleMax] = useState("100");
  const [rUrl, setRUrl] = useState("");
  const [ratingError, setRatingError] = useState<string | null>(null);

  const sortedRatings = useMemo(() => {
    const list = [...(ratings ?? [])];
    list.sort((a, b) => {
      const s = a.source.localeCompare(b.source);
      if (s !== 0) return s;
      return (
        new Date(b.retrieved_at).getTime() - new Date(a.retrieved_at).getTime()
      );
    });
    return list;
  }, [ratings]);

  function resetRatingForm() {
    setEditingSource(null);
    setRSource("");
    setRScore("");
    setRScaleMax("100");
    setRUrl("");
    setRatingError(null);
  }

  function beginEditRating(r: ExternalRatingRow) {
    setEditingSource(r.source);
    setRSource(r.source);
    setRScore(String(r.score));
    setRScaleMax(String(r.scale_max));
    setRUrl(r.url ?? "");
    setRatingError(null);
  }

  function cancelEditRating() {
    resetRatingForm();
  }

  async function handleSaveGame(nextTab?: TabKey) {
    setFormError(null);

    const payload: SaveGameInput = {
      title: title.trim(),
      platform: platform.trim() ? platform.trim() : null,
      cover_url: coverUrl.trim() ? coverUrl.trim() : null,
      external_source: externalSource.trim() ? externalSource.trim() : null,
      external_id: externalId.trim() ? externalId.trim() : null,
      external_url: externalUrl.trim() ? externalUrl.trim() : null,
    };

    if (!payload.title) {
      setFormError("Informe o título do jogo.");
      return;
    }

    const res = await onSaveGame(payload, editingId);

    if (res?.ok) {
      const gid = res.gameId ?? editingId ?? savedGameId ?? null;

      if (gid) {
        setSavedGameId(gid);
        if (!editingId) setEditingId(gid);
      }

      const t = res.gameTitle ?? payload.title;
      setSavedGameTitle(t);

      if (nextTab === "ratings") setTab("ratings");
    } else {
      setFormError((prev) => prev ?? "Não foi possível salvar o jogo.");
    }
  }

  async function handleSaveRating() {
    setRatingError(null);

    const gid = savedGameId;
    if (!gid) {
      setRatingError("Salve o jogo antes de adicionar avaliações externas.");
      return;
    }

    const srcRaw = (editingSource ?? rSource).trim();
    const src = srcRaw.toLowerCase();
    if (!src) {
      setRatingError("Informe a fonte (ex: steam, igdb, rawg).");
      return;
    }

    const scale = Number(rScaleMax.replace(",", "."));
    const sc = Number(rScore.replace(",", "."));

    if (!Number.isFinite(scale) || scale <= 0) {
      setRatingError("scale_max inválido.");
      return;
    }
    if (!Number.isFinite(sc)) {
      setRatingError("score inválido.");
      return;
    }

    const scClamped = clampNum(sc, 0, scale);

    const ok = await onUpsertRating(gid, {
      source: src,
      score: scClamped,
      scale_max: scale,
      url: rUrl.trim() ? rUrl.trim() : null,
    });

    if (ok) resetRatingForm();
  }

  async function handleDeleteRating(id: string) {
    const gid = savedGameId;
    if (!gid) return;

    const ok = window.confirm("Excluir esta avaliação externa?");
    if (!ok) return;

    const done = await onDeleteRating(gid, id);
    if (done) {
      const deleting = ratings.find((r) => r.id === id);
      if (deleting?.source && deleting.source === editingSource) {
        resetRatingForm();
      }
    }
  }

  useEffect(() => {
    if (!open) return;

    const seedId = (game?.id ?? null) as string | null;

    setEditingId(seedId);
    setSavedGameId(seedId);

    const seedTitle = (game?.title ?? "") as string;
    setSavedGameTitle(seedTitle || "");
    setTitle(seedTitle || "");
    setPlatform((game?.platform ?? "") as string);
    setCoverUrl((game?.cover_url ?? "") as string);

    setExternalSource((game?.external_source ?? "") as string);
    setExternalId((game?.external_id ?? "") as string);
    setExternalUrl((game?.external_url ?? "") as string);

    setFormError(null);
    resetRatingForm();

    setTab("game");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, game?.id]);

  const drawerTitle = "Cadastro completo";
  const drawerSubtitle = savedGameTitle
    ? savedGameTitle
    : isEditing
    ? "Edite o jogo e depois registre notas/reviews."
    : "Crie o jogo e depois registre notas/reviews.";

  const ratingsEnabled = !!savedGameId;

  return (
    <RightDrawer
      open={open}
      onClose={onClose}
      title={drawerTitle}
      subtitle={drawerSubtitle}
      widthClass="max-w-[920px]"
      initialFocusRef={titleRef as any}
    >
      <div className="space-y-4">
        {/* mensagens da page */}
        {msg ? (
          <div
            className={cx(
              GLASS_CARD,
              SOFT_RING,
              "bg-card/40 p-4 text-sm text-muted-foreground"
            )}
          >
            {msg}
          </div>
        ) : null}

        {/* tabs */}
        <div className={cx(GLASS_CARD, SOFT_RING, "bg-card/40 p-2")}>
          <div className="flex flex-wrap items-center gap-2">
            <TabButton
              active={tab === "game"}
              onClick={() => setTab("game")}
              disabled={loading}
            >
              <Star size={14} className="opacity-80" />
              Jogo
            </TabButton>

            <TabButton
              active={tab === "ratings"}
              onClick={() => setTab("ratings")}
              disabled={loading || !ratingsEnabled}
              title={
                !ratingsEnabled
                  ? "Salve o jogo primeiro para habilitar"
                  : "Gerenciar avaliações externas"
              }
            >
              <Star size={14} className="opacity-80" />
              Notas & Reviews
              {ratingsEnabled ? (
                <span className="ml-1 rounded-full border border-border/50 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {sortedRatings.length}
                </span>
              ) : null}
            </TabButton>
          </div>
        </div>

        {/* ======= TAB: GAME ======= */}
        {tab === "game" ? (
          <>
            {formError ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-muted-foreground backdrop-blur-xl">
                {formError}
              </div>
            ) : null}

            {/* info bar (sem ciclos) */}
            <div className={cx(GLASS_CARD, SOFT_RING, "bg-card/40 p-4")}>
              <div className="text-xs text-muted-foreground">
                {isEditing ? (
                  <span>
                    Edite os dados e salve. Depois vá para Notas & Reviews.
                  </span>
                ) : (
                  <span>
                    Crie o jogo e, ao salvar, você pode registrar Notas &
                    Reviews externas.
                  </span>
                )}
              </div>
            </div>

            {/* game form */}
            <section className={cx(GLASS_CARD, SOFT_RING, "bg-card/40 p-4")}>
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">
                  Dados do jogo
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {isEditing ? "Editando" : "Novo"}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Título
                  </label>
                  <div className={INPUT_WRAP}>
                    <div className={INPUT_BASE}>
                      <input
                        ref={titleRef}
                        className={INPUT_EL}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ex.: Hollow Knight"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Plataforma
                  </label>
                  <div className={INPUT_WRAP}>
                    <div className={INPUT_BASE}>
                      <input
                        className={INPUT_EL}
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value)}
                        placeholder="PC / PS5 / Emulador..."
                      />
                    </div>
                  </div>
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Cover URL (opcional)
                  </label>
                  <div className={INPUT_WRAP}>
                    <div className={INPUT_BASE}>
                      <Link2
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <input
                        className={cx(INPUT_EL, "pl-9 pr-3")}
                        value={coverUrl}
                        onChange={(e) => setCoverUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              <details className="mt-4 rounded-2xl border border-border/50 bg-card/40 p-4 backdrop-blur-xl">
                <summary className="cursor-pointer select-none text-xs font-semibold text-muted-foreground">
                  Import / Externo (opcional)
                </summary>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Fonte Externa
                    </label>
                    <div className={INPUT_WRAP}>
                      <div className={INPUT_BASE}>
                        <input
                          className={INPUT_EL}
                          value={externalSource}
                          onChange={(e) => setExternalSource(e.target.value)}
                          placeholder="igdb / rawg / steam..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      ID Externo
                    </label>
                    <div className={INPUT_WRAP}>
                      <div className={INPUT_BASE}>
                        <input
                          className={INPUT_EL}
                          value={externalId}
                          onChange={(e) => setExternalId(e.target.value)}
                          placeholder="id do jogo na fonte"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      URL Externa
                    </label>
                    <div className={INPUT_WRAP}>
                      <div className={INPUT_BASE}>
                        <ArrowUpRight
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                        <input
                          className={cx(INPUT_EL, "pl-9 pr-3")}
                          value={externalUrl}
                          onChange={(e) => setExternalUrl(e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-muted-foreground/80">
                  Dica: depois você registra{" "}
                  <span className="font-semibold">Notas & Reviews</span> na aba
                  do lado.
                </div>
              </details>
            </section>

            {/* sticky footer - game */}
            <div
              className={cx(
                "sticky bottom-0 -mx-5 mt-6 border-t border-border/50 bg-background/40 backdrop-blur-xl",
                "px-5 py-4"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  className={cx(BTN_GREEN, CLICKABLE, "h-11")}
                  onClick={() => handleSaveGame()}
                  disabled={loading || !canSave}
                >
                  <Star size={16} className="mr-2" />
                  {isEditing ? "Salvar jogo" : "Criar jogo"}
                </Button>

                <Button
                  variant="outline"
                  className={cx("h-11 rounded-xl", CLICKABLE)}
                  onClick={onClose}
                  disabled={loading}
                >
                  <X size={16} className="mr-2" />
                  Fechar
                </Button>

                <Button
                  variant="outline"
                  className={cx(
                    "h-11 rounded-xl ml-auto",
                    BTN_GREEN_OUTLINE,
                    CLICKABLE
                  )}
                  onClick={() => handleSaveGame("ratings")}
                  disabled={loading || !canSave}
                  title="Salvar e ir para Notas & Reviews"
                >
                  <Star size={16} className="mr-2" />
                  Salvar e ir para Notas
                </Button>
              </div>
            </div>
          </>
        ) : null}

        {/* ======= TAB: RATINGS ======= */}
        {tab === "ratings" ? (
          <>
            {!savedGameId ? (
              <div className="rounded-2xl border border-border/50 bg-card/40 p-4 text-sm text-muted-foreground backdrop-blur-xl">
                Salve o jogo primeiro para habilitar as avaliações externas.
              </div>
            ) : null}

            {ratingError ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-muted-foreground backdrop-blur-xl">
                {ratingError}
              </div>
            ) : null}

            <section className={cx(GLASS_CARD, SOFT_RING, "bg-card/40 p-4")}>
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm font-semibold text-foreground">
                  Notas & Reviews (externas)
                </div>
                <div className="text-[11px] text-muted-foreground">
                  fonte é única por jogo (steam/igdb/rawg…)
                </div>
              </div>

              {/* form */}
              <div className="mt-4 rounded-2xl border border-border/50 bg-card/40 p-4 backdrop-blur-xl">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-semibold text-foreground">
                    {editingSource ? "Editar avaliação" : "Adicionar avaliação"}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-6">
                  <div className="space-y-1 col-span-4">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Fonte (source)
                    </label>
                    <div className={INPUT_WRAP}>
                      <div className={INPUT_BASE}>
                        <input
                          className={INPUT_EL}
                          value={rSource}
                          onChange={(e) => setRSource(e.target.value)}
                          placeholder="steam / igdb / rawg"
                          disabled={!savedGameId || !!editingSource}
                          title={
                            editingSource
                              ? "Para trocar a fonte, exclua e crie outra."
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 col-span-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Nota
                    </label>
                    <div className={INPUT_WRAP}>
                      <div className={INPUT_BASE}>
                        <input
                          className={INPUT_EL}
                          value={rScore}
                          onChange={(e) => setRScore(e.target.value)}
                          placeholder="ex: 84.5"
                          inputMode="decimal"
                          disabled={!savedGameId}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 col-span-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Nota Máxima
                    </label>
                    <div className={INPUT_WRAP}>
                      <div className={INPUT_BASE}>
                        <input
                          className={INPUT_EL}
                          value={rScaleMax}
                          onChange={(e) => setRScaleMax(e.target.value)}
                          placeholder="100"
                          inputMode="decimal"
                          disabled={!savedGameId}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 col-span-6">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Link
                    </label>
                    <div className={INPUT_WRAP}>
                      <div className={INPUT_BASE}>
                        <Link2
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                        <input
                          className={cx(INPUT_EL, "pl-9 pr-3")}
                          value={rUrl}
                          onChange={(e) => setRUrl(e.target.value)}
                          placeholder="https://..."
                          disabled={!savedGameId}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    className={cx(BTN_GREEN, CLICKABLE, "h-11")}
                    onClick={handleSaveRating}
                    disabled={loading || !savedGameId}
                    title={
                      !savedGameId ? "Salve o jogo antes" : "Salvar avaliação"
                    }
                  >
                    <Star size={16} className="mr-2" />
                    Salvar avaliação
                  </Button>

                  {editingSource ? (
                    <Button
                      variant="outline"
                      className={cx("h-11 rounded-xl", CLICKABLE)}
                      onClick={cancelEditRating}
                      disabled={loading}
                    >
                      <X size={16} className="mr-2" />
                      Cancelar edição
                    </Button>
                  ) : null}
                </div>

                <div className="mt-3 text-[11px] text-muted-foreground/80">
                  *Dica: use fontes como{" "}
                  <span className="font-semibold">steam</span>,{" "}
                  <span className="font-semibold">igdb</span>,{" "}
                  <span className="font-semibold">rawg</span>. Sua tabela
                  bloqueia duplicado por (user, game, source).
                </div>
              </div>

              {/* lista */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">
                  Registradas
                </div>

                {sortedRatings.length ? (
                  <div className="space-y-2">
                    {sortedRatings.map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-card/40 p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-1 text-[11px] font-semibold text-violet-200">
                              <Star size={12} className="opacity-80" />
                              {r.source.toUpperCase()}
                            </span>

                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                              {fmtScore(r.score, r.scale_max)}
                            </span>

                            <span className="text-[11px] text-muted-foreground">
                              atualizado: {timeAgoShort(r.retrieved_at)}
                            </span>
                          </div>

                          {r.url ? (
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200"
                            >
                              abrir link <ArrowUpRight size={12} />
                            </a>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            className={cx(
                              "h-10 rounded-xl",
                              CLICKABLE,
                              "border-emerald-500/25 hover:bg-emerald-500/10"
                            )}
                            onClick={() => beginEditRating(r)}
                            disabled={loading || !savedGameId}
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
                            onClick={() => handleDeleteRating(r.id)}
                            disabled={loading || !savedGameId}
                          >
                            <Trash2 size={16} className="mr-2" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {savedGameId ? "Nenhuma avaliação externa ainda." : "—"}
                  </div>
                )}
              </div>
            </section>

            {/* sticky footer - ratings */}
            <div
              className={cx(
                "sticky bottom-0 -mx-5 mt-6 border-t border-border/50 bg-background/40 backdrop-blur-xl",
                "px-5 py-4"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  className={cx("h-11 rounded-xl", CLICKABLE)}
                  onClick={() => setTab("game")}
                  disabled={loading}
                >
                  <ArrowLeft size={16} className="mr-2" />
                  Voltar pro jogo
                </Button>

                <Button
                  variant="outline"
                  className={cx("h-11 rounded-xl", CLICKABLE)}
                  onClick={onClose}
                  disabled={loading}
                >
                  <X size={16} className="mr-2" />
                  Fechar
                </Button>

                <Button
                  className={cx("h-11 ml-auto", BTN_GREEN, CLICKABLE)}
                  onClick={handleSaveRating}
                  disabled={loading || !savedGameId}
                  title={
                    !savedGameId ? "Salve o jogo antes" : "Salvar avaliação"
                  }
                >
                  <Star size={16} className="mr-2" />
                  Salvar avaliação
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </RightDrawer>
  );
}
