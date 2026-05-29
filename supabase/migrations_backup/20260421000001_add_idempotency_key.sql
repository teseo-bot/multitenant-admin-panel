ALTER TABLE public.campaign_events ADD COLUMN idempotency_key VARCHAR(255);
ALTER TABLE public.campaign_events ADD CONSTRAINT campaign_events_campaign_id_idempotency_key_key UNIQUE (campaign_id, idempotency_key);
