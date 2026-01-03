"use client";

import { useMemo, useState, useEffect, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Eye, EyeOff, CheckCircle, AlertCircle, LogOut } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

type Mode = "signin" | "signup";

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

/* =========================
   Animated BG (Ciclos / Orbs)
========================= */

type Orb = {
  id: string;
  size: number; // px
  x0: number; // vw
  y0: number; // vh
  x1: number; // vw
  y1: number; // vh
  drift: number; // px extra
  duration: number;
  delay: number;
  opacity: number;
  blur: number; // px
  hue: "violet" | "emerald" | "blue" | "rose";
  mode: "float" | "orbit";
};

function makeSeededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]) {
  return arr[Math.floor(rng() * arr.length)];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function bgForHue(hue: Orb["hue"]) {
  if (hue === "violet")
    return "radial-gradient(circle at 30% 30%, rgba(168,85,247,0.28), transparent 60%)";
  if (hue === "emerald")
    return "radial-gradient(circle at 40% 40%, rgba(16,185,129,0.24), transparent 62%)";
  if (hue === "blue")
    return "radial-gradient(circle at 50% 45%, rgba(59,130,246,0.22), transparent 62%)";
  return "radial-gradient(circle at 45% 45%, rgba(244,63,94,0.20), transparent 62%)";
}

function AnimatedBg() {
  const reduceMotion = useReducedMotion();

  const orbs = useMemo<Orb[]>(() => {
    const rng = makeSeededRng(1337);
    const hues: Orb["hue"][] = ["violet", "emerald", "blue", "rose"];

    const list: Orb[] = [];
    const count = 12;

    for (let i = 0; i < count; i++) {
      const hue = pick(rng, hues);

      const big = rng() > 0.65;
      const size = big ? 520 + rng() * 420 : 220 + rng() * 260;
      const opacity = big ? 0.16 + rng() * 0.1 : 0.14 + rng() * 0.1;
      const blur = big ? 56 + rng() * 40 : 34 + rng() * 26;

      const fromSide = Math.floor(rng() * 4);
      const toSide = (fromSide + 2 + Math.floor(rng() * 2)) % 4;

      const start = (() => {
        if (fromSide === 0) return { x: rng() * 100, y: -18 };
        if (fromSide === 1) return { x: 118, y: rng() * 100 };
        if (fromSide === 2) return { x: rng() * 100, y: 118 };
        return { x: -18, y: rng() * 100 };
      })();

      const end = (() => {
        if (toSide === 0) return { x: rng() * 100, y: -18 };
        if (toSide === 1) return { x: 118, y: rng() * 100 };
        if (toSide === 2) return { x: rng() * 100, y: 118 };
        return { x: -18, y: rng() * 100 };
      })();

      const duration = 22 + rng() * 26;
      const delay = rng() * 8;
      const drift = 40 + rng() * 160;

      const mode: Orb["mode"] = rng() > 0.75 ? "orbit" : "float";

      list.push({
        id: `orb-${i}`,
        size,
        x0: start.x,
        y0: start.y,
        x1: end.x,
        y1: end.y,
        drift,
        duration,
        delay,
        opacity,
        blur,
        hue,
        mode,
      });
    }

    return list;
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.05)_1px,transparent_0)] bg-[size:28px_28px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.035)_1px,transparent_0)]" />

      {orbs.map((o, idx) => {
        const common: CSSProperties = {
          width: o.size,
          height: o.size,
          filter: `blur(${o.blur}px)`,
          opacity: o.opacity,
          background: bgForHue(o.hue),
          mixBlendMode: "overlay",
        };

        if (reduceMotion) {
          const x = lerp(o.x0, o.x1, 0.35);
          const y = lerp(o.y0, o.y1, 0.35);
          return (
            <div
              key={o.id}
              className="absolute rounded-full"
              style={{
                ...common,
                left: `${x}vw`,
                top: `${y}vh`,
                transform: "translate(-50%, -50%)",
              }}
            />
          );
        }

        if (o.mode === "orbit") {
          return (
            <motion.div
              key={o.id}
              className="absolute rounded-full"
              style={{
                ...common,
                left: `${lerp(o.x0, o.x1, 0.5)}vw`,
                top: `${lerp(o.y0, o.y1, 0.5)}vh`,
                transform: "translate(-50%, -50%)",
              }}
              animate={{
                rotate: [0, 360],
                x: [-(o.drift * 0.35), o.drift * 0.35, -(o.drift * 0.35)],
                y: [o.drift * 0.25, -(o.drift * 0.25), o.drift * 0.25],
                scale: [1, 1.06, 1],
              }}
              transition={{
                rotate: {
                  duration: o.duration * 1.25,
                  ease: "linear",
                  repeat: Infinity,
                  delay: o.delay,
                },
                x: {
                  duration: o.duration,
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: o.delay,
                },
                y: {
                  duration: o.duration * 0.9,
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: o.delay * 0.8,
                },
                scale: {
                  duration: 10 + (idx % 5) * 2,
                  ease: "easeInOut",
                  repeat: Infinity,
                },
              }}
            />
          );
        }

        return (
          <motion.div
            key={o.id}
            className="absolute rounded-full"
            style={{
              ...common,
              left: `${o.x0}vw`,
              top: `${o.y0}vh`,
              transform: "translate(-50%, -50%)",
            }}
            animate={{
              left: [`${o.x0}vw`, `${o.x1}vw`],
              top: [`${o.y0}vh`, `${o.y1}vh`],
              x: [0, o.drift, -o.drift * 0.5, 0],
              y: [0, -o.drift * 0.6, o.drift * 0.3, 0],
              scale: [1, 1.05, 0.98, 1],
              opacity: [o.opacity * 0.75, o.opacity, o.opacity * 0.75],
            }}
            transition={{
              duration: o.duration,
              delay: o.delay,
              repeat: Infinity,
              repeatType: "mirror",
              ease: "easeInOut",
            }}
          />
        );
      })}
    </div>
  );
}

