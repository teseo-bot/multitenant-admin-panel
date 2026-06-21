import { UserProfile } from "@/lib/validators/user";

// Membership type mirroring lib/services/membership.ts (local copy — do NOT edit membership.ts)
export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type MembershipStatus = "active" | "suspended";

export interface Membership {
  id: string;
  tenantId: string;
  tenantName: string | null;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  role: Role;
  status: MembershipStatus;
  lastActive: string | null;
  tokenUsage: number;
  createdAt: string;
}

export interface UsersFilter {
  tenantId?: string;
  role?: Role;
  moduleId?: string;
  status?: MembershipStatus;
  q?: string;
}

export async function getUsers(filters?: UsersFilter): Promise<Membership[]> {
  const params = new URLSearchParams();
  if (filters?.tenantId) params.set("tenantId", filters.tenantId);
  if (filters?.role) params.set("role", filters.role);
  if (filters?.moduleId) params.set("moduleId", filters.moduleId);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.q) params.set("q", filters.q);

  const qs = params.toString();
  const res = await fetch(`/api/admin/users${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export async function getUser(userId: string): Promise<UserProfile> {
  const res = await fetch(`/api/admin/users/${userId}`);
  if (!res.ok) throw new Error("Failed to fetch user");
  return res.json();
}

export async function createUser(data: Partial<UserProfile>): Promise<UserProfile> {
  const res = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create user");
  return res.json();
}

export async function updateUser(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
  const res = await fetch(`/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update user");
  return res.json();
}

export async function deleteUser(userId: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete user");
}

export async function getUserActivity(userId: string): Promise<any[]> {
  const res = await fetch(`/api/admin/users/${userId}/activity`);
  if (!res.ok) throw new Error("Failed to fetch user activity");
  return res.json();
}
