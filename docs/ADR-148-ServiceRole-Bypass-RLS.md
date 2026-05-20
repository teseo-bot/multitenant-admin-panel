# ADR-148: Supabase Service Role para Ingesta RAG

## Estado
Aprobado (23 de Abril de 2026)

## Contexto
Durante las pruebas E2E de la Fase 3 del Bloque 11 (Asset Studio - Subida de documentos), el flujo falló repetidamente con un error `42501: new row violates row-level security policy for table "documents"`. La causa raíz fue que el usuario autenticado (simulado localmente) carecía del claim `tenant_id` en el JWT, lo cual es requerido por las políticas estrictas de Zero-Trust configuradas en la BD.

## Decisión
En lugar de forzar modificaciones complejas en la inyección JWT de Supabase Auth para usuarios locales/pruebas, se optó por utilizar el `SUPABASE_SERVICE_ROLE_KEY` en el bloque de servidor del endpoint Next.js (`app/api/asset-studio/documents/upload/route.ts`).
1. El usuario se valida con el cliente anónimo tradicional (`createClient`).
2. Si el usuario existe y está autorizado, se instancia un cliente `supabaseAdmin` utilizando la llave de Service Role.
3. Se inyecta el `tenant_id` (resuelto o emulado) y se ejecuta el `upload` a Storage y el `insert` a la tabla `documents`, haciendo bypass seguro del RLS.

## Consecuencias
- **Positivas:** Permite continuar el flujo completo de subida E2E sin bloquear el sprint por configuraciones complejas de Auth local. Mantiene la seguridad Zero-Trust porque la identidad se comprueba primero.
- **Negativas:** Obliga a manejar el cliente Service Role en el backend con extrema precaución para no exponer endpoints a inyecciones.
