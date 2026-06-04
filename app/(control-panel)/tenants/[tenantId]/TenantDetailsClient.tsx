"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTenantOperationSettings, getTenantClientSettings } from "./_actions";
import { BehaviorSettings, getBehaviorSettings, saveBehaviorSettings } from "./_behaviorActions";
import { BehaviorFormValues } from "./schemas";
import { getTenantBranding, updateTenantBranding } from "./_brandingActions";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Save } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Vistas individuales a implementar:
import { OperationTab } from "./tabs/OperationTab";
import { ClientTab } from "./tabs/ClientTab";
import { BrandingTab } from "./tabs/BrandingTab";
import { BehaviorTab } from "./tabs/BehaviorTab";
import { PromptsTab } from "./tabs/PromptsTab";
import { AccessRolesTab } from "./tabs/AccessRolesTab";
import { ApiKeysTab } from "./tabs/ApiKeysTab";

export function TenantDetailsClient({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(true);
  const [initialOperationData, setInitialOperationData] = useState<any>(null);
  const [initialClientData, setInitialClientData] = useState<any>(null);
  const [initialBrandingData, setInitialBrandingData] = useState<any>(null);
  const [initialBehaviorData, setInitialBehaviorData] = useState<BehaviorFormValues | null>(null);

  // Simulate initial loading and fetching data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      
      const [opData, cliData, brandingData, behaviorData] = await Promise.all([
        getTenantOperationSettings(tenantId),
        getTenantClientSettings(tenantId),
        getTenantBranding(tenantId),
        getBehaviorSettings(tenantId),
      ]);

      if (opData) {
        setInitialOperationData({
          ...opData,
          telegramWhitelistedGroupIds: Array.isArray(opData.telegramWhitelistedGroupIds) 
            ? opData.telegramWhitelistedGroupIds.join(',') 
            : opData.telegramWhitelistedGroupIds,
        });
      }
      
      if (cliData) {
        setInitialClientData(cliData);
      }
      if (brandingData) {
        setInitialBrandingData(brandingData);
      }
      // Ensure initialBehaviorData always has concrete values
      const defaultedBehaviorData: BehaviorFormValues = behaviorData ? {
        readingSpeedWPM: behaviorData.readingSpeedWPM,
        streamingChunkSize: behaviorData.streamingChunkSize,
        artificialDelayMs: behaviorData.artificialDelayMs,
      } : {
        readingSpeedWPM: 250, // Default value as per schema
        streamingChunkSize: 64, // Default value as per schema
        artificialDelayMs: 100, // Default value as per schema
      };
      setInitialBehaviorData(defaultedBehaviorData);

      setLoading(false);
    }
    fetchData();
  }, [tenantId]);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Link href="/tenants">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="text-3xl font-bold tracking-tight">Configuración del Tenant</h2>
        </div>
        <Button>
          <Save className="h-4 w-4 mr-2" />
          Guardar Cambios
        </Button>
      </div>

      {loading || !initialOperationData || !initialClientData || !initialBrandingData || !initialBehaviorData ? (
        <div className="space-y-8 mt-8">
          <Skeleton className="h-10 w-[400px]" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      ) : (
        <Tabs defaultValue="operation" className="space-y-4">
          <TabsList className="overflow-x-auto w-full justify-start border-b rounded-none pb-px bg-transparent h-auto p-0">
            <TabsTrigger value="operation" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Operación</TabsTrigger>
            <TabsTrigger value="client" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Cliente</TabsTrigger>
            <TabsTrigger value="branding" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Branding & UI</TabsTrigger>
            <TabsTrigger value="behavior" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Comportamiento</TabsTrigger>
            <TabsTrigger value="prompts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Prompts & IA</TabsTrigger>
            <TabsTrigger value="roles" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">Accesos & Roles</TabsTrigger>
            <TabsTrigger value="keys" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">API Keys</TabsTrigger>
          </TabsList>
          
          <TabsContent value="operation" className="pt-4">
            <OperationTab tenantId={tenantId} initialData={initialOperationData} />
          </TabsContent>
          <TabsContent value="client" className="pt-4">
            <ClientTab tenantId={tenantId} initialData={initialClientData} />
          </TabsContent>
          <TabsContent value="branding" className="pt-4">
            <BrandingTab tenantId={tenantId} initialData={initialBrandingData} onSave={updateTenantBranding} />
          </TabsContent>
          <TabsContent value="behavior" className="pt-4">
            <BehaviorTab tenantId={tenantId} initialData={initialBehaviorData} onSave={saveBehaviorSettings} />
          </TabsContent>
          <TabsContent value="prompts" className="pt-4">
            <PromptsTab tenantId={tenantId} />
          </TabsContent>
          <TabsContent value="roles" className="pt-4">
            <AccessRolesTab tenantId={tenantId} />
          </TabsContent>
          <TabsContent value="keys" className="pt-4">
            <ApiKeysTab tenantId={tenantId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
