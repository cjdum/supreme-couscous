import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/top-bar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { DashboardMain } from "@/components/layout/dashboard-main";
import { GlobalEnhancers } from "@/components/layout/global-enhancers";
import { ToastProvider } from "@/components/ui/toast";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  let profile: { username: string } | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
    if (user) {
      const { data: profileRaw } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle();
      profile = profileRaw as { username: string } | null;
    }
  } catch (err) {
    console.error("[dashboard layout] auth error:", err);
    redirect("/login");
  }

  if (!user) redirect("/login");

  return (
    <ToastProvider>
      <div className="min-h-dvh bg-[var(--color-bg)] gradient-bg">
        <GlobalEnhancers />
        <TopBar username={profile?.username} />
        <SidebarNav username={profile?.username} />
        <DashboardMain>
          {children}
        </DashboardMain>
        <BottomNav />
      </div>
    </ToastProvider>
  );
}
