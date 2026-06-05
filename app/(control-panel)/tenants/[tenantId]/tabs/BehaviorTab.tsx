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
import { Switch } from '@/components/ui/switch';
import { BehaviorSettings } from "../_behaviorTypes";
import { toast } from 'sonner';
import { useEffect } from 'react';

const behaviorFormSchema = z.object({
  readingSpeedWPM: z.number().int().min(50).max(1000).default(250),
  streamingChunkSize: z.number().int().min(1).max(1024).default(64),
  artificialDelayMs: z.number().int().min(0).max(5000).default(100),
  humanizerEnabled: z.boolean().default(true),
  typoRate: z.number().min(0).max(1).default(0.0),
  pauseBeforeReplyMs: z.number().int().min(0).max(10000).default(1000),
  typingSpeedVariance: z.number().min(0).max(1).default(0.2),
});

export type BehaviorFormValues = z.infer<typeof behaviorFormSchema>;

interface BehaviorTabProps {
  tenantId: string;
  initialData: BehaviorFormValues;
  onSave: (data: BehaviorSettings) => Promise<{ success: boolean; message: string; errors?: any }>;
}

export function BehaviorTab({ tenantId, initialData, onSave }: BehaviorTabProps) {
  const form = useForm<BehaviorFormValues>({
    resolver: zodResolver(behaviorFormSchema) as any,
    mode: 'onChange',
  });

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
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-2xl">
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="readingSpeedWPM"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reading Speed (WPM)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value, 10))} />
                </FormControl>
                <FormDescription>Words per minute the agent can process. (50-1000)</FormDescription>
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
                  <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value, 10))} />
                </FormControl>
                <FormDescription>Size of data chunks for streaming responses. (1-1024)</FormDescription>
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
                  <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value, 10))} />
                </FormControl>
                <FormDescription>Fixed delay before processing starts. (0-5000 ms)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="rounded-lg border p-6 bg-muted/20 space-y-6">
          <h3 className="text-lg font-medium">Humanizer Engine</h3>
          <p className="text-sm text-muted-foreground">Adjust parameters to simulate human-like text generation and delays.</p>
          
          <FormField
            control={form.control}
            name="humanizerEnabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-background">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Enable Humanizer</FormLabel>
                  <FormDescription>Globally toggle human-like delays and imperfections.</FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          {form.watch('humanizerEnabled') && (
            <div className="grid gap-6 sm:grid-cols-2 mt-4">
              <FormField
                control={form.control}
                name="pauseBeforeReplyMs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pause Before Reply (ms)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value, 10))} />
                    </FormControl>
                    <FormDescription>Simulates thinking/typing preparation time. (0-10000 ms)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="typingSpeedVariance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Typing Speed Variance</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.05" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                    </FormControl>
                    <FormDescription>Random variance in chunk delivery speed. (0.0 - 1.0)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="typoRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Typo Rate</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                    </FormControl>
                    <FormDescription>Probability of generating a typo. (0.0 - 1.0)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>

        <Button type="submit">Save Behavior Settings</Button>
      </form>
    </Form>
  );
}
