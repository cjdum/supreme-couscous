import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/layout/top-bar";
import { BottomNav } from "@/components/layout/bottom-nav";

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
      <TopBar username={profile?.username} />
      <main
        className="pt-16 animate-fade"
        style={{ paddingBottom: "max(88px, calc(env(safe-area-inset-bottom) + 76px))" }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
