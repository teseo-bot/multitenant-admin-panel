// lib/supabase/admin.ts
// Cliente Supabase con Service Role (bypassa RLS). Único punto de creación,
// para no duplicar getAdminClient inline por toda la app.

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return cached;
}

/** Busca un usuario por email paginando admin.listUsers. null si no existe. */
export async function findUserByEmail(email: string): Promise<User | null> {
  const admin = getSupabaseAdmin();
  const target = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}
