// _apiKeysActions.ts
"use server";

import { createServerClient } from "@supabase/auth-helpers-nextjs";

// Mock or actual database utility to get tenant orchestrator URL
// This would typically query your central database (e.g., Cloud SQL) for the tenant's specific orchestrator endpoint.
async function getTenantOrchestratorUrl(tenantId: string): Promise<string> {
  // In a real application, this would fetch from a secure database.
  // For now, we'll use a placeholder or an environment variable.
  console.log(`Fetching orchestrator URL for tenant: ${tenantId}`);
  // Example: query database for tenant where id = tenantId and select orchestrator_url
  // const { data, error } = await supabase.from('tenants').select('orchestrator_url').eq('id', tenantId).single();
  // if (error) throw error;
  // return data.orchestrator_url;

  // Placeholder for demonstration
  if (tenantId === "test-tenant-1") {
    return process.env.TEST_TENANT_ORCHESTRATOR_URL || "http://localhost:3001";
  } else if (tenantId === "test-tenant-2") {
    return process.env.TEST_TENANT_2_ORCHESTRATOR_URL || "http://localhost:3002";
  }
  return process.env.DEFAULT_TENANT_ORCHESTRATOR_URL || "http://localhost:3000";
}

interface ApiKey {
  id: string;
  prefix: string;
  createdAt: string;
  lastUsed: string | null;
  status: "active" | "revoked";
}

async function proxyRequest(
  tenantId: string,
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: object
): Promise<any> {
  const orchestratorUrl = await getTenantOrchestratorUrl(tenantId);
  const url = `${orchestratorUrl}/api/v1/admin/secrets${endpoint}`;

  // In a real scenario, implement robust authentication (e.g., mTLS, JWT exchange)
  // For this example, we'll assume a shared secret or an admin token.
  const adminAuthToken = process.env.ORCHESTRATOR_ADMIN_TOKEN; 
  if (!adminAuthToken) {
    throw new Error("Orchestrator admin token not configured.");
  }

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminAuthToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `API request failed with status ${response.status}`);
  }

  return response.json();
}

export async function generateApiKey(tenantId: string): Promise<ApiKey> {
  console.log(`[Server Action] Generating API Key for tenant: ${tenantId}`);
  const result = await proxyRequest(tenantId, "/generate", "POST");
  return result.apiKey;
}

export async function listApiKeys(tenantId: string): Promise<ApiKey[]> {
  console.log(`[Server Action] Listing API Keys for tenant: ${tenantId}`);
  const result = await proxyRequest(tenantId, "/list", "GET");
  return result.apiKeys;
}

export async function revokeApiKey(tenantId: string, keyId: string): Promise<void> {
  console.log(`[Server Action] Revoking API Key ${keyId} for tenant: ${tenantId}`);
  await proxyRequest(tenantId, `/revoke/${keyId}`, "POST");
}

export async function rotateApiKey(tenantId: string, keyId: string): Promise<ApiKey> {
  console.log(`[Server Action] Rotating API Key ${keyId} for tenant: ${tenantId}`);
  const result = await proxyRequest(tenantId, `/rotate/${keyId}`, "POST");
  return result.apiKey;
}
