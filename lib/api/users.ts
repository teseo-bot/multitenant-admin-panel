import { UserProfile } from "@/lib/validators/user";

export async function getUsers(): Promise<UserProfile[]> {
  const res = await fetch("/api/admin/users");
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
