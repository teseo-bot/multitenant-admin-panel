# RFC: Asset Studio - File Uploader UI & Security Hardening

## 1. Contexto y Objetivo
Como parte del Objetivo 1 del Asset Studio, es necesario refactorizar el sistema de subida de documentos en el `crm-agentico-panel`. 

**Problemas actuales:**
- El frontend usa eventos de arrastrar y soltar de HTML5 que son frágiles, difíciles de mantener y limitados a un solo archivo.
- El backend carece de validación de seguridad (peso y tipo MIME), confiando ciegamente en el frontend.

**Objetivo:** Implementar una experiencia multicarga fluida y robusta en el cliente usando `react-dropzone`, y fortificar el endpoint de subida con validaciones de tipo y tamaño estrictas.

---

## 2. Arquitectura de la Solución

### 2.1 Refactorización del Frontend (`components/asset-studio/upload-dropzone.tsx`)
Se reemplazará la implementación nativa por la librería estándar de la industria `react-dropzone`.
- **Soporte Multicarga:** Habilitar la selección de múltiples archivos en una sola operación (`multiple={true}`).
- **Manejo de Estado UI:** Implementar estados visuales claros para:
  - Reposo (Idle).
  - Arrastre activo (Drag Active).
  - Subiendo (Uploading - con indicadores de carga general/por archivo).
  - Éxito / Error.
- **Validación en Cliente:** Filtrado preventivo de tipos MIME (e.g., PDFs, imágenes, documentos de texto) y límite de tamaño visual para feedback rápido sin saturar la red.

### 2.2 Arquitectura de Validación Backend (`app/api/asset-studio/documents/upload/route.ts`)
No se debe confiar en la validación del frontend. El endpoint será el verdadero gatekeeper.
- **Validación de Tamaño (Size Check):** Interceptar el tamaño del `File` o `Blob`. Rechazar peticiones (HTTP 413 Payload Too Large o HTTP 400) si exceden el límite configurado (ej. 10MB).
- **Validación de Tipo (MIME & Extension Check):** Validar explícitamente el `type` de los archivos recibidos contra una "Allowlist" estricta (ej. `application/pdf`, `image/jpeg`, `image/png`, `text/plain`).
- **Respuesta Estructurada:** Devolver un formato JSON consistente para los errores de validación, permitiendo que el frontend los parsee y muestre al usuario de forma amigable.

---

## 3. Work Breakdown Structure (WBS) - Plan para el Ejecutor

Lista numerada de dependencias técnicas para ejecución directa:

1. **Instalación de Dependencias:**
   - Instalar `react-dropzone` en el entorno de frontend del proyecto (`npm install react-dropzone`).

2. **Fortalecimiento del Backend (`app/api/asset-studio/documents/upload/route.ts`):**
   - Importar o definir las constantes de seguridad: `MAX_FILE_SIZE` (ej. 10MB) y `ALLOWED_MIME_TYPES`.
   - Modificar el flujo de lectura de `formData` para iterar sobre los archivos adjuntos.
   - Implementar los condicionales de validación (si falla el tamaño o el tipo, retornar anticipadamente `NextResponse.json` con status 400/413).
   - Mantener o adaptar la lógica existente de guardado/procesamiento, asegurando que maneje un array de archivos.

3. **Refactorización del Componente Frontend (`components/asset-studio/upload-dropzone.tsx`):**
   - Importar `useDropzone` de `react-dropzone`.
   - Reemplazar los eventos HTML5 (`onDragOver`, `onDrop`, etc.) por la configuración y el hook de `useDropzone`.
   - Configurar las opciones `accept` y `maxSize` en el hook para mapear con las validaciones del backend.
   - Implementar la UI para mostrar la lista de archivos seleccionados/rechazados.

4. **Integración y Manejo de Errores Frontend-Backend:**
   - Modificar la función `onDrop` o el manejador de envío (submit) para enviar los archivos usando `FormData` al endpoint.
   - Manejar correctamente la respuesta: en caso de HTTP 4xx, extraer el mensaje de error estructurado y mostrar una notificación (Toast/Alert) al usuario.
   - Limpiar el estado de la dropzone tras un éxito.