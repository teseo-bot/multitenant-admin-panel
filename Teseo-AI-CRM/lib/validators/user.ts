import { z } from "zod";

export const UserRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
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
  role: z.enum([UserRole.OWNER, UserRole.ADMIN, UserRole.MEMBER]),
  isActive: z.boolean(),
});

export type UserFormValues = z.infer<typeof userFormSchema>;
