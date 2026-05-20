# WBS-Checkpointer: Estrategia de Persistencia y Concurrencia (LangGraph)

## 1. Arquitectura de `PostgresCheckpointer`

La implementación del Checkpointer se realizará bajo una clase envolvente (Wrapper) o una extensión de la clase base provista por `@langchain/langgraph-checkpoint-postgres` (u otra implementación estándar en JS/TS). Dicha clase `PostgresCheckpointer` administrará la escritura de estados y delegará el control de concurrencia al inicio de la invocación.

Dado que Node.js es asíncrono y los LLMs tienen tiempos de respuesta prolongados, es imperativo separar las operaciones de I/O a la base de datos de los tiempos de espera prolongados del LLM.

## 2. Estrategia contra *Race Conditions* (Webhooks WhatsApp)

### Evaluación: Advisory Locks vs Row-level Locks (`SELECT FOR UPDATE`)

1. **Row-level Locks (`SELECT FOR UPDATE` clásica):**
   *   **Funcionamiento:** Requiere abrir una transacción (`BEGIN`), hacer la consulta y no hacer `COMMIT` hasta que termine la ejecución del Grafo (LLM incluido).
   *   **Contraindicación:** Mantener una conexión y transacción del pool de base de datos (`pg.Pool`) abierta durante 10-30 segundos esperando a un LLM agotará rápidamente las conexiones disponibles si hay concurrencia, degradando por completo el sistema (Connection Pool Exhaustion).

2. **PostgreSQL Advisory Locks:**
   *   **Funcionamiento:** Bloqueos a nivel de aplicación controlados por la BD (`pg_try_advisory_lock`). No dependen de las filas de una tabla.
   *   **Contraindicación:** El Session-Level Advisory Lock exige que mantengamos atada la misma conexión de PostgreSQL durante todo el tiempo que dura el bloqueo. Sigue presentando el problema del Pool Exhaustion frente a respuestas lentas de LLM.

3. **La Solución Elegida: Lock Lógico (Timestamp based Logical Lock)**
   *   En vez de usar mecanismos bloqueantes a nivel de conexión, implementaremos un *Optimistic/Logical Lock* utilizando una tabla dedicada (`thread_locks`).
   *   Se utiliza un `UPDATE` rápido y atómico que reserva el turno por un periodo de gracia (timeout) sin dejar la conexión del pool abierta.

### Flujo Especifico (Adquisición y Liberación)

1. **Inbound Webhook:** WhatsApp envía el payload al servidor. Se identifica el `thread_id` (ej. el número de teléfono `wa_id`).
2. **Adquisición del Candado:**
   *   El sistema ejecuta la siguiente query atómica antes de instanciar el Grafo de LangGraph:
       ```sql
       UPDATE thread_locks 
       SET locked_at = NOW() 
       WHERE thread_id = $1 AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '60 seconds') 
       RETURNING thread_id;
       ```
       *(Nota: si el hilo es nuevo, primero se hace un `INSERT ON CONFLICT DO NOTHING`).*
   *   **Éxito:** Si la query retorna un ID, el mensaje adquirió el lock. El candado dura como máximo 60 segundos por seguridad (para evitar *deadlocks* si el servidor crashea). El servidor cierra inmediatamente la conexión de BD.
   *   **Fallo:** Si no retorna nada, significa que el hilo ya está procesando un webhook anterior. En este punto, la arquitectura requiere **encolar** este mensaje (ej. BullMQ, o un buffer de reintento en memoria temporal) para ser procesado apenas el thread se libere.
3. **Ejecución Asíncrona:** Se invoca a LangGraph. El agente "piensa", interroga BD vectoriales, consume APIs externas y devuelve resultados. La persistencia (`checkpoints`) ocurre en su ciclo normal.
4. **Liberación del Candado:**
   *   En un bloque `finally` al terminar la ejecución de LangGraph, se libera el canal:
       ```sql
       UPDATE thread_locks SET locked_at = NULL WHERE thread_id = $1;
       ```
   *   En ese instante se dispara el procesamiento del siguiente mensaje encolado para ese `thread_id`.

## 3. Esquema de Tabla SQL

Además del estándar para que el checkpointer funcione, se requiere la tabla de validación de candados.

```sql
-- TABLA DE CONCURRENCIA PARA WEBHOOKS (LOCK LÓGICO)
CREATE TABLE IF NOT EXISTS thread_locks (
    thread_id TEXT PRIMARY KEY,
    locked_at TIMESTAMP WITH TIME ZONE
);

-- ESQUEMA ESTÁNDAR PARA LANGGRAPH POSTGRES CHECKPOINTER
CREATE TABLE IF NOT EXISTS checkpoints (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    parent_checkpoint_id TEXT,
    checkpoint BYTEA NOT NULL,
    metadata BYTEA NOT NULL,
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

CREATE TABLE IF NOT EXISTS checkpoint_blobs (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    channel TEXT NOT NULL,
    version TEXT NOT NULL,
    type TEXT NOT NULL,
    blob BYTEA,
    PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
);

CREATE TABLE IF NOT EXISTS checkpoint_writes (
    thread_id TEXT NOT NULL,
    checkpoint_ns TEXT NOT NULL DEFAULT '',
    checkpoint_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    channel TEXT NOT NULL,
    type TEXT,
    blob BYTEA NOT NULL,
    PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);
```