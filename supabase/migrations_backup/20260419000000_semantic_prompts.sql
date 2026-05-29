ALTER TABLE public.tenant_configs ADD COLUMN semantic_prompts JSONB NOT NULL DEFAULT '{"sdr": "", "gatekeeper": "", "rag_l1": ""}'::jsonb;
UPDATE public.tenant_configs SET semantic_prompts = jsonb_build_object('sdr', system_prompt, 'gatekeeper', '', 'rag_l1', '');
ALTER TABLE public.tenant_configs DROP COLUMN system_prompt;
