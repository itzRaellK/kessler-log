import type { ReactNode } from "react";
import { AppShellWithSidebar } from "@/app/components/sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShellWithSidebar>{children}</AppShellWithSidebar>;
}
