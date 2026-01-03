"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppTopbar } from "@/app/components/topbar";
import {
  Home,
  Gamepad2,
  Timer,
  Star,
  BarChart3,
  LogOut,
  ChevronLeft,
  SunMoon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
};

function NavLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const reduceMotion = useReducedMotion();

  const iconWrap = (
    <span
      className={cx(
        "flex h-9 w-9 items-center justify-center rounded-xl border border-border/40",
        "bg-background/40 backdrop-blur-sm transition-colors",
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : "text-muted-foreground group-hover:text-foreground"
      )}
    >
      {item.icon}
    </span>
  );

  const label = (
    <AnimatePresence initial={false}>
      {!collapsed && (
        <motion.div
          key="label"
          initial={reduceMotion ? undefined : { opacity: 0, x: -8 }}
          animate={reduceMotion ? undefined : { opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -8 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.14 }}
          className="min-w-0"
        >
          <div
            className={cx(
              "truncate font-medium transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground group-hover:text-foreground"
            )}
          >
            {item.label}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const content = (
    <>
      {iconWrap}
      {label}
    </>
  );

  if (item.disabled) {
    return (
      <div
        className={cx(
          "group w-full",
          collapsed ? "px-2" : "",
          "cursor-not-allowed opacity-50"
        )}
        title={item.label}
        aria-disabled="true"
      >
        <div className="w-full rounded-xl border border-border/30 bg-card/20">
          <div
            className={cx(
              "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
              collapsed ? "justify-center px-2" : "",
              "bg-card/30 text-muted-foreground"
            )}
          >
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cx(
        "group block w-full",
        collapsed && "px-2",
        "kb-ring",
        active && "kb-ring-active"
      )}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
    >
      <div
        className={cx(
          "kb-ring-inner",
          "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none",
          "transition-colors backdrop-blur-xl focus-visible:outline-none",
          collapsed ? "justify-center px-2" : "",
          active
            ? "bg-card/55 text-foreground"
            : "bg-card/30 text-muted-foreground hover:bg-card/40"
        )}
      >
        {content}
      </div>
    </Link>
  );
}

function SidebarShell({
  collapsed,
  setCollapsed,
  onNavigate,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const items = useMemo<NavItem[]>(
    () => [
      { href: "/home", label: "Home", icon: <Home size={18} /> },
      { href: "/games", label: "Jogos", icon: <Gamepad2 size={18} /> },
      { href: "/runs", label: "Sessões", icon: <Timer size={18} /> },
      { href: "/reviews", label: "Reviews", icon: <Star size={18} /> },
      { href: "/stats", label: "Stats", icon: <BarChart3 size={18} /> },
    ],
    []
  );

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/login");
    }
  }

  return (
    <div
      className={cx(
        "relative flex h-full w-full flex-col overflow-hidden",
        "bg-background/80 backdrop-blur-xl dark:bg-background/60",
        "border-r border-border/60 dark:border-border/40",
        "lg:rounded-none"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-3 dark:border-border/40">
        <div
          className={cx(
            "flex items-center gap-2",
            collapsed && "justify-center"
          )}
        >
          {/* opcional: logo/nome aqui */}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 cursor-pointer rounded-xl border border-border/60 bg-card/30 hover:bg-card/45 dark:border-border/40"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
          type="button"
        >
          <motion.span
            animate={reduceMotion ? undefined : { rotate: collapsed ? 180 : 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18 }}
            className="inline-flex text-muted-foreground"
          >
            <ChevronLeft size={18} />
          </motion.span>
        </Button>
      </div>

      {/* Nav */}
      <div className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        {items.map((it) => (
          <NavLink
            key={it.href}
            item={it}
            active={pathname === it.href || pathname?.startsWith(it.href + "/")}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-border/60 p-3 dark:border-border/40">
        {/* Theme toggle */}
        <div className={cx("mb-2", collapsed ? "flex justify-center" : "")}>
          {!collapsed ? (
            <div className="flex w-full items-center justify-between rounded-xl border border-border/50 bg-card/30 px-3 py-2">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                <SunMoon size={14} className="opacity-80" />
                Tema
              </div>
              <div className="rounded-xl border border-border/70 bg-card/80 p-1 shadow-sm dark:border-border/50 dark:bg-card/40 dark:shadow-none">
                <ThemeToggle />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 bg-card/40 p-1 shadow-sm dark:border-border/50 dark:bg-card/30 dark:shadow-none">
              <ThemeToggle />
            </div>
          )}
        </div>

        {/* Logout */}
        <div
          className={cx(
            "flex items-center gap-2",
            collapsed && "justify-center"
          )}
        >
          <AnimatePresence initial={false} mode="wait">
            {!collapsed ? (
              <motion.div
                key="logout-full"
                initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: 6 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.14 }}
                className="w-full"
              >
                <Button
                  variant="outline"
                  className="h-10 w-full flex-1 cursor-pointer justify-start rounded-xl border-border/50 bg-background/50 hover:bg-background/60"
                  onClick={handleSignOut}
                  type="button"
                >
                  <LogOut size={16} className="mr-2" />
                  Sair
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="logout-icon"
                initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: 6 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.14 }}
              >
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 cursor-pointer rounded-xl border-border/50 bg-background/50 hover:bg-background/60"
                  onClick={handleSignOut}
                  aria-label="Sair"
                  type="button"
                >
                  <LogOut size={16} />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function AppShellWithSidebar({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!mobileOpen) return;
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mobileOpen]);

  const SB_EXPANDED = 280;
  const SB_COLLAPSED = 88;
  const sbW = collapsed ? SB_COLLAPSED : SB_EXPANDED;

  const sbTransition = reduceMotion
    ? { duration: 0 }
    : {
        type: "spring" as const,
        stiffness: 260,
        damping: 30,
        mass: 0.8,
      };

  return (
    <motion.div
      className="relative min-h-screen bg-background overflow-x-hidden"
      initial={false}
      animate={{ ["--sb-w" as any]: sbW } as any}
      transition={sbTransition}
      style={{ ["--sb-w" as any]: sbW } as React.CSSProperties}
    >
      <AppTopbar
        q={q}
        onQChange={setQ}
        onOpenMenu={() => setMobileOpen(true)}
      />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden lg:block w-[calc(var(--sb-w)*1px)]">
        <div className="h-full pt-16">
          <SidebarShell collapsed={collapsed} setCollapsed={setCollapsed} />
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="relative min-h-[calc(100vh-4rem)] pt-16 lg:pl-[calc(var(--sb-w)*1px)]">
        {children}
      </main>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-50 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
            />
            <motion.aside
              className="fixed left-0 top-0 z-50 h-full w-[320px] max-w-[85vw]"
              initial={{ x: -380, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -380, opacity: 0 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.22, ease: "easeOut" }
              }
            >
              <div className="h-full pt-16">
                <SidebarShell
                  collapsed={false}
                  setCollapsed={() => {}}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
