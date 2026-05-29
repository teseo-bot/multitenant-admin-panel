export type Role = "owner" | "admin" | "member";

export interface User {
  id: string;
  tenant_id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  avatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
  lastActivityAt?: string;
}

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  description: string;
  ipAddress?: string;
  createdAt: string;
}
