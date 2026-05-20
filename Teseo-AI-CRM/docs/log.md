# LOG - Hotfix Minion Worker (Embedding Vector Dimensionality)

1. El webhook de Telegram funcionó y el `[LEARN]` fue interceptado exitosamente. El trabajo entró a la cola `gbrain_learn` administrada por `pg-boss`.
2. Durante la ejecución en background, el Minion Worker experimentó un error fatal al conectar con Google Generative AI (HTTP 404: `models/text-embedding-004 is not found for API version v1beta`).
3. El modelo de embeddings de Gemini en AI Studio está registrado como `gemini-embedding-2-preview` (que devuelve por defecto vectores de 3072 dimensiones).
4. Debido a que la tabla `tenant_memories` está pre-configurada para `vector(768)`, la librería por defecto de LangChain fallaría con un error de dimensionalidad o modelo no encontrado.
5. Se reemplazó la integración por defecto con una llamada `fetch` manual al endpoint `embedContent`, especificando explícitamente `outputDimensionality: 768`.
6. Se sustituyó el cliente de Supabase JS por el módulo `pg` en `daemon.ts` para inyectar directamente en Postgres usando el `DATABASE_URL` real, evitando falsas llamadas a una URL dummy de Supabase (`lwhqoxfpxsrdkdfihtyy.supabase.co`).
7. El Worker ha sido redesplegado a Cloud Run (`crm-agentico-orchestrator-00063-r98`) exitosamente.