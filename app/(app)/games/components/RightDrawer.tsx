"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useId,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

/** ====== “DNA” do vidro (alinhado com o 1º drawer) ====== */
const OVERLAY_GLASS = "bg-black/50 backdrop-blur-sm";
const PANEL_GLASS =
  "border-l border-border/60 bg-background/60 shadow-2xl backdrop-blur-xl";
const HEADER_GLASS =
  "sticky top-0 z-10 border-b border-border/50 bg-background/40 backdrop-blur-xl";

type RightDrawerProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;

  /** ex: "max-w-xl" | "max-w-2xl" | "max-w-[720px]" */
  widthClass?: string;
  /** classes extras no painel */
  className?: string;

  /** padrão: true */
  closeOnOverlayClick?: boolean;
  /** padrão: true */
  closeOnEsc?: boolean;

  /** se quiser focar um input específico ao abrir */
  initialFocusRef?: RefObject<HTMLElement>;
};

function getFocusable(container: HTMLElement | null) {
  if (!container) return [] as HTMLElement[];

  const els = Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        'a[href]:not([tabindex="-1"])',
        'button:not([disabled]):not([tabindex="-1"])',
        'input:not([disabled]):not([tabindex="-1"])',
        'select:not([disabled]):not([tabindex="-1"])',
        'textarea:not([disabled]):not([tabindex="-1"])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(",")
    )
  );

  return els.filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

export function RightDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  widthClass = "max-w-3xl",
  className,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  initialFocusRef,
}: RightDrawerProps) {
  const reduceMotion = useReducedMotion();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const titleId = useId();
  const descId = useId();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const overlayAnim = useMemo(() => {
    if (reduceMotion)
      return {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
      };
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }, [reduceMotion]);

  const panelAnim = useMemo(() => {
    if (reduceMotion)
      return { initial: { x: 0 }, animate: { x: 0 }, exit: { x: 0 } };
    return {
      initial: { x: 48, opacity: 0.98 },
      animate: { x: 0, opacity: 1 },
      exit: { x: 48, opacity: 0.98 },
    };
  }, [reduceMotion]);

  // ESC + trap de foco
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = getFocusable(panelRef.current);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (!active || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeOnEsc, onClose]);

  // trava scroll do body
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // salva/restaura foco
  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const t = window.setTimeout(() => {
      const el =
        initialFocusRef?.current ??
        closeBtnRef.current ??
        getFocusable(panelRef.current)[0] ??
        null;

      el?.focus();
    }, 0);

    return () => window.clearTimeout(t);
  }, [open, initialFocusRef]);

  useEffect(() => {
    if (open) return;
    const el = previouslyFocusedRef.current;
    if (el && typeof el.focus === "function") {
      window.setTimeout(() => el.focus(), 0);
    }
  }, [open]);

  if (!mounted) return null;

  const content = (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[999] flex justify-end"
          {...overlayAnim}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
        >
          {/* overlay */}
          <div
            className={cx("absolute inset-0", OVERLAY_GLASS)}
            onMouseDown={() => {
              if (closeOnOverlayClick) onClose();
            }}
          />

          {/* painel */}
          <motion.aside
            ref={panelRef as any}
            {...panelAnim}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={subtitle ? descId : undefined}
            className={cx(
              "relative h-[100dvh] w-full",
              widthClass,
              PANEL_GLASS,
              "flex flex-col", // importante pra scroll do body
              className
            )}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* header (vidro igual ao 1º) */}
            <div className={HEADER_GLASS}>
              <div className="flex items-center justify-between px-5 py-4">
                <div className="min-w-0">
                  <div
                    id={titleId}
                    className="text-sm font-semibold text-foreground"
                  >
                    {title}
                  </div>
                  {subtitle ? (
                    <div
                      id={descId}
                      className="mt-0.5 truncate text-xs text-muted-foreground"
                    >
                      {subtitle}
                    </div>
                  ) : null}
                </div>

                <Button
                  ref={closeBtnRef}
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl"
                  onClick={onClose}
                >
                  <X size={18} />
                </Button>
              </div>
            </div>

            {/* body */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
