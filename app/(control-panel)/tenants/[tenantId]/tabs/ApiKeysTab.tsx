"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { generateApiKey, listApiKeys, revokeApiKey, rotateApiKey } from "../_apiKeysActions";

interface ApiKey {
  id: string;
  prefix: string;
  createdAt: string;
  lastUsed: string | null;
  status: "active" | "revoked";
}

export function ApiKeysTab({ tenantId }: { tenantId: string }) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApiKeys();
  }, [tenantId]);

  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const keys = await listApiKeys(tenantId);
      setApiKeys(keys);
    } catch (error) {
      toast.error("Failed to fetch API keys.");
      console.error("Error fetching API keys:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    try {
      await generateApiKey(tenantId);
      toast.success("API Key generated successfully.");
      fetchApiKeys();
    } catch (error) {
      toast.error("Failed to generate API Key.");
      console.error("Error generating API Key:", error);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      await revokeApiKey(tenantId, keyId);
      toast.success("API Key revoked successfully.");
      fetchApiKeys();
    } catch (error) {
      toast.error("Failed to revoke API Key.");
      console.error("Error revoking API Key:", error);
    }
  };

  const handleRotateKey = async (keyId: string) => {
    try {
      await rotateApiKey(tenantId, keyId);
      toast.success("API Key rotated successfully.");
      fetchApiKeys();
    } catch (error) {
      toast.error("Failed to rotate API Key.");
      console.error("Error rotating API Key:", error);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API Key Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleGenerateKey}>Generate New API Key</Button>
          <Separator />
          <div>
            <h3 className="text-lg font-semibold mb-2">Existing API Keys</h3>
            {loading ? (
              <p>Loading API keys...</p>
            ) : apiKeys.length === 0 ? (
              <p>No API keys found for this tenant.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell>{key.prefix}****</TableCell>
                      <TableCell>{new Date(key.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{key.lastUsed ? new Date(key.lastUsed).toLocaleString() : "Never"}</TableCell>
                      <TableCell>{key.status}</TableCell>
                      <TableCell className="space-x-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevokeKey(key.id)}
                          disabled={key.status === "revoked"}
                        >
                          Revoke
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRotateKey(key.id)}
                          disabled={key.status === "revoked"}
                        >
                          Rotate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
