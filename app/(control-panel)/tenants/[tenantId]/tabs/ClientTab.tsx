"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { updateTenantClientSettings } from "../_actions";
import { clientFormSchema } from "../schemas";

type ClientFormValues = z.infer<typeof clientFormSchema>;

export function ClientTab({
  tenantId,
  initialData,
}: {
  tenantId: string;
  initialData: ClientFormValues;
}) {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: initialData || {
      companyName: "",
      contactName: "",
      email: "",
      phone: "",
      monthlyTokenLimit: 0,
    },
  });

  async function onSubmit(data: ClientFormValues) {
    setIsSaving(true);
    const result = await updateTenantClientSettings(tenantId, data);
    setIsSaving(false);

    if (result.success) {
      toast.success("Client settings updated successfully.");
    } else {
      toast.error(`Error updating client settings: ${result.error}`);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Client Commercial Data & FinOps</h3>
        <p className="text-sm text-muted-foreground">
          Manage the commercial contact details and billing constraints for this tenant.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name / Razón Social</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corp" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Main Contact Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@acme.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 555-1234" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="monthlyTokenLimit"
              render={({ field: { value, onChange, ...field } }) => (
                <FormItem>
                  <FormLabel>Monthly Token Limit (FinOps Ledger)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="5000000" 
                      value={value ?? ""} 
                      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)} 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Maximum allowed tokens to consume per month. Set to 0 for unlimited.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Client Settings"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
