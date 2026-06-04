"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Save } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Vistas individuales a implementar:
// import { OperationTab } from "./tabs/OperationTab";
// import { ClientTab } from "./tabs/ClientTab";
// import { BrandingTab } from "./tabs/BrandingTab";
// import { BehaviorTab } from "./tabs/BehaviorTab";
// import { PromptsTab } from "./tabs/PromptsTab";
// import { AccessRolesTab } from "./tabs/AccessRolesTab";
// import { ApiKeysTab } from "./tabs/ApiKeysTab";

export function TenantDetailsClient({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(true);

  // Simular carga inicial
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
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

      {loading ? (
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
             <div className="rounded-md border p-8 text-center text-muted-foreground border-dashed">
                Tab de Operación (Identidad, Routing, Kill Switch, Telegram Bot) en desarrollo.
             </div>
          </TabsContent>
          <TabsContent value="client" className="pt-4">
             <div className="rounded-md border p-8 text-center text-muted-foreground border-dashed">
                Tab de Datos del Cliente (Razón Social, Contactos) en desarrollo.
             </div>
          </TabsContent>
          <TabsContent value="branding" className="pt-4">
             <div className="rounded-md border p-8 text-center text-muted-foreground border-dashed">
                Tab de Branding (Logotipo, Colores, Tema) en desarrollo.
             </div>
          </TabsContent>
          <TabsContent value="behavior" className="pt-4">
             <div className="rounded-md border p-8 text-center text-muted-foreground border-dashed">
                Tab de Comportamiento (Humanizador, WPM, Chunk Size, Delays) en desarrollo.
             </div>
          </TabsContent>
          <TabsContent value="prompts" className="pt-4">
             <div className="rounded-md border p-8 text-center text-muted-foreground border-dashed">
                Tab de Prompts (SDR, Gatekeeper, Chit-Chat) en desarrollo.
             </div>
          </TabsContent>
          <TabsContent value="roles" className="pt-4">
             <div className="rounded-md border p-8 text-center text-muted-foreground border-dashed">
                Tab de Accesos & Roles en desarrollo.
             </div>
          </TabsContent>
          <TabsContent value="keys" className="pt-4">
             <div className="rounded-md border p-8 text-center text-muted-foreground border-dashed">
                Tab de API Keys (Vault Provider) en desarrollo.
             </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
