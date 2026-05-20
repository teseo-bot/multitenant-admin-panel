# RFC-049: Gestor de Variables Dinámicas (Asset Studio Phase 1 Final)

## 1. Objetivo
Completar la triada del Asset Studio (Prompts, Documents, Variables) construyendo la interfaz de gestión de variables globales del Tenant. Estas variables (ej. `tone`, `company_name`) son inyectadas en tiempo real por el Orquestador dentro de los Prompts Maestros.

## 2. Decisiones Arquitectónicas (Builder)

### 2.1. Backend (Route Handlers)
Se instanciaron los endpoints en `/api/variables` para gestionar el CRUD sobre la tabla `variable_defs`:
- **Fetch:** Extracción estricta bajo RLS filtrada por Tenant_ID, retornado como array de objetos (snake_case transpuesto a camelCase en el Frontend mediante TanStack query mapping).
- **Create:** Validación con Zod (`CreateVariableSchema`) e inyección fallback para multi-tenant (JWT/Bypass dev).

### 2.2. Frontend (React Hooks & UI)
- **Hooks:** `use-variable-defs` y `use-save-variable` encapsulan el Data-Fetching y las Mutaciones Optimistas de TanStack.
- **Grilla de Datos (`variables-table.tsx`):**
  - Muestra la Key en formato de interpolación `{{llave}}`.
  - Mapeo cromático de tipos de dato (Text=Slate, Enum=Purple, JSON=Emerald).
  - Indicador visual de parámetros "Requeridos" vs "Opcionales".
- **Formulario (`variable-create-dialog.tsx`):**
  - Diálogo (Modal) impulsado por `@base-ui/react`.
  - Uso de `react-hook-form` nativo para validación del snake_case y control estricto de los Enums/Types antes de la mutación.

## 3. Estado de Calidad (Tester)
El compilador TypeScript (TSC) reporta cero violaciones. Se corrigieron problemas de compatibilidad del atributo `asChild` migrándolo al patrón de polimorfismo `render={<Component />}` introducido por Base UI (usado en Tailwind v4).

## 4. Cierre del Sprint
La estructura Topológica del Tenant OS Asset Studio (Gestor Visual de Orquestación) queda completamente sellada. Los agentes (LangGraph) ahora tienen un panel de control 100% autogestionable por los humanos, cumpliendo el flujo HITL.
