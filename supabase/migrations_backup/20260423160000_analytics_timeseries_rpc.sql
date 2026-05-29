-- Up Migration
CREATE OR REPLACE FUNCTION rpc_get_leads_timeseries()
RETURNS TABLE (
  month_name text,
  leads bigint,
  cpa numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', now() - interval '3 months'),
      date_trunc('month', now()),
      '1 month'::interval
    ) AS month_start
  ),
  lead_counts AS (
    SELECT 
      date_trunc('month', created_at) AS month_start,
      count(*) AS leads_count
    FROM leads
    GROUP BY date_trunc('month', created_at)
  )
  SELECT 
    to_char(m.month_start, 'Mon') AS month_name,
    COALESCE(lc.leads_count, 0) AS leads,
    -- Mocking CPA logic based on fixed rules for now, can be tied to a finops join later
    ROUND(CAST(RANDOM() * (25 - 15) + 15 AS numeric), 2) AS cpa
  FROM months m
  LEFT JOIN lead_counts lc ON m.month_start = lc.month_start
  ORDER BY m.month_start ASC;
END;
$$;
