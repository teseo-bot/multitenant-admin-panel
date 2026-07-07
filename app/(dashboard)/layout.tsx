import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { GlobalLayout } from "@/components/layout/GlobalLayout";
import { logoutAction } from "@/app/(auth)/actions";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getTenantRole } from "@/utils/server/rbac";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = await getCurrentUser();
  let role = "MEMBER";

  if (user) {
    role = await getTenantRole(user.id) || "MEMBER";
  }

  if (!user) {
    redirect("/auth/login");
  }

  // Mapper to ensure user object matches expected interface
  const userProps = {
    id: user.id,
    email: user.email || "",
    name: user.email?.split("@")[0] || "User",
    avatar_url: "",
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
