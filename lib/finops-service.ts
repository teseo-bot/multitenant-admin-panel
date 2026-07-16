import { pool } from '@/lib/db';
import { logger } from '@/lib/logger';

export type FinOpsSummary = {
  tenant_id: string;
  billing_month: string;
  model_name: string;
  total_requests: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
};

export async function fetchFinancialSummary(): Promise<FinOpsSummary[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT * FROM tenant_financial_summary_view
       ORDER BY billing_month DESC`
    );

    return res.rows as FinOpsSummary[];
  } catch (err) {
    logger.error('finops.service.error', { error: String(err) });
    throw new Error(`FinOps Service Error: ${String(err)}`);
  } finally {
    client.release();
  }
}
