export interface ApiKey {
  id: string;
  prefix: string;
  createdAt: string;
  lastUsed: string | null;
  status: "active" | "revoked";
}
