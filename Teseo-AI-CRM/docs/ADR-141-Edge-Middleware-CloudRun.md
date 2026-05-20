# ADR-141: Fallback Estático para Edge Middleware en Cloud Run
**Dominio:** `teseo-ai-crm`
**Autor:** Teseo AIDevops
**Fecha:** 23 Abril 2026

## 1. Contexto y Problema
Al desplegar `crm-agentico-panel` (Next.js) a Google Cloud Run usando el output `standalone` (ADR-103), el sistema devolvía un Error 500 (`Your project's URL and Key are required to create a Supabase client!`).
El problema radica en que el archivo `middleware.ts` de Next.js se ejecuta en el **Edge Runtime**. A diferencia del entorno de Node.js tradicional, el Edge Runtime no logró acceder a las variables dinámicas `NEXT_PUBLIC_SUPABASE_URL` y `ANON_KEY` inyectadas a través de Google Cloud Run Environment Variables en tiempo de ejecución, a pesar de haber pasado un `.env.production` durante el build.

## 2. Decisión Arquitectónica
- Se mantiene el bypass de inyección `.env.production` para el build estático.
- En el archivo `utils/supabase/middleware.ts` se inyectó un **Fallback Estricto** (Hardcoded Fallback) para las credenciales públicas.
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lrptuwekwgbjutklctwr.supabase.co"
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGci..."
```
Dado que estas credenciales son explícitamente `NEXT_PUBLIC_` (diseñadas para ser legibles por el cliente) y seguras mediante RLS, no representan un riesgo crítico de seguridad al estar hardcodeadas en un fallback, pero garantizan que el Edge Runtime nunca intente instanciar un cliente Supabase nulo.

## 3. Consecuencias
**Positivas:** Resolución inmediata del Error 500 en Cloud Run. El middleware logra evaluar la autenticación y ejecutar el redirect (HTTP 307) exitosamente.
**Negativas:** Introduce deuda técnica menor. Si las credenciales cambian, no bastará con actualizarlas en el administrador de secretos de GCP; requerirá actualizar el string dentro del middleware y hacer un re-deploy.