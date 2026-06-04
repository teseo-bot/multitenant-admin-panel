"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useEffect } from "react";

const brandingFormSchema = z.object({
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: "Primary Color must be a valid hex string (e.g., #RRGGBB).",
  }),
  accentColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: "Accent Color must be a valid hex string (e.g., #RRGGBB).",
  }),
  logoUrl: z.string().url({ message: "Logo URL must be a valid URL." }),
  themeMode: z.enum(["light", "dark", "system"], {
    message: "Theme Mode must be one of 'light', 'dark', or 'system'.",
  }),
});

type BrandingFormValues = z.infer<typeof brandingFormSchema>;

interface BrandingTabProps {
  tenantId: string;
  initialData: BrandingFormValues;
  onSave: (tenantId: string, data: BrandingFormValues) => Promise<any>;
}

export function BrandingTab({ tenantId, initialData, onSave }: BrandingTabProps) {
  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingFormSchema),
    defaultValues: initialData,
    mode: "onChange",
  });

  useEffect(() => {
    form.reset(initialData);
  }, [initialData, form]);

  async function onSubmit(data: BrandingFormValues) {
    try {
      await onSave(tenantId, data);
      toast.success("Branding settings updated successfully!");
    } catch (error) {
      toast.error("Failed to update branding settings.");
      console.error("Failed to save branding:", error);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="primaryColor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Primary Color</FormLabel>
              <FormControl>
                <Input type="color" {...field} />
              </FormControl>
              <FormDescription>
                The primary color for your tenant&apos;s UI (Hex format).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="accentColor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Accent Color</FormLabel>
              <FormControl>
                <Input type="color" {...field} />
              </FormControl>
              <FormDescription>
                The accent color for your tenant&apos;s UI (Hex format).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="logoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo URL</FormLabel>
              <FormControl>
                <Input placeholder="https://your-logo.com/logo.png" {...field} />
              </FormControl>
              <FormDescription>
                URL to the tenant&apos;s logo.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="themeMode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Theme Mode</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a theme mode" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Choose the default theme mode for your tenant.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Update Branding</Button>
      </form>
    </Form>
  );
}
