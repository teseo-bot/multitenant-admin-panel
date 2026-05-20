# RFC-048: Asset Studio - UI Gestor Documental

## 1. Implementación de Ingesta
Se han desarrollado los componentes frontend para la carga y gestión del conocimiento corporativo (RAG).

### 1.1. Upload Dropzone (`upload-dropzone.tsx`)
- Área de Drag & Drop con soporte nativo de click.
- Limitación estricta a tipos permitidos: PDF, TXT, MD, CSV.
- Limitación de peso: Máximo 10MB por archivo.
- Uso del hook `use-upload-document` (TanStack Query) asociado al Route Handler `POST /api/asset-studio/documents/upload`.

### 1.2. Tabla Documental (`documents-table.tsx`)
- Renderiza el estado del procesamiento (`processing`, `ready`, `error`) con `Badges` visuales e iconos de `lucide-react`.
- Formateo inteligente de bytes a KB/MB.
- Consultas optimizadas con TanStack Query y cacheado por 1 minuto.

## 2. Flujo Completo Desplegado
La ruta `/app/(dashboard)/asset-studio/documents/page.tsx` integra la Dropzone en la parte superior y la tabla interactiva debajo, permitiendo al usuario inyectar contexto de forma ininterrumpida al LangGraph.
