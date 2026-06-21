import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { acceptInvitation } from "@/lib/services/invitations";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  // El token es la credencial de la invitación, pero exigimos sesión autenticada
  // y que el email del usuario coincida con el invitado (verificado en el servicio).
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!user.email) return NextResponse.json({ error: "Usuario sin email" }, { status: 400 });

  try {
    const result = await acceptInvitation(token, { id: user.id, email: user.email });
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error al aceptar invitación" }, { status: 400 });
  }
}
