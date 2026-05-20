import { useState, useEffect } from 'react';
// import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
// const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
// const supabase = createClient(supabaseUrl, supabaseKey);

export interface Campaign {
  id: string;
  tenant_id: string;
  type: 'email_sequence' | 'ad_copy' | 'blast';
  status: 'draft' | 'review' | 'approved' | 'sent' | 'failed';
  content: Record<string, unknown>;
  evaluator_score: number | null;
  evaluator_feedback: string | null;
  created_at: string;
  updated_at: string;
}

const mockCampaigns: Campaign[] = [
  {
    id: 'c1-uuid',
    tenant_id: 't1-uuid',
    type: 'email_sequence',
    status: 'sent',
    content: { subject: 'Hello', body: 'World' },
    evaluator_score: 9,
    evaluator_feedback: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'c2-uuid',
    tenant_id: 't1-uuid',
    type: 'blast',
    status: 'failed',
    content: { message: 'Discount 50% off!!' },
    evaluator_score: 3,
    evaluator_feedback: 'Too spammy.',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString()
  }
];

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // API Call simulation
    // supabase.from('campaigns').select('*').then(({ data }) => setCampaigns(data));
    const timer = setTimeout(() => {
      setCampaigns(mockCampaigns);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return { campaigns, loading };
}

export function useCampaign(id: string) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      const found = mockCampaigns.find(c => c.id === id) || null;
      setCampaign(found);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [id]);

  return { campaign, loading };
}
