export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
export type ABOutcome =
  | 'no_response' | 'response' | 'positive_response'
  | 'meeting_booked' | 'deal_advanced' | 'objection' | 'unsubscribe';

export interface ABExperiment {
  id: string;
  tenantId: string;
  templateId: string;
  name: string;
  status: ExperimentStatus;
  minImpressions: number;
  confidenceLevel: number;
  startedAt: string | null;
  endedAt: string | null;
  winnerVariantId: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ABVariant {
  id: string;
  experimentId: string;
  versionId: string;
  trafficPct: number;
  label: string;
  versionNumber?: number;
  content?: string;
}

export interface ABImpression {
  id: string;
  variantId: string;
  threadId: string;
  leadId: string;
  outcome: ABOutcome | null;
  sentimentScore: number | null;
  responseTimeMs: number | null;
  createdAt: string;
}

export interface VariantStats {
  variantId: string;
  label: string;
  impressions: number;
  responseRate: number;
  positiveRate: number;
  meetingsBooked: number;
  avgSentiment: number;
  avgResponseTimeMs: number;
  conversionRate: number;
}

export interface TimeseriesDataPoint {
  timeBucket: string;
  variantId: string;
  label: string;
  conversionRate: number;
}

export interface ExperimentWithStats extends ABExperiment {
  variants: (ABVariant & { stats?: VariantStats })[];
  totalImpressions: number;
  overallConversionRate: number;
}
