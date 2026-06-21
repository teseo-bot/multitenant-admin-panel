import { z } from "zod";

// Alineado con el ENUM public.user_role de la base de datos (MAYÚSCULAS).
export const UserRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

export interface TenantUser {
  id: string; // auth.users.id
  tenant_id: string;
  role: UserRoleType;
  created_at: string;
}

export interface UserProfile extends TenantUser {
  email: string; // extraído de auth.users
  full_name: string | null; // opcional, si existe metadata
  avatar_url: string | null;
}

export const userFormSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  // Los 4 roles son representables en el contrato compartido. La restricción a
  // ADMIN/MEMBER/VIEWER (excluir OWNER) se aplica en la UI de invitación (WU-13),
  // no aquí, para no perder la capacidad de representar usuarios OWNER existentes.
  role: z.enum([UserRole.OWNER, UserRole.ADMIN, UserRole.MEMBER, UserRole.VIEWER]),
  isActive: z.boolean(),
});

export type UserFormValues = z.infer<typeof userFormSchema>;
