
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import { BehaviorSettings } from "../_behaviorTypes"; // Import BehaviorSettings
import { toast } from 'sonner';
import { useEffect } from 'react';

// Define the Zod schema for the form
const behaviorFormSchema = z.object({
  readingSpeedWPM: z.number().int().min(100).max(1000).default(250),
  streamingChunkSize: z.number().int().min(1).max(1024).default(64),
  artificialDelayMs: z.number().int().min(0).max(5000).default(100),
});

export type BehaviorFormValues = z.infer<typeof behaviorFormSchema>;

interface BehaviorTabProps {
  tenantId: string;
  initialData: BehaviorFormValues; // Expect full data now from parent
  onSave: (data: BehaviorSettings) => Promise<{ success: boolean; message: string; errors?: any }>;
}

export function BehaviorTab({ tenantId, initialData, onSave }: BehaviorTabProps) {
  const form = useForm<BehaviorFormValues>({
    resolver: zodResolver(behaviorFormSchema) as any, // Temporary workaround for persistent type error
    mode: 'onChange',
  });

  // Reset form with initialData when it changes (e.g., after server fetch)
  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  async function onSubmit(data: BehaviorFormValues) {
    const result = await onSave({
      ...data,
      tenantId,
    });
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
      if (result.errors) {
        for (const field in result.errors) {
          form.setError(field as keyof BehaviorFormValues, { message: result.errors[field][0] });
        }
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="readingSpeedWPM"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reading Speed (WPM)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="250"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                />
              </FormControl>
              <FormDescription>
                Words per minute the agent can process. (100-1000)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="streamingChunkSize"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Streaming Chunk Size</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="64"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                />
              </FormControl>
              <FormDescription>
                Size of data chunks for streaming responses. (1-1024)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="artificialDelayMs"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Artificial Delay (ms)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="100"
                  {...field}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                />
              </FormControl>
              <FormDescription>
                Introduces a delay to simulate human-like response times. (0-5000 ms)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save Behavior Settings</Button>
      </form>
    </Form>
  );
}
