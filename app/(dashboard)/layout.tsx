import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/top-bar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { DashboardMain } from "@/components/layout/dashboard-main";
import { GlobalEnhancers } from "@/components/layout/global-enhancers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = profileRaw as { username: string } | null;

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] gradient-bg">
      <GlobalEnhancers />
      <TopBar username={profile?.username} />
      <SidebarNav username={profile?.username} />
      <DashboardMain>
        {children}
      </DashboardMain>
      <BottomNav />
    </div>
  );
}
