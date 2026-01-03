"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Menu, ArrowUpRight, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { cx } from "class-variance-authority";

type GameHit = {
  id: string;
  title: string;
  platform: string | null;
  cover_url: string | null;
};

type AppTopbarProps = {
  q: string;
  onQChange: (next: string) => void;
  onOpenMenu?: () => void;
};

export function AppTopbar({ q, onQChange, onOpenMenu }: AppTopbarProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loadingHits, setLoadingHits] = useState(false);
  const [hits, setHits] = useState<GameHit[]>([]);

  const blurCloseTimer = useRef<number | null>(null);

  const qTrim = q.trim();
  const hasQuery = qTrim.length >= 2;

  // debounce simples
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      if (!hasQuery) {
        setHits([]);
        return;
      }

      setLoadingHits(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? null;

        if (!uid) {
          if (!alive) return;
          setHits([]);
          return;
        }

        const { data, error } = await supabase
          .schema("kesslerlog")
          .from("games")
          .select("id,title,platform,cover_url")
          .eq("user_id", uid)
          .ilike("title", `%${qTrim}%`)
          .order("created_at", { ascending: false })
          .limit(8);

        if (!alive) return;
        if (error) throw error;

        setHits((data ?? []) as any);
      } catch {
        if (!alive) return;
        setHits([]);
      } finally {
        if (!alive) return;
        setLoadingHits(false);
      }
    }, 220);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [qTrim, hasQuery]);

  const hrefGames = useMemo(
    () => `/games?q=${encodeURIComponent(qTrim)}`,
    [qTrim]
  );

  function scheduleClose() {
    if (blurCloseTimer.current) window.clearTimeout(blurCloseTimer.current);
    blurCloseTimer.current = window.setTimeout(() => setOpen(false), 90);
  }

  function cancelScheduledClose() {
    if (blurCloseTimer.current) window.clearTimeout(blurCloseTimer.current);
    blurCloseTimer.current = null;
  }

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-20",
        "border-b border-border/70",
        // mais sólido / legível
        "bg-background/95 backdrop-blur-xl",
        "dark:bg-background/85 dark:border-border/50",
      ].join(" ")}
    >
      <div className="flex h-16 w-full items-center gap-3 px-3 sm:px-6">
        {/* Left */}
        <div className="flex items-center gap-3">
          <div className="lg:hidden">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 cursor-pointer rounded-xl border-border/60 bg-card/60"
              onClick={onOpenMenu}
              aria-label="Abrir menu"
              type="button"
            >
              <Menu size={18} />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-200">
              <span className="text-sm font-bold">K</span>
            </div>

            <div className="font-semibold tracking-tight text-foreground">
              Kessler<span className="text-emerald-300">Log</span>
            </div>
          </div>
        </div>

        {/* Middle: Search (desktop) */}
        <div className="hidden flex-1 justify-center md:flex">
          <div className="w-full max-w-xl">
            <div className="relative">
              <div className="kb-ring kb-ring-focus">
                <div className="kb-ring-inner relative h-10 w-full rounded-xl border border-border/70 bg-background/95 ring-1 ring-border/20 shadow-sm transition-all dark:border-border/50 dark:bg-background/80 dark:shadow-none">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    value={q}
                    onChange={(e) => onQChange(e.target.value)}
                    onFocus={() => {
                      cancelScheduledClose();
                      setOpen(true);
                    }}
                    onBlur={() => {
                      // fecha quando clica fora
                      scheduleClose();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setOpen(false);
                      if (e.key === "Enter" && qTrim) {
                        router.push(hrefGames); // Enter = abre /games filtrado
                        setOpen(false);
                      }
                    }}
                    placeholder="Buscar jogo, nota, sessão..."
                    className="h-10 w-full bg-transparent pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Dropdown */}
              {open && qTrim ? (
                <div
                  className={cx(
                    "absolute left-0 right-0 mt-2 overflow-hidden rounded-2xl",
                    "border border-border/70 shadow-2xl",
                    // bem mais sólido (não confunde com o BG)
                    "bg-background/95 backdrop-blur-2xl",
                    "dark:bg-background/90"
                  )}
                  onMouseDown={(e) => {
                    // impede blur do input (mantém dropdown aberto ao clicar dentro)
                    e.preventDefault();
                    cancelScheduledClose();
                  }}
                >
                  <div className="p-2">
                    <div className="flex items-center justify-between px-2 py-1">
                      <div className="text-[11px] font-semibold text-muted-foreground">
                        Jogos encontrados
                      </div>
                      {loadingHits ? (
                        <div className="text-[11px] text-muted-foreground">
                          buscando…
                        </div>
                      ) : null}
                    </div>

                    {hits.length ? (
                      <ul className="max-h-72 overflow-auto p-1">
                        {hits.map((g) => {
                          const qGame = encodeURIComponent(g.title);

                          return (
                            <li
                              key={g.id}
                              className="flex items-center justify-between gap-3 rounded-2xl px-2 py-2 hover:bg-muted/30"
                            >
                              {/* thumbnail + texto */}
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="h-12 w-10 shrink-0 overflow-hidden rounded-xl border border-border/60 bg-card/60">
                                  {g.cover_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={g.cover_url}
                                      alt={g.title}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="grid h-full w-full place-items-center text-muted-foreground">
                                      <Gamepad2 size={16} />
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-foreground">
                                    {g.title}
                                  </div>
                                  <div className="truncate text-[11px] text-muted-foreground">
                                    {g.platform ?? "—"}
                                  </div>
                                </div>
                              </div>

                              {/* botões */}
                              <div className="flex items-center gap-2">
                                <Link
                                  className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 px-2 py-1 text-[11px] font-semibold hover:bg-background"
                                  href={`/games?q=${qGame}&gameId=${g.id}`}
                                  onClick={() => setOpen(false)}
                                  title="Abrir em Jogos"
                                >
                                  Jogos
                                </Link>
                                <Link
                                  className="rounded-lg border border-border/70 bg-background/80 px-2 py-1 text-[11px] font-semibold hover:bg-background"
                                  href={`/runs?q=${qGame}&gameId=${g.id}`}
                                  onClick={() => setOpen(false)}
                                  title="Abrir em Sessões"
                                >
                                  Runs
                                </Link>
                                <Link
                                  className="rounded-lg border border-border/70 bg-background/80 px-2 py-1 text-[11px] font-semibold hover:bg-background"
                                  href={`/reviews?q=${qGame}&gameId=${g.id}`}
                                  onClick={() => setOpen(false)}
                                  title="Abrir em Reviews"
                                >
                                  Review
                                </Link>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className="px-2 py-3 text-sm text-muted-foreground">
                        {hasQuery
                          ? "Nenhum jogo encontrado."
                          : "Digite pelo menos 2 caracteres."}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border/60" />
                  <button
                    type="button"
                    className="w-full px-4 py-2 text-left text-xs text-muted-foreground hover:bg-muted/30"
                    onClick={() => setOpen(false)}
                  >
                    Fechar (Esc)
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="ml-auto" />
      </div>
    </header>
  );
}
