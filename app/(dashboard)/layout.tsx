import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { GlobalLayout } from "@/components/layout/GlobalLayout";
import { logoutAction } from "@/app/(auth)/actions";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getTenantRole } from "@/utils/server/rbac";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  let role = "MEMBER";

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data?.user;
    if (user) {
      role = await getTenantRole(user.id) || "MEMBER";
    }
  } catch (err: any) {
    if (err?.digest === 'DYNAMIC_SERVER_USAGE') {
      throw err;
    }
    console.error("Supabase SSR error in dashboard layout:", err);
  }

  if (!user) {
    redirect("/auth/login");
  }

  // Mapper to ensure user object matches expected interface
  const userProps = {
    id: user.id,
    email: user.email || "",
    name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
    avatar_url: user.user_metadata?.avatar_url || "",
    role: role || "MEMBER", // Defaulting to member if not found
  };

  return (
    <TooltipProvider>
      <GlobalLayout user={userProps} onLogout={logoutAction}>
        {children}
      </GlobalLayout>
    </TooltipProvider>
  );
}
