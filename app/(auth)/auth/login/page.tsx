"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { getAuth } from "@/lib/gcp-auth/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      setError("Por favor completa ambos campos");
      setIsLoading(false);
      return;
    }

    try {
      const auth = getAuth();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      // Send idToken to backend to create session cookie
      const sessionResponse = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!sessionResponse.ok) {
        setError("Error al crear la sesión");
        setIsLoading(false);
        return;
      }

      toast.success("Sesión iniciada correctamente");
      router.push("/admin/users");
    } catch (err: any) {
      const code = err.code || "";
      let errorMsg = "Error al iniciar sesión";

      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        errorMsg = "Correo o contraseña incorrectos.";
      } else if (code === "auth/user-disabled") {
        errorMsg = "Tu cuenta está desactivada. Contacta al administrador.";
      } else if (code === "auth/network-request-failed") {
        errorMsg = "No se pudo conectar. Intenta de nuevo.";
      } else if (code === "auth/too-many-requests") {
        errorMsg = "Demasiados intentos. Espera unos minutos.";
      }

      setError(errorMsg);
      setIsLoading(false);
    }
  }

  return (
    <>
      {reason === "expired" && (
        <div className="mb-4 w-full max-w-md">
          <Alert className="bg-muted text-muted-foreground border-muted">
            <AlertDescription>
              Tu sesión expiró. Vuelve a entrar.
            </AlertDescription>
          </Alert>
        </div>
      )}
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">Iniciar sesión</CardTitle>
          <CardDescription>
            Ingresa tu correo y contraseña para acceder al panel.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="nombre@ejemplo.com"
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <Link href="/auth/reset-password" className="text-sm font-medium text-primary hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                disabled={isLoading}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Ingresar"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Card className="w-full max-w-md shadow-lg p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </Card>
    }>
      <LoginForm />
    </Suspense>
  );
}
