"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, destroySession } from "@/lib/gcp-auth/session";

export async function logoutAction() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;

  if (sessionCookie) {
    const decoded = await verifySession(sessionCookie);
    if (decoded) {
      await destroySession(decoded.uid);
    }
  }

  cookieStore.delete(SESSION_COOKIE);
  redirect("/auth/login");
}
