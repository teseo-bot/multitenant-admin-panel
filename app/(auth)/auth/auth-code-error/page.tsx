"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, RotateCcw } from "lucide-react";
import Link from "next/link";

function AuthCodeErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");

  // Mapear mensajes comunes de Supabase a texto amigable
  const getMessage = () => {
    if (errorCode === "otp_expired" || error?.includes("expired")) {
      return {
        title: "El enlace ha expirado",
        description:
          "El enlace de recuperación que utilizaste ya no es válido. Los enlaces de seguridad caducan después de un tiempo para proteger tu cuenta.",
      };
    }
    if (error?.includes("access_denied")) {
      return {
        title: "Acceso denegado",
        description:
          "No se pudo verificar tu identidad. Es posible que el enlace ya haya sido utilizado o que haya sido invalidado.",
      };
    }
    return {
      title: "Error de autenticación",
      description:
        errorDescription ||
        error ||
        "Ocurrió un error al procesar tu solicitud de autenticación. Verifica que el enlace sea válido e inténtalo nuevamente.",
    };
  };

  const { title, description } = getMessage();

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-6 w-6" />
          <CardTitle className="text-2xl font-bold tracking-tight">
            {title}
          </CardTitle>
        </div>
        <CardDescription className="pt-2">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Si el problema persiste, solicita un nuevo enlace de recuperación desde la pantalla de inicio de sesión.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Link href="/auth/reset-password" className="w-full">
          <Button className="w-full" variant="default">
            <RotateCcw className="mr-2 h-4 w-4" />
            Solicitar nuevo enlace
          </Button>
        </Link>
        <Link href="/auth/login" className="w-full">
          <Button className="w-full" variant="outline">
            Volver al inicio de sesión
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense
      fallback={
        <Card className="w-full max-w-md shadow-lg p-6 flex justify-center">
          <AlertCircle className="h-6 w-6 animate-pulse text-muted-foreground" />
        </Card>
      }
    >
      <AuthCodeErrorContent />
    </Suspense>
  );
}
