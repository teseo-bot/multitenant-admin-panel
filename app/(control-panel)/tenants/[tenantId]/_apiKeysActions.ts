"use server";

import { ApiKey } from "./_apiKeysTypes";
import { getTenantOperationSettings } from "./_actions";

async function getTenantOrchestratorUrl(tenantId: string): Promise<string> {
  const opData = await getTenantOperationSettings(tenantId);
  if (opData && opData.orchestratorUrl) {
    return opData.orchestratorUrl;
  }
  return process.env.DEFAULT_TENANT_ORCHESTRATOR_URL || "http://localhost:3000";
}

async function proxyRequest(
  tenantId: string,
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: object
): Promise<any> {
  const orchestratorUrl = await getTenantOrchestratorUrl(tenantId);
  
  // Clean up double slashes
  const baseUrl = orchestratorUrl.endsWith('/') ? orchestratorUrl.slice(0, -1) : orchestratorUrl;
  const url = `${baseUrl}/api/v1/admin/secrets${endpoint}`;

  const adminAuthToken = process.env.ORCHESTRATOR_ADMIN_TOKEN || 'fallback-token-for-dev'; 
  
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminAuthToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      console.warn(`API Keys proxy returned ${response.status}`);
      return null;
    }

    return response.json();
  } catch (err) {
    console.error("Proxy fetch error:", err);
    return null;
  }
}

export async function generateApiKey(tenantId: string): Promise<ApiKey> {
  console.log(`[Server Action] Generating API Key for tenant: ${tenantId}`);
  const result = await proxyRequest(tenantId, "/generate", "POST");
  if (!result) throw new Error("Proxy request failed");
  return result.apiKey;
}

export async function listApiKeys(tenantId: string): Promise<ApiKey[]> {
  console.log(`[Server Action] Listing API Keys for tenant: ${tenantId}`);
  const result = await proxyRequest(tenantId, "/list", "GET");
  if (!result || !result.apiKeys) {
     return []; // Return empty array to avoid UI crash
  }
  return result.apiKeys;
}

export async function revokeApiKey(tenantId: string, keyId: string): Promise<void> {
  console.log(`[Server Action] Revoking API Key ${keyId} for tenant: ${tenantId}`);
  await proxyRequest(tenantId, `/revoke/${keyId}`, "POST");
}

export async function rotateApiKey(tenantId: string, keyId: string): Promise<ApiKey> {
  console.log(`[Server Action] Rotating API Key ${keyId} for tenant: ${tenantId}`);
  const result = await proxyRequest(tenantId, `/rotate/${keyId}`, "POST");
  if (!result) throw new Error("Proxy request failed");
  return result.apiKey;
}
