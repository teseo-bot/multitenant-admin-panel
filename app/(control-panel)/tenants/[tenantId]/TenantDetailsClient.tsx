"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BehaviorSettings } from "./_behaviorTypes";
import { BrandingConfig } from "./_brandingTypes";
import { OperationFormValues, ClientFormValues, SuspensionFormValues } from "./schemas";
import { updateTenantBranding } from "./_brandingActions";
import { saveBehaviorSettings } from "./_behaviorActions";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { OperationTab } from "./tabs/OperationTab";
import { ClientTab } from "./tabs/ClientTab";
import { BrandingTab } from "./tabs/BrandingTab";
import { BehaviorTab } from "./tabs/BehaviorTab";
import { PromptsTab } from "./tabs/PromptsTab";
import { AccessRolesTab } from "./tabs/AccessRolesTab";
import { ApiKeysTab } from "./tabs/ApiKeysTab";
import { SuspensionTab } from "./tabs/SuspensionTab";

interface TenantDetailsClientProps {
  tenantId: string;
  initialOperationData: (OperationFormValues & SuspensionFormValues) | null | undefined;
  initialClientData: ClientFormValues | null | undefined;
  initialBrandingData: BrandingConfig | null | undefined;
  initialBehaviorData: BehaviorSettings | null | undefined;
}

export function TenantDetailsClient({ 
  tenantId, 
  initialOperationData, 
  initialClientData, 
  initialBrandingData, 
  initialBehaviorData 
}: TenantDetailsClientProps) {

  const defaultOpData = initialOperationData ? {
    ...initialOperationData,
    telegramWhitelistedGroupIds: initialOperationData.telegramWhitelistedGroupIds.join(', ')
  } : {
    name: "",
    domain: "",
    orchestratorUrl: "",
    telegramBotToken: "",
    telegramWhitelistedGroupIds: "",
    status: true
  };

  const defaultSuspensionData: SuspensionFormValues = {
    suspensionStatus: initialOperationData?.suspensionStatus || "active",
    suspensionReason: initialOperationData?.suspensionReason || "",
  };

  const defaultCliData: ClientFormValues = initialClientData || {
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    monthlyTokenLimit: 0,
  };

  const defaultBrandingData: BrandingConfig = initialBrandingData || {
    primaryColor: '#007bff',
    secondaryColor: '#6c757d',
    accentColor: '#6c757d',
    backgroundColor: '#ffffff',
    cardBackgroundColor: '#ffffff',
    logoLightUrl: '',
    logoDarkUrl: '',
    faviconUrl: '',
    appIconUrl: '',
    themeMode: 'system'
  };

  const defaultBehaviorData: BehaviorSettings = initialBehaviorData || {
    tenantId,
    readingSpeedWPM: 250,
    streamingChunkSize: 64,
    artificialDelayMs: 100,
    humanizerEnabled: true,
    typoRate: 0.0,
    pauseBeforeReplyMs: 1000,
    typingSpeedVariance: 0.2,
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 w-full min-w-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Link href="/tenants">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="text-3xl font-bold tracking-tight">Configuración del Tenant</h2>
        </div>
      </div>

      <Tabs defaultValue="operation" className="space-y-4 min-w-0">
        <TabsList className="flex flex-wrap w-full justify-start border-b rounded-none pb-px bg-transparent h-auto p-0 gap-x-1">
          <TabsTrigger value="operation" className="rounded-none border-b-2 border-transparent flex-none data-active:border-primary data-active:bg-transparent">Operación</TabsTrigger>
          <TabsTrigger value="suspension" className="rounded-none border-b-2 border-transparent flex-none data-active:border-destructive data-active:text-destructive data-active:bg-transparent">Kill Switch</TabsTrigger>
          <TabsTrigger value="client" className="rounded-none border-b-2 border-transparent flex-none data-active:border-primary data-active:bg-transparent">Cliente</TabsTrigger>
          <TabsTrigger value="branding" className="rounded-none border-b-2 border-transparent flex-none data-active:border-primary data-active:bg-transparent">Branding & UI</TabsTrigger>
          <TabsTrigger value="behavior" className="rounded-none border-b-2 border-transparent flex-none data-active:border-primary data-active:bg-transparent">Comportamiento</TabsTrigger>
          <TabsTrigger value="prompts" className="rounded-none border-b-2 border-transparent flex-none data-active:border-primary data-active:bg-transparent">Prompts & IA</TabsTrigger>
          <TabsTrigger value="roles" className="rounded-none border-b-2 border-transparent flex-none data-active:border-primary data-active:bg-transparent">Accesos & Roles</TabsTrigger>
          <TabsTrigger value="keys" className="rounded-none border-b-2 border-transparent flex-none data-active:border-primary data-active:bg-transparent">API Keys</TabsTrigger>
        </TabsList>
        
        <TabsContent value="operation" className="pt-4 min-w-0">
          <OperationTab tenantId={tenantId} initialData={defaultOpData as any} />
        </TabsContent>
        <TabsContent value="suspension" className="pt-4 min-w-0">
          <SuspensionTab tenantId={tenantId} initialData={defaultSuspensionData} />
        </TabsContent>
        <TabsContent value="client" className="pt-4 min-w-0">
          <ClientTab tenantId={tenantId} initialData={defaultCliData} />
        </TabsContent>
        <TabsContent value="branding" className="pt-4 min-w-0">
          <BrandingTab tenantId={tenantId} initialData={defaultBrandingData} onSave={updateTenantBranding} />
        </TabsContent>
        <TabsContent value="behavior" className="pt-4 min-w-0">
          <BehaviorTab tenantId={tenantId} initialData={defaultBehaviorData} onSave={saveBehaviorSettings} />
        </TabsContent>
        <TabsContent value="prompts" className="pt-4 min-w-0">
          <PromptsTab tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="roles" className="pt-4 min-w-0">
          <AccessRolesTab tenantId={tenantId} />
        </TabsContent>
        <TabsContent value="keys" className="pt-4 min-w-0">
          <ApiKeysTab tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
