import { z } from "zod";

// Un tenant recién dado de alta NO tiene dominio, ni orquestador desplegado, ni bot de
// Telegram: los tres llegan después del aprovisionamiento. Las tres columnas son `text`
// nullable en `migrations-gcp/001_control_base.sql`, y `lib/services/invitations.ts` ya
// contempla el hueco por escrito («Sin dominio no se inventa uno»). Sólo este formulario
// los exigía, y eso dejaba un tenant en aprovisionamiento imposible de guardar.
const estaVacio = (v?: string) => !v || v.trim() === "";

// `domain` es el HOST del tenant, no una URL: invitations.ts hace
// `domain.startsWith("http") ? domain : \`https://${domain}\``, o sea que le añade el
// esquema él mismo. Exigir `.url()` obligaba a escribir algo que el consumidor no espera.
// Se aceptan las dos formas porque puede haber filas viejas con esquema.
const HOST_O_URL = /^(?:https?:\/\/)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+\/?$/i;

export const operationFormSchema = z.object({
  name: z.string().min(2, { message: "El nombre necesita al menos 2 caracteres." }),
  domain: z
    .string()
    .optional()
    .refine((v) => estaVacio(v) || HOST_O_URL.test(v!.trim()), {
      message: "El dominio es el host del tenant, p. ej. comerseg.fleetco.mx. Déjalo vacío si todavía no tiene.",
    }),
  orchestratorUrl: z
    .string()
    .optional()
    .refine((v) => estaVacio(v) || z.string().url().safeParse(v!.trim()).success, {
      message: "Debe ser una URL completa (https://…), o quedar vacío mientras no haya orquestador.",
    }),
  telegramBotToken: z
    .string()
    .optional()
    .refine((v) => estaVacio(v) || v!.trim().length >= 10, {
      message: "El token del bot tiene al menos 10 caracteres, o déjalo vacío.",
    }),
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
  // Relaxed validations so HSL or variables from DB don't break the form
  primaryColor: z.string().min(1),
  secondaryColor: z.string().min(1),
  accentColor: z.string().min(1),
  backgroundColor: z.string().min(1),
  cardBackgroundColor: z.string().min(1),
  logoLightUrl: z.string().optional(),
  logoDarkUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  appIconUrl: z.string().optional(),
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
