# RFC-020: Nodo Investigador (OSINT) & Ingesta B2B

## Objetivo
Integración de herramientas de Scraping web y extracción estructurada para inteligencia competitiva.

## Diseño del Nodo
- **Enrutador:** LangGraph Router (`investigator_node.ts`).
- **Scraping:** Integración con proveedores de scraping web y OSINT (como Apify o Crawlee, validados en el brain general).
- **Estructuración:** Uso de **Zod** para garantizar validación y tipado estricto en el parsing de la extracción B2B.

### Principios Aplicados (SOLID & DRY)
- **Single Responsibility (SRP):** El nodo se dedica exclusivamente a la extracción e inferencia del ICP, delegando notificaciones o almacenamiento al grafo principal.
- **Dependency Inversion / DRY:** Inyección de un cliente base de scraping (ScraperService) para reusar lógicas de rate-limiting, retries y timeouts sin importar el proveedor (LinkedIn vs Web Corporativa).

## Flujo
1. **Recepción:** Webhook con payload del prospecto (sitio web, URL de LinkedIn).
2. **Scraping:** Lanzamiento de jobs asíncronos para extraer el texto crudo.
3. **Cálculo Asíncrono (ICP Score):** El LLM consume el texto limpio y mapea los datos contra el perfil de cliente ideal usando el schema de Zod.
4. **Retorno:** El nodo actualiza el estado de LangGraph y cede el control al siguiente nodo en la pipeline de ventas.

## WBS (Desglose de Tareas)
1. **Modelado de Datos (Zod)**
   - [ ] Crear `CompanyProfileSchema`.
   - [ ] Crear `ICPScoreSchema`.
2. **Módulo de Ingestión**
   - [ ] Implementar cliente genérico de web scraping.
   - [ ] Agregar manejo de errores (bloqueos, fallas de JS).
3. **Nodo LangGraph (`investigator_node.ts`)**
   - [ ] Construir la función del nodo acoplada al `StateGraph`.
   - [ ] Bind tools de scraping al LLM de inferencia.
4. **Pruebas (Unit & Mocks)**
   - [ ] Mock de la respuesta del webhook.
   - [ ] Mock de la salida de scraping para validar que Zod arroje el Score correcto.