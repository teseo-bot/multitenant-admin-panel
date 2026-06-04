import { z } from "zod";

export const operationFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  domain: z.string().url({ message: "Domain must be a valid URL." }),
  orchestratorUrl: z.string().url({ message: "Orchestrator URL must be a valid URL." }),
  telegramBotToken: z.string().min(10, { message: "Telegram Bot Token must be at least 10 characters." }),
  telegramWhitelistedGroupIds: z.array(z.string()),
  status: z.boolean(),
});
export type OperationFormValues = z.infer<typeof operationFormSchema>;

export const clientFormSchema = z.object({
  companyName: z.string().min(2, "Company Name must be at least 2 characters."),
  contactName: z.string().min(2, "Contact Name must be at least 2 characters."),
  email: z.string().email("Must be a valid email address."),
  phone: z.string().optional(),
  monthlyTokenLimit: z.number().min(0, "Must be a positive number.").optional(),
});
export type ClientFormValues = z.infer<typeof clientFormSchema>;

export const brandingFormSchema = z.object({
  primaryColor: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i, "Must be a valid hex color"),
  accentColor: z.string().regex(/^#([0-9a-f]{3}){1,2}$/i, "Must be a valid hex color"),
  logoUrl: z.string().url("Must be a valid URL").or(z.literal("")),
  themeMode: z.enum(["light", "dark", "system"]),
});
export type BrandingFormValues = z.infer<typeof brandingFormSchema>;

export const behaviorFormSchema = z.object({
  readingSpeedWPM: z.number().min(50).max(1000),
  streamingChunkSize: z.number().min(1).max(1024),
  artificialDelayMs: z.number().min(0).max(5000),
});
export type BehaviorFormValues = z.infer<typeof behaviorFormSchema>;
