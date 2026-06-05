'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { updateTenantSuspension } from "../_actions";
import { SuspensionFormValues, suspensionFormSchema } from "../schemas";

interface SuspensionTabProps {
  tenantId: string;
  initialData: SuspensionFormValues;
}

export function SuspensionTab({ tenantId, initialData }: SuspensionTabProps) {
  const form = useForm<SuspensionFormValues>({
    resolver: zodResolver(suspensionFormSchema),
    defaultValues: initialData,
  });

  async function onSubmit(values: SuspensionFormValues) {
    const response = await updateTenantSuspension(tenantId, values);
    if (response.success) {
      toast.success('Suspension status updated successfully!');
    } else {
      toast.error(`Failed to update status: ${response.error}`);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-lg p-4">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 space-y-6">
          <h3 className="text-lg font-medium text-destructive">Kill Switch & Suspensión</h3>
          <p className="text-sm text-muted-foreground">Administra el estado de servicio de este inquilino.</p>

          <FormField
            control={form.control}
            name="suspensionStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado del Servicio</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el estado" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">Activo (Normal)</SelectItem>
                    <SelectItem value="delayed">Alerta de Retraso</SelectItem>
                    <SelectItem value="unpaid">Alerta por Falta de Pago</SelectItem>
                    <SelectItem value="suspended">Suspensión Total (Kill Switch)</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Cambiar el estado puede restringir inmediatamente el acceso a la plataforma.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="suspensionReason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Motivo (Opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ej. Pago no recibido Factura #1234" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" variant="destructive">Aplicar Estado</Button>
        </div>
      </form>
    </Form>
  );
}
