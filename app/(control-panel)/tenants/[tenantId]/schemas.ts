import { z } from "zod";

export const operationFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  domain: z.string().url({ message: "Domain must be a valid URL." }),
  orchestratorUrl: z.string().url({ message: "Orchestrator URL must be a valid URL." }),
  telegramBotToken: z.string().min(10, { message: "Telegram Bot Token must be at least 10 characters." }),
  telegramWhitelistedGroupIds: z.string().optional(),
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
  primaryColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/i, "Must be a valid hex color"),
  secondaryColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/i, "Must be a valid hex color"),
  accentColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/i, "Must be a valid hex color"),
  backgroundColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/i, "Must be a valid hex color"),
  cardBackgroundColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/i, "Must be a valid hex color"),
  logoLightUrl: z.string().url("Must be a valid URL").or(z.literal("")),
  logoDarkUrl: z.string().url("Must be a valid URL").or(z.literal("")),
  faviconUrl: z.string().url("Must be a valid URL").or(z.literal("")),
  appIconUrl: z.string().url("Must be a valid URL").or(z.literal("")),
  themeMode: z.enum(["light", "dark", "system"]),
});
export type BrandingFormValues = z.infer<typeof brandingFormSchema>;

export const behaviorFormSchema = z.object({
  readingSpeedWPM: z.number().min(50).max(1000),
  streamingChunkSize: z.number().min(1).max(1024),
  artificialDelayMs: z.number().min(0).max(5000),
  humanizerEnabled: z.boolean().default(true),
  typoRate: z.number().min(0).max(1).default(0.0),
  pauseBeforeReplyMs: z.number().min(0).max(10000).default(1000),
  typingSpeedVariance: z.number().min(0).max(1).default(0.2),
  allowedExpressions: z.string().optional(),
  forbiddenExpressions: z.string().optional(),
  intermittentTyping: z.boolean().default(false),
});
export type BehaviorFormValues = z.infer<typeof behaviorFormSchema>;

export const suspensionFormSchema = z.object({
  suspensionStatus: z.enum(["active", "delayed", "unpaid", "suspended"]),
  suspensionReason: z.string().optional(),
  suspensionMessage: z.string().optional(),
});
export type SuspensionFormValues = z.infer<typeof suspensionFormSchema>;
