'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { updateTenantOperationSettings } from "../_actions";

// Define the schema for the operation form
const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Name must be at least 2 characters.',
  }),
  domain: z.string().url({
    message: 'Domain must be a valid URL.',
  }),
  orchestratorUrl: z.string().url({
    message: 'Orchestrator URL must be a valid URL.',
  }),
  telegramBotToken: z.string().min(10, {
    message: 'Telegram Bot Token must be at least 10 characters.',
  }),
  telegramWhitelistedGroupIds: z.string(), // Expect a string input from the form
  status: z.boolean(), // The Kill Switch
});

type OperationFormValues = z.infer<typeof formSchema>;

interface OperationTabProps {
  tenantId: string;
  initialData: OperationFormValues; // Data fetched from Cloud SQL
}

export function OperationTab({ tenantId, initialData }: OperationTabProps) {
  const form = useForm<OperationFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData, // Initialize with fetched data
  });

  useEffect(() => {
    form.reset(initialData);
  }, [initialData, form]);

  async function onSubmit(values: OperationFormValues) {
    const telegramGroupIdsArray = values.telegramWhitelistedGroupIds.split(',').map(id => id.trim()).filter(Boolean);

    const response = await updateTenantOperationSettings(tenantId, {
      ...values,
      telegramWhitelistedGroupIds: telegramGroupIdsArray,
    });
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
                <Input placeholder="https://tenant-a.com" {...field} />
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
                The URL for the tenant&apos;s orchestration service.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="telegramBotToken"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telegram Bot Token</FormLabel>
              <FormControl>
                <Input type="password" placeholder="xxxxxxxx:xxxxxxxxxxxxxxxxxxxxxxxxx" {...field} />
              </FormControl>
              <FormDescription>
                Token for the Telegram bot associated with this tenant.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="telegramWhitelistedGroupIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telegram Whitelisted Group IDs</FormLabel>
              <FormControl>
                <Input placeholder="12345,67890" {...field} />
              </FormControl>
              <FormDescription>
                Comma-separated Telegram group IDs that are whitelisted.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Kill Switch</FormLabel>
                <FormDescription>
                  Enable or disable all operations for this tenant.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <Button type="submit">Save Changes</Button>
      </form>
    </Form>
  );
}
