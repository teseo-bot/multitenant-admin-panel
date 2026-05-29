import { createClient } from '@/utils/supabase/client';

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
  const supabase = createClient();
  const { data, error } = await supabase
    .from('tenant_financial_summary_view')
    .select('*')
    .order('billing_month', { ascending: false });

  if (error) {
    console.error('FinOps Service Error:', error);
    throw new Error(error.message);
  }

  return data as FinOpsSummary[];
}
