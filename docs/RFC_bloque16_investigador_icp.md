# RFC-BLOQUE-16: Nodo Investigador e Inteligencia Competitiva RAG (ICP Scoring)

> **Documento de Diseño Arquitectónico**  
> Proyecto: CRM-Agéntico (Teseo-AI-CRM)  
> Autor: Builder (Arquitecto Staff)  
> Estatus: Draft → Pendiente Aprobación  
> Fecha: 2026-04-24  
> Bloque: 16  

## 1. Objetivo
Inyectar al orquestador LangGraph un **Nodo Investigador** que ejecute web scraping estructurado, enriquezca el perfil del lead con inteligencia competitiva y derive el flujo hacia el agente óptimo (**SDR** o **Hunter**) usando un **ICP Score** calculado por vectorización.

## 2. Cambios Estructurales (`state.ts` y `graph.ts`)
- **Gatekeeper:** Reemplazará la ruta `"SDR"` por `"SALES"`, la cual primero atraviesa al `investigadorNode`.
- **Investigador:** Generará dos nuevas variables de estado:
  - `investigatorSummary`: Objeto JSON consolidado de scraping.
  - `salesRoute`: Derivación calculada ( `"sdr"` | `"hunter"` ).
- **Hunter:** Nuevo nodo gemelo al SDR, enfocado en Outbound y cierre asertivo para leads fuera del ICP (Ideal Customer Profile) pero con señales comerciales.

## 3. Web Scraping (Jina Reader)
Para cumplir con la política de Zero-Trust y evadir SSRF, usaremos `jina.ai` u otra API de transformación Markdown externa. Esto previene que el orquestador intente ejecutar Chromium/Playwright dentro de Docker o consuma memoria masiva por páginas pesadas.
- **Compactación:** El resultado se truncará a un límite estricto de 800 tokens antes de inyectarse al LangGraph State.

## 4. ICP Score (Cálculo Vectorial Simple)
Construiremos una herramienta temporal que calcule heurísticamente (o con cosine similarity básico) el valor ICP de la empresa consultada vs las reglas de Odoo.
- Si `ICP > 0.65`: Ruta al SDR (Nurturing).
- Si `ICP < 0.65` pero hay señales de inversión: Ruta al Hunter.

## 5. Próximos Pasos (WBS)
1. Modificar `state.ts` para aceptar las nuevas llaves.
2. Crear `src/nodes/investigator.ts`.
3. Crear `src/nodes/hunter.ts`.
4. Cablear `graph.ts` (SDR -> SALES -> bifurcación).
