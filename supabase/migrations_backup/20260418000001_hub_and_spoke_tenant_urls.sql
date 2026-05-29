-- Migration: Hub and Spoke Tenant URLs
-- Agrega soporte dinamico de orquestador por inquilino

ALTER TABLE tenants
ADD COLUMN orchestrator_url TEXT,
ADD COLUMN api_key_vault_id TEXT;
