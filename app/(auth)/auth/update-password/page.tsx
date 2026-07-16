"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuth } from "@/lib/gcp-auth/client";
import { confirmPasswordReset } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      setIsLoading(false);
      return;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      toast.error("La contraseña debe incluir mayúsculas, minúsculas y números.");
      setIsLoading(false);
      return;
    }

    if (!oobCode) {
      toast.error("Enlace inválido o expirado. Solicita uno nuevo.");
      setIsLoading(false);
      return;
    }

    try {
      // Identity Platform: confirma el reset con el oobCode del enlace del correo.
      await confirmPasswordReset(getAuth(), oobCode, password);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/expired-action-code" || code === "auth/invalid-action-code") {
        toast.error("El enlace expiró o no es válido. Solicita uno nuevo.");
      } else if (code === "auth/weak-password") {
        toast.error("La contraseña es demasiado débil.");
      } else {
        toast.error("Error al actualizar la contraseña.");
      }
      setIsLoading(false);
      return;
    }

    toast.success("Contraseña actualizada exitosamente.");
    // Sin sesión activa en este flujo: el usuario entra con la nueva credencial.
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight">Crear nueva contraseña</CardTitle>
        <CardDescription>
          Ingresa y confirma tu nueva credencial de acceso.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              disabled={isLoading}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
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
                Actualizando...
              </>
            ) : (
              "Guardar contraseña"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<Card className="w-full max-w-md shadow-lg p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></Card>}>
      <UpdatePasswordForm />
    </Suspense>
  );
}
