# ADR 165: Fallback de Persistencia RAG (Eventual Consistency vs ACID)

## 1. Contexto y Deadlock
Durante la implementación de la Tarea 6 (Persistencia de Vectores RAG), se instruyó al Ejecutor crear un Stored Procedure (`bulk_insert_tenant_memories`) vía RPC en Supabase para asegurar transaccionalidad estricta (borrado e inserción atómica de chunks de un documento). 
El Ejecutor ha fallado de manera repetitiva creando un bucle infinito ("hallucination loop") debido a:
1. **Incompatibilidad de Tipado:** Convertir un payload JSON a un `recordset` de Postgres y coercer correctamente arreglos de números al tipo nativo `vector(768)` a menudo genera fallos ocultos de sintaxis en el motor DB.
2. **Ciclo de Tipos Roto:** Al no completarse correctamente la migración SQL del RPC, la CLI de Supabase no puede generar los tipos de TypeScript actualizados para `.rpc()`, rompiendo la compilación del orquestador Node.
3. **Acoplamiento de Lógica:** Colocar el pipeline de inserción de vectores de IA en la capa de persistencia (PL/pgSQL) acopla innecesariamente la infraestructura.

## 2. Análisis Arquitectónico
¿Realmente necesitamos transaccionalidad estricta (ACID) en la base de datos para la ingesta de vectores RAG?
**No.** Estamos construyendo un orquestador asíncrono gestionado por colas (`pg-boss` / LangGraph). El principio de los sistemas distribuidos orientados a eventos prioriza la **Consistencia Eventual** y la **Idempotencia**. 
Si el script falla entre la fase de borrado y la fase de inserción, el documento simplemente queda sin indexar de manera temporal. La cola de trabajos reintentará la tarea, ejecutando el borrado (lo que dará 0 filas, seguro) y luego aplicando la inserción exitosamente.

## 3. Decisión Técnica
1. **Eliminar el RPC:** Abandonar el enfoque de Stored Procedures (SQL) para esta tarea en particular.
2. **Utilizar el SDK de Supabase en dos pasos (Application Layer):**
   - **Paso 1 (Delete):** `await supabase.from('tenant_memories').delete().eq('document_id', p_document_id)`
   - **Paso 2 (Insert):** `await supabase.from('tenant_memories').insert(chunksArray)`
3. **Chunking Opcional:** Si el documento tiene miles de fragmentos (superando los límites de carga de PostgREST), el código Node.js se encargará de dividir el payload en lotes de inserción de ~100/500 vectores.

## 4. Instrucciones para el Ejecutor
El Ejecutor deberá realizar estrictamente los siguientes pasos:
1. **Borrar la migración fallida:** `rm ./supabase/migrations/20260424000005_rpc_insert_vectors.sql` (o la migración correspondiente del RPC).
2. **Actualizar Tipos:** Ejecutar el comando de generación de tipos si es necesario para limpiar referencias al RPC.
3. **Refactorizar `vectors.ts`:**
   ```typescript
   import { supabaseClient as supabase } from '../supabase-admin.js';

   export async function insertVectors(
     p_tenant_id: string,
     p_document_id: string,
     chunksArray: Array<{ chunk: string; embedding: number[] }>
   ): Promise<void> {
     // 1. Limpieza idempotente previa
     const { error: delErr } = await supabase
       .from('tenant_memories')
       .delete()
       .eq('document_id', p_document_id)
       .eq('tenant_id', p_tenant_id);
       
     if (delErr) throw new Error(`Error en limpieza de vectores: ${delErr.message}`);

     // 2. Mapeo de payload
     const payload = chunksArray.map(c => ({
       tenant_id: p_tenant_id,
       document_id: p_document_id,
       content: c.chunk,
       embedding: c.embedding
     }));

     // 3. Batch insert en memoria (aprovechando que Supabase SDK maneja el casteo a pgvector)
     // Si el arreglo es excesivamente largo, considerar partir el 'payload' en lotes de 200.
     const { error: insErr } = await supabase
       .from('tenant_memories')
       .insert(payload);

     if (insErr) throw new Error(`Error en inserción de vectores: ${insErr.message}`);
   }
   ```

Con esto, rompemos el deadlock y recuperamos la velocidad de desarrollo.