/* =========================
            Page
========================= */

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );

  // ✅ se já tem sessão: não deixa ficar no /login
  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data.session) router.replace("/home");
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace("/home");
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  const canSubmit = useMemo(() => {
    const e = email.trim();
    return e.length >= 3 && password.length >= 6;
  }, [email, password]);

  async function handleSubmit() {
    setLoading(true);
    setMsg(null);

    try {
      const e = email.trim();

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email: e, password });
        if (error) throw error;

        setMsg({
          kind: "ok",
          text: "Conta criada! Confirme seu e-mail e faça login.",
        });
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: e,
          password,
        });
        if (error) throw error;

        // ✅ redirect pós login
        router.replace("/home");
      }
    } catch (e: any) {
      setMsg({
        kind: "err",
        text: e?.message ?? "Erro inesperado. Tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setMsg({ kind: "ok", text: "Você saiu da sua conta." });
      // (você já está no /login, então não precisa router aqui)
    } catch (e: any) {
      setMsg({ kind: "err", text: e?.message ?? "Erro ao sair." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (msg) {
      const timer = setTimeout(() => setMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [msg]);

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-background">
      <AnimatedBg />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:py-12">
        {/* Left: branding */}
        <motion.section
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="font-medium">KesslerLog</span>
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Organize suas jogatinas.
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent">
                Registre sessões, notas e reviews.
              </span>
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground/90 sm:text-base">
              Timer por sessão, texto enquanto joga, nota 0–10, ciclos por jogo
              (rejogar sem perder histórico) e dashboard com estatísticas.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              {
                title: "Sessão em andamento",
                desc: "Escreva durante o timer e finalize quando quiser.",
              },
              {
                title: "Review final",
                desc: "Compare sua nota com a média das sessões.",
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 * i }}
                className="rounded-xl border border-border/40 bg-card/40 p-4 backdrop-blur-sm"
              >
                <div className="text-sm font-semibold text-foreground">
                  {item.title}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {item.desc}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Right: auth card */}
        <motion.section
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto w-full max-w-md"
        >
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/70 p-6 shadow-xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    <h2 className="text-xl font-semibold text-foreground">
                      {mode === "signin"
                        ? "Bem-vindo de volta"
                        : "Criar sua conta"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {mode === "signin"
                        ? "Entre com seu e-mail e senha."
                        : "Crie para registrar suas sessões."}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex items-center gap-2">
                <ThemeToggle />

                <div className="flex rounded-lg border border-border/50 bg-card/50 p-1">
                  {(["signin", "signup"] as Mode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={cx(
                        "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        mode === m
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-pressed={mode === m}
                    >
                      {m === "signin" ? "Login" : "Criar"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit();
                  }}
                  className="mt-6 space-y-4"
                >
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="text-sm font-medium text-foreground"
                    >
                      E-mail
                    </label>
                    <input
                      id="email"
                      type="email"
                      className="h-11 w-full rounded-lg border border-border/50 bg-background/70 px-4 text-sm text-foreground outline-none ring-offset-background transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                      autoComplete="email"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="password"
                      className="text-sm font-medium text-foreground"
                    >
                      Senha
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        className="h-11 w-full rounded-lg border border-border/50 bg-background/70 px-4 pr-12 text-sm text-foreground outline-none ring-offset-background transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        type={showPass ? "text" : "password"}
                        autoComplete={
                          mode === "signin"
                            ? "current-password"
                            : "new-password"
                        }
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={
                          showPass ? "Ocultar senha" : "Mostrar senha"
                        }
                      >
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {msg && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className={cx(
                          "overflow-hidden rounded-lg border px-3 py-2.5 text-sm",
                          msg.kind === "ok"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-destructive/40 bg-destructive/10 text-destructive"
                        )}
                        role="alert"
                      >
                        {msg.kind === "ok" ? (
                          <div className="flex items-start gap-2">
                            <CheckCircle
                              size={16}
                              className="mt-0.5 flex-shrink-0"
                            />
                            <span>{msg.text}</span>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <AlertCircle
                              size={16}
                              className="mt-0.5 flex-shrink-0"
                            />
                            <span>{msg.text}</span>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="submit"
                      className="h-11 cursor-pointer"
                      disabled={!canSubmit || loading}
                    >
                      {mode === "signin" ? "Entrar" : "Criar conta"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 cursor-pointer"
                      onClick={handleSignOut}
                      disabled={loading}
                    >
                      <LogOut size={16} className="mr-1" />
                      Sair
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground/80">
                    Dica: após logar, acesse{" "}
                    <code className="rounded bg-muted px-1 font-mono text-xs">
                      /games
                    </code>{" "}
                    para cadastrar jogos.
                  </p>
                </form>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
