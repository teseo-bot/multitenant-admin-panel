'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useEffect } from "react";
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { updateTenantOperationSettings } from "../_actions";
import { OperationFormValues, operationFormSchema } from "../schemas";

interface OperationTabProps {
  tenantId: string;
  initialData: OperationFormValues & { telegramWhitelistedGroupIds: string };
}

export function OperationTab({ tenantId, initialData }: OperationTabProps) {
  const form = useForm<any>({
    resolver: zodResolver(operationFormSchema) as any,
    defaultValues: initialData,
  });

  useEffect(() => {
    form.reset(initialData);
  }, [initialData, form]);

  async function onSubmit(values: any) {
    // La whitelist se manda TAL CUAL, como texto. Aquí se convertía a array y la server
    // action volvía a hacerle `.split(',')` encima: «split is not a function». La
    // conversión vive en un solo sitio, lib/tenants/telegram-whitelist.ts.
    const response = await updateTenantOperationSettings(tenantId, values);
    if (response.success) {
      toast.success('Operation settings updated successfully!');
    } else {
      toast.error(`Failed to update operation settings: ${response.error}`);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 p-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tenant Name</FormLabel>
              <FormControl>
                <Input placeholder="Tenant A" {...field} />
              </FormControl>
              <FormDescription>
                This is the public display name of the tenant.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tenant Domain</FormLabel>
              <FormControl>
                <Input placeholder="comerseg.fleetco.mx" {...field} />
              </FormControl>
              <FormDescription>
                The primary domain for this tenant.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="orchestratorUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Orchestrator URL</FormLabel>
              <FormControl>
                <Input placeholder="https://orchestrator.tenant-a.com/api" {...field} />
              </FormControl>
              <FormDescription>
                Sólo informativo: hoy no lo lee ningún servicio. Déjalo vacío mientras el
                tenant no tenga orquestador desplegado.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Aquí vivían «Telegram Bot Token» y «Telegram Whitelisted Group IDs».
            Se retiran: sus columnas NO EXISTEN en el plano de control (las añade
            `migrations/002`, el directorio que no corre nadie), así que el guardado
            fallaba con 42703 en cuanto la validación dejaba pasar el formulario.

            Y no se reponen con una migración a propósito: el modelo real de canales
            ya existe y es mejor — `tenant_channels` guarda una fila por canal, con
            marca (ADR-215) y activo/inactivo, y es de donde el orquestador saca el
            token de verdad. Dar de alta un tenant es identidad; configurar sus
            canales es otra cosa. */}

        <Button type="submit">Save Changes</Button>
      </form>
    </Form>
  );
}
