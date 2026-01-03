"use client";

import { Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

type AppTopbarProps = {
  q: string;
  onQChange: (next: string) => void;
  onOpenMenu?: () => void;
};

export function AppTopbar({ q, onQChange, onOpenMenu }: AppTopbarProps) {
  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-20",
        "border-b border-border/60 bg-background/80 backdrop-blur-xl",
        "dark:border-border/40 dark:bg-background/60",
      ].join(" ")}
    >
      <div className="flex h-16 w-full items-center gap-3 px-3 sm:px-6">
        {/* Left */}
        <div className="flex items-center gap-3">
          <div className="lg:hidden">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 cursor-pointer rounded-xl border-border/60 bg-card/40"
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
            <div className="kb-ring kb-ring-focus">
              <div className="kb-ring-inner relative h-10 w-full rounded-xl border border-border/70 bg-background/90 ring-1 ring-border/20 shadow-sm transition-all dark:border-border/50 dark:bg-background/70 dark:shadow-none">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={q}
                  onChange={(e) => onQChange(e.target.value)}
                  placeholder="Buscar jogo, nota, sessão..."
                  className="h-10 w-full bg-transparent pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right (vazio por enquanto) */}
        <div className="ml-auto" />
      </div>
    </header>
  );
}
