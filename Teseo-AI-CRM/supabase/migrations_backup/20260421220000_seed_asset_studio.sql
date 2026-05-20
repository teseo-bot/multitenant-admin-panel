-- ============================================================
-- Seed para Asset Studio (Modo Dev - Tenant 1)
-- ============================================================

DO $$ 
DECLARE
  v_tenant_id UUID;
  v_sdr_template_id UUID;
  v_gatekeeper_template_id UUID;
  v_sdr_version_id UUID;
  v_gatekeeper_version_id UUID;
BEGIN
  -- 1. Obtener o crear un tenant de pruebas
  SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    INSERT INTO tenants (id, name, status) 
    VALUES (gen_random_uuid(), 'Teseo Dev Tenant', 'active') 
    RETURNING id INTO v_tenant_id;
  END IF;

  -- 2. Crear Templates
  INSERT INTO prompt_templates (tenant_id, role, name, description)
  VALUES 
    (v_tenant_id, 'sdr', 'SDR Maestro', 'Prompt principal para atención y cualificación.')
  RETURNING id INTO v_sdr_template_id;

  INSERT INTO prompt_templates (tenant_id, role, name, description)
  VALUES 
    (v_tenant_id, 'gatekeeper', 'Filtro Inicial', 'Clasificación de spam y enrutamiento.')
  RETURNING id INTO v_gatekeeper_template_id;

  -- 3. Crear Versiones Iniciales
  INSERT INTO prompt_versions (template_id, version_number, content, status, created_by)
  VALUES 
    (v_sdr_template_id, 1, 'Eres un vendedor experto. Tu objetivo es agendar una cita. Tono: {{tone}}', 'active', gen_random_uuid())
  RETURNING id INTO v_sdr_version_id;

  INSERT INTO prompt_versions (template_id, version_number, content, status, created_by)
  VALUES 
    (v_gatekeeper_template_id, 1, 'Evalúa si el mensaje es spam. Responde con un JSON estricto.', 'active', gen_random_uuid())
  RETURNING id INTO v_gatekeeper_version_id;

  -- 4. Actualizar el puntero de active_version en los templates
  UPDATE prompt_templates SET active_version_id = v_sdr_version_id WHERE id = v_sdr_template_id;
  UPDATE prompt_templates SET active_version_id = v_gatekeeper_version_id WHERE id = v_gatekeeper_template_id;

  -- 5. Crear variables base
  INSERT INTO variable_defs (tenant_id, key, label, type, default_value)
  VALUES 
    (v_tenant_id, 'tone', 'Tono de Respuesta', 'enum', 'Profesional'),
    (v_tenant_id, 'company_name', 'Nombre Empresa', 'text', 'Teseo Latam');

END $$;
