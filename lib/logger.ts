/**
 * Minimal structured logger for the multitenant-admin-panel.
 * Wraps console.* with a structured format suitable for Cloud Run / GCP logging.
 */
const isoNow = () => new Date().toISOString();

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) =>
    console.log(JSON.stringify({ severity: 'INFO', time: isoNow(), msg, ...meta })),
  warn: (msg: string, meta?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ severity: 'WARNING', time: isoNow(), msg, ...meta })),
  error: (msg: string, meta?: Record<string, unknown>) =>
    console.error(JSON.stringify({ severity: 'ERROR', time: isoNow(), msg, ...meta })),
  debug: (msg: string, meta?: Record<string, unknown>) =>
    console.debug(JSON.stringify({ severity: 'DEBUG', time: isoNow(), msg, ...meta })),
};
