# ADR-117: Arquitectura de Persistencia Realtime y D&D para Command Center

| Campo | Valor |
|---|---|
| **ID** | ADR-117 |
| **Estado** | Aprobado |
| **Fecha** | 2026-04-21 |
| **Autor** | Teseo AIDevops (Builder/Tester) |
| **Aprobador** | Jorge García (CEO) |
| **Dominio** | Base de Datos, SSE y Drag & Drop |

## 1. Contexto y Problema
En el desarrollo del Sprint 1.1 (Command Center In-House), se presentaron dos desafíos arquitectónicos críticos:
1. **Latencia y Reindexación en Drag & Drop (Kanban):** Reordenar leads en un tablero visual comúnmente requiere recalcular y actualizar los índices de todos los elementos posteriores en la base de datos, lo cual es ineficiente y bloquea la tabla.
2. **Fugas de Memoria en Server-Sent Events (SSE):** Mantener conexiones persistentes para escuchar eventos de Postgres (`LISTEN inbox_channel`) en un entorno Serverless como Next.js/Cloud Run provoca fugas en el Pool de conexiones si el cliente cierra la pestaña y el servidor no libera correctamente el socket ni purga los *listeners* huérfanos.

## 2. Decisiones Arquitectónicas

### 2.1 Drag & Drop Optimista (Punto Medio Lexicográfico)
- Se implementó un campo `sort_order` de tipo `DOUBLE PRECISION` en la tabla `leads` (en lugar de `INTEGER`).
- **Mecanismo:** Al mover un lead entre la posición A (ej. 1000) y B (ej. 2000), el nuevo `sort_order` se calcula como el punto medio (1500). Esto permite realizar reordenamientos infinitos mediante operaciones matemáticas simples (O(1)) sin afectar a otros registros en la BD.
- Esta decisión se alinea perfectamente con la mutación optimista de TanStack Query para latencia percibida cero en el Frontend.

### 2.2 Patrón Idempotente para SSE y PostgreSQL NOTIFY
- Se estandarizó el uso de `pg_notify($1, $2)` parametrizado para evitar inyecciones SQL en los payloads JSON de eventos asíncronos.
- **Limpieza de Sockets (Garbage Collection):** Se implementó un *helper* `cleanup()` en la ruta `/stream`. Al detectar la señal de aborto del cliente (`req.signal.onabort`), el servidor ejecuta explícitamente `UNLISTEN *` y `client.removeAllListeners('notification')` ANTES de ejecutar `client.release()`. Esto previene el "Double Release" y asegura que las conexiones devueltas al Pool no mantengan eventos residuales escuchando en memoria.

## 3. Consecuencias
- **Pros:** El Command Center puede manejar cientos de *Leads* y conexiones concurrentes de chat en tiempo real sin saturar la memoria del contenedor en Cloud Run ni bloquear transacciones masivas en la BD.
- **Siguientes Pasos:** La interfaz visual del Kanban deberá implementar la lógica matemática en frontend para calcular el punto medio al usar `@dnd-kit/core` y enviar únicamente ese número en el *payload* del PATCH.
