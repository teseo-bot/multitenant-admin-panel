-- Supabase RPC migrations for A/B testing analytics

-- Function: get_experiment_stats
-- Returns aggregated stats for each variant of an experiment
CREATE OR REPLACE FUNCTION get_experiment_stats(p_experiment_id UUID)
RETURNS TABLE (
  "variantId" UUID,
  "label" TEXT,
  "impressions" BIGINT,
  "responseRate" NUMERIC,
  "positiveRate" NUMERIC,
  "meetingsBooked" BIGINT,
  "avgSentiment" NUMERIC,
  "avgResponseTimeMs" NUMERIC,
  "conversionRate" NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH variant_data AS (
    SELECT 
      v.id as variant_id,
      v.label as variant_label,
      COUNT(i.id) as impressions,
      COUNT(i.id) FILTER (WHERE i.outcome != 'no_response') as responses,
      COUNT(i.id) FILTER (WHERE i.outcome = 'positive_response' OR i.outcome = 'meeting_booked' OR i.outcome = 'deal_advanced') as positive_responses,
      COUNT(i.id) FILTER (WHERE i.outcome = 'meeting_booked') as meetings,
      COUNT(i.id) FILTER (WHERE i.outcome IN ('meeting_booked', 'deal_advanced')) as conversions,
      AVG(i.sentiment_score) as avg_sentiment,
      AVG(i.response_time_ms) as avg_response_time
    FROM ab_variants v
    LEFT JOIN ab_impressions i ON v.id = i.variant_id
    WHERE v.experiment_id = p_experiment_id
    GROUP BY v.id, v.label
  )
  SELECT 
    variant_id,
    variant_label,
    impressions,
    CASE WHEN impressions > 0 THEN ROUND((responses::numeric / impressions::numeric) * 100, 2) ELSE 0 END,
    CASE WHEN impressions > 0 THEN ROUND((positive_responses::numeric / impressions::numeric) * 100, 2) ELSE 0 END,
    meetings,
    COALESCE(ROUND(avg_sentiment::numeric, 2), 0),
    COALESCE(ROUND(avg_response_time::numeric, 2), 0),
    CASE WHEN impressions > 0 THEN ROUND((conversions::numeric / impressions::numeric) * 100, 2) ELSE 0 END
  FROM variant_data;
END;
$$ LANGUAGE plpgsql;

-- Function: get_experiment_timeseries
-- Returns timeseries data for the convergence chart
CREATE OR REPLACE FUNCTION get_experiment_timeseries(p_experiment_id UUID, p_bucket TEXT DEFAULT 'day')
RETURNS TABLE (
  "timeBucket" TIMESTAMPTZ,
  "variantId" UUID,
  "label" TEXT,
  "conversionRate" NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH time_buckets AS (
    SELECT 
      date_trunc(p_bucket, i.created_at) as time_bucket,
      v.id as variant_id,
      v.label as variant_label,
      COUNT(i.id) as total_impressions,
      COUNT(i.id) FILTER (WHERE i.outcome IN ('meeting_booked', 'deal_advanced')) as total_conversions
    FROM ab_variants v
    JOIN ab_impressions i ON v.id = i.variant_id
    WHERE v.experiment_id = p_experiment_id
    GROUP BY 1, 2, 3
  )
  SELECT 
    time_bucket,
    variant_id,
    variant_label,
    CASE WHEN total_impressions > 0 THEN ROUND((total_conversions::numeric / total_impressions::numeric) * 100, 2) ELSE 0 END as conversion_rate
  FROM time_buckets
  ORDER BY time_bucket ASC;
END;
$$ LANGUAGE plpgsql;
