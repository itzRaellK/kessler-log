"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, Sparkles, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RightDrawer } from "@/app/(app)/games/components/RightDrawer"; // ajuste o path se quiser mover o RightDrawer pra shared

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

const GLASS_CARD =
  "rounded-2xl border border-border/50 bg-card/60 shadow-xl backdrop-blur-xl";
const SOFT_RING = "ring-1 ring-border/20";

const BTN_GREEN =
  "cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 hover:from-emerald-400 hover:to-emerald-300 shadow-sm dark:text-emerald-950";

export type RunStatusOption = {
  id: string;
  name: string;
  is_active?: boolean;
  slug?: string;
};

export type RunItem = {
  id: string;
  title: string;
  subtitle?: string | null;
};

export type RunState = {
  cycleId: string | null;
  sessionId: string | null;
  sessionStartedAt: string | null;
  sessionEndedAt: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;

  item: RunItem;

  // status selection
  statuses: RunStatusOption[];
  hasStatuses: boolean;
  statusToStart: string | null;
  onChangeStatusToStart: (id: string | null) => void;
  onEnsureDefaultStatuses?: () => Promise<void> | void;

  // external state / messages (opcional)
  loading?: boolean;
  msg?: string | null;

  // injected logic (setor-agnostic)
  loadState: (itemId: string) => Promise<RunState>;
  start: (
    itemId: string,
    statusId: string,
    noteText?: string | null
  ) => Promise<RunState>;
  stop: (
    sessionId: string,
    score?: string | number | null,
    noteText?: string | null
  ) => Promise<boolean>;
};

