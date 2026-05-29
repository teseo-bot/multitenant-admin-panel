import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center space-y-6 text-center max-w-md">
        <div className="rounded-full bg-destructive/10 p-6">
          <ShieldAlert className="h-12 w-12 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Access Denied</h1>
          <p className="text-muted-foreground">
            You do not have permission to view this page. If you believe this is an error, please contact your administrator.
          </p>
        </div>
        <Button render={<Link href="/" />}>
          Return to Home
        </Button>
      </div>
    </div>
  );
}
