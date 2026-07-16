"use client";

import { useState, Suspense } from "react";
import { getAuth } from "@/lib/gcp-auth/client";
import { sendPasswordResetEmail } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

function ResetPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    if (!email) {
      toast.error("Por favor ingresa tu correo electrónico.");
      setIsLoading(false);
      return;
    }

    try {
      // Identity Platform envía el correo con el enlace de recuperación (oobCode).
      await sendPasswordResetEmail(getAuth(), email);
      toast.success("Correo de recuperación enviado.");
      setIsSubmitted(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/user-not-found") {
        // No revelar si la cuenta existe: mismo estado de éxito.
        setIsSubmitted(true);
      } else if (code === "auth/network-request-failed") {
        toast.error("No se pudo conectar. Intenta de nuevo.");
      } else if (code === "auth/too-many-requests") {
        toast.error("Demasiados intentos. Espera unos minutos.");
      } else {
        toast.error("Error al solicitar la recuperación.");
      }
    }

    setIsLoading(false);
  }

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Revisa tu bandeja</CardTitle>
          <CardDescription className="pt-2">
            Hemos enviado un enlace seguro de recuperación a tu correo electrónico. Por favor, haz clic en él para establecer tu nueva contraseña.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center pt-4">
          <Link href="/auth/login" className="text-sm font-medium text-primary hover:underline">
            Volver al inicio de sesión
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-1">
        <div className="flex items-center mb-2">
          <Link href="/auth/login" className="text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight">Recuperar contraseña</CardTitle>
        <CardDescription>
          Ingresa tu correo institucional. Si tu cuenta existe, recibirás un enlace para restablecer tu acceso.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="nombre@fleetco.mx"
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
                Enviando enlace...
              </>
            ) : (
              "Enviar correo de recuperación"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Card className="w-full max-w-md shadow-lg p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></Card>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