function formatHHMMSS(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function RunDrawer({
  open,
  onClose,
  item,
  statuses,
  hasStatuses,
  statusToStart,
  onChangeStatusToStart,
  onEnsureDefaultStatuses,
  loading = false,
  msg,
  loadState,
  start,
  stop,
}: Props) {
  const firstRef = useRef<HTMLInputElement | null>(null);

  const [state, setState] = useState<RunState>({
    cycleId: null,
    sessionId: null,
    sessionStartedAt: null,
    sessionEndedAt: null,
  });

  const [startNote, setStartNote] = useState("");
  const [endScore, setEndScore] = useState("");
  const [endNote, setEndNote] = useState("");

  const [tick, setTick] = useState(0);

  // carrega estado ao abrir / trocar item
  useEffect(() => {
    if (!open) return;

    let alive = true;
    (async () => {
      try {
        const st = await loadState(item.id);
        if (!alive) return;
        setState(st);
        setStartNote("");
        setEndScore("");
        setEndNote("");
      } catch {
        // msg vem de fora se você quiser
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, item.id, loadState]);

  const hasActiveCycle = !!state.cycleId;
  const hasOpenSession = !!state.sessionId && !state.sessionEndedAt;

  // timer ao vivo
  useEffect(() => {
    if (!open || !hasOpenSession || !state.sessionStartedAt) return;
    const id = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(id);
  }, [open, hasOpenSession, state.sessionStartedAt]);

  const elapsed = useMemo(() => {
    if (!hasOpenSession || !state.sessionStartedAt) return 0;
    const startMs = new Date(state.sessionStartedAt).getTime();
    return Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  }, [hasOpenSession, state.sessionStartedAt, tick]);

  async function handleStart() {
    const stId = statusToStart ?? "";
    if (!stId) return;

    const next = await start(item.id, stId, startNote);
    setState(next);
  }

  async function handleStop() {
    if (!state.sessionId) return;

    const ok = await stop(state.sessionId, endScore, endNote);
    if (!ok) return;

    // recarrega pra refletir ended_at
    const next = await loadState(item.id);
    setState(next);
  }

  return (
    <RightDrawer
      open={open}
      onClose={onClose}
      title="Run"
      subtitle={item.title}
      widthClass="max-w-xl"
      initialFocusRef={firstRef as any}
    >
      <div className="space-y-4">
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

        {/* bloco status */}
        <div className={cx(GLASS_CARD, SOFT_RING, "bg-card/40 p-4")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-muted-foreground">
              {hasActiveCycle ? (
                <>
                  Ciclo ativo:{" "}
                  <span className="font-semibold">
                    {state.cycleId?.slice(0, 8)}…
                  </span>
                </>
              ) : (
                <>Sem ciclo ativo. Selecione o status e inicie.</>
              )}
            </div>

            <div className="flex items-center gap-2">
              <select
                className={cx(
                  "h-10 rounded-xl border border-border/50 bg-background/70 px-3 text-sm text-foreground outline-none",
                  "focus:ring-1 focus:ring-border/40"
                )}
                value={statusToStart ?? ""}
                onChange={(e) => onChangeStatusToStart(e.target.value || null)}
                disabled={!hasStatuses || loading || hasActiveCycle}
                title={
                  !hasStatuses
                    ? "Crie status padrão antes"
                    : hasActiveCycle
                    ? "Já existe ciclo ativo"
                    : "Selecione o status inicial"
                }
              >
                {!hasStatuses ? <option value="">(sem status)</option> : null}
                {statuses
                  .filter((s) => s.is_active ?? true)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>

              {!hasStatuses && onEnsureDefaultStatuses ? (
                <Button
                  className={cx(BTN_GREEN, "h-10")}
                  onClick={() => onEnsureDefaultStatuses()}
                  disabled={loading}
                >
                  <Sparkles size={16} className="mr-2" />
                  Criar status
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* estado: não tem ciclo → start */}
        {!hasActiveCycle ? (
          <div className={cx(GLASS_CARD, SOFT_RING, "bg-card/40 p-4")}>
            <div className="text-sm font-semibold text-foreground mb-2">
              Iniciar agora
            </div>

            <label className="text-xs font-semibold text-muted-foreground">
              Nota rápida (opcional)
            </label>
            <input
              ref={firstRef}
              className="mt-2 h-11 w-full rounded-xl border border-border/70 bg-background/90 px-3 text-sm text-foreground outline-none"
              value={startNote}
              onChange={(e) => setStartNote(e.target.value)}
              placeholder="ex: hoje vou focar em..."
              disabled={loading}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                className={cx(BTN_GREEN, "h-11")}
                onClick={handleStart}
                disabled={loading || !hasStatuses || !statusToStart}
                title={!statusToStart ? "Selecione um status" : "Iniciar"}
              >
                <Play size={16} className="mr-2" />
                Iniciar ciclo + sessão
              </Button>

              <Button
                variant="outline"
                className="h-11 rounded-xl"
                onClick={onClose}
                disabled={loading}
              >
                <X size={16} className="mr-2" />
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          // estado: tem ciclo → mostra sessão/timer e stop
          <div className={cx(GLASS_CARD, SOFT_RING, "bg-card/40 p-4")}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Sessão
                </div>
                <div className="text-xs text-muted-foreground">
                  {hasOpenSession ? "Em andamento" : "Nenhuma sessão aberta"}
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm">
                <Timer size={16} className="opacity-80" />
                <span className="font-mono">{formatHHMMSS(elapsed)}</span>
              </div>
            </div>

            {hasOpenSession ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Score (0..10, opcional)
                    </label>
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-border/70 bg-background/90 px-3 text-sm text-foreground outline-none"
                      value={endScore}
                      onChange={(e) => setEndScore(e.target.value)}
                      placeholder="ex: 8.5"
                      inputMode="decimal"
                      disabled={loading}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Nota final (opcional)
                    </label>
                    <input
                      className="mt-2 h-11 w-full rounded-xl border border-border/70 bg-background/90 px-3 text-sm text-foreground outline-none"
                      value={endNote}
                      onChange={(e) => setEndNote(e.target.value)}
                      placeholder="ex: progresso de hoje..."
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl border-destructive/30 hover:bg-destructive/10"
                    onClick={handleStop}
                    disabled={loading}
                  >
                    <Square size={16} className="mr-2" />
                    Finalizar sessão
                  </Button>

                  <Button
                    variant="outline"
                    className="h-11 rounded-xl ml-auto"
                    onClick={onClose}
                    disabled={loading}
                  >
                    <X size={16} className="mr-2" />
                    Fechar
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-4 text-sm text-muted-foreground">
                Sessão já foi encerrada (ou não existe). Depois a gente adiciona
                “Iniciar nova sessão” dentro do ciclo.
              </div>
            )}
          </div>
        )}
      </div>
    </RightDrawer>
  );
}
