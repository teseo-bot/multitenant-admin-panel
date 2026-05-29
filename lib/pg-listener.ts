import { Client } from 'pg';
import { EventEmitter } from 'events';

// Creamos un EventEmitter global para la aplicación en Node.js
class GlobalEventEmitter extends EventEmitter {}

const globalForPg = global as unknown as {
  ee: GlobalEventEmitter | undefined;
  pgClient: Client | undefined;
};

export const ee = globalForPg.ee ?? new GlobalEventEmitter();
if (process.env.NODE_ENV !== 'production') {
  globalForPg.ee = ee;
}

let isListening = false;
let connectionPromise: Promise<void> | null = null;

export async function setupPgListener() {
  if (isListening) return;
  if (globalForPg.pgClient) return;

  if (connectionPromise) {
    return connectionPromise;
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  connectionPromise = (async () => {
    try {
      await client.connect();
      console.log('Singleton pg.Client connected for LISTEN/NOTIFY');

      // Escuchar notificaciones de Postgres
      client.on('notification', (msg) => {
        if (msg.channel === 'crm_events' && msg.payload) {
          try {
            const payload = JSON.parse(msg.payload);
            ee.emit('crm_event', payload);
          } catch (error) {
            console.error('Error parsing pg notification payload:', error);
          }
        }
      });

      await client.query('LISTEN crm_events');
      isListening = true;

      if (process.env.NODE_ENV !== 'production') {
        globalForPg.pgClient = client;
      }

      // Manejar cierres de conexión (reconectar con backoff exponencial)
      client.on('error', async (err) => {
        console.error('Unexpected error on pg singleton client:', err);
        isListening = false;
        globalForPg.pgClient = undefined;
        connectionPromise = null;
        // Exponential backoff logic would go here
        setTimeout(() => setupPgListener(), 5000);
      });

      client.on('end', () => {
        console.log('Singleton pg.Client disconnected');
        isListening = false;
        globalForPg.pgClient = undefined;
        connectionPromise = null;
        setTimeout(() => setupPgListener(), 5000);
      });

    } catch (error) {
      console.error('Failed to setup pg listener:', error);
      connectionPromise = null;
      setTimeout(() => setupPgListener(), 5000);
    }
  })();

  return connectionPromise;
}

// Ejecutamos la configuración del listener si no estamos escuchando.
// En Next.js esto se puede llamar en el primer request del endpoint SSE.
