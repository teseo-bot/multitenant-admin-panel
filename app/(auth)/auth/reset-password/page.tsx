"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
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
  const supabase = createClient();

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

    // El RedirectTo debe apuntar a la ruta de actualización de contraseña que crearemos a continuación
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });

    if (error) {
      toast.error(error.message || "Error al solicitar la recuperación.");
    } else {
      toast.success("Correo de recuperación enviado.");
      setIsSubmitted(true);
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
