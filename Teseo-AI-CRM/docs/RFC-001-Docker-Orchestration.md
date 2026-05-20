# RFC-001: Arquitectura de Despliegue Docker y Visualización Multi-Tenant (Bloque 23)

## 1. Objetivo y Alcance
Contenerizar el frontend del sistema Teseo-AI-CRM mediante una imagen de Docker inmutable, e integrar visualización de datos dinámica mediante `recharts`. La personalización del cliente (Tenant) queda estrictamente restringida a nivel de *branding* (colores y logo), preservando una única base de código y un layout uniforme.

## 2. Restricciones Arquitectónicas (Builder)

### 2.1 Inmutabilidad del Layout
- **Regla Estricta:** El esqueleto estructural (Navegación, Grids, contenedores principales) NO ES MUTABLE por tenant.
- **Motivo:** Evitar fragmentación de UI, prevenir deuda técnica y asegurar que el Tester automatizado (E2E) valide rutas estables. Todo tenant opera la misma máquina de estados visual.

### 2.2 Branding Dinámico (Theme Injector Pattern)
- La UI implementará un contexto global de React que consumirá la respuesta del Endpoint Multi-Tenant.
- **Payload Esperado:**
  ```json
  {
    "tenant_id": "org_123",
    "branding": {
      "logo_url": "https://assets.teseo.lat/org_123.png",
      "colors": {
        "primary": "#3B82F6",
        "secondary": "#10B981"
      }
    }
  }
  ```
- Componentes como Sidebar y Recharts consumirán estas variables. Está prohibido el uso de hexadecimales estáticos en los componentes de datos.

### 2.3 Orquestación Docker (Multi-Stage Build)
- **Base:** Node Alpine (ligero).
- **Stage 1 (Builder):** Resolución de dependencias e inyección de variables de entorno genéricas. Ejecución de proceso de minificación.
- **Stage 2 (Runner):** Servidor estático eficiente (Nginx o `serve` nativo) exponiendo el build final en puerto 8080/3000, preparado para Google Cloud Run.

## 3. Plan de Ejecución (WBS para Ejecutor)
1. **Tarea A:** Crear `Dockerfile` multi-stage y `.dockerignore` en la raíz del proyecto para asegurar despliegues menores a 50MB.
2. **Tarea B:** Crear `ThemeProvider.jsx` (o similar) para inyectar configuración asíncrona proveniente del login (Bloque 15).
3. **Tarea C:** Implementar al menos un componente analítico (ej. `MetricsChart.jsx`) consumiendo `recharts` puro y los colores inyectados por el Provider.

---
**Status:** Aprobado para Ejecución.