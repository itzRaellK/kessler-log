"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function IndexGate() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function run() {
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data.session;

      if (!mounted) return;

      // login primeiro, home depois de logar
      router.replace(hasSession ? "/home" : "/login");
      setLoading(false);
    }

    run();

    return () => {
      mounted = false;
    };
  }, [router]);

  // opcional: uma tela de loading bem simples
  return (
    <main className="min-h-screen grid place-items-center">
      <div className="text-sm text-muted-foreground">
        {loading ? "Carregando..." : ""}
      </div>
    </main>
  );
}
