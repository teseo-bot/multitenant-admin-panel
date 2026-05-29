DO $$
DECLARE v_tid UUID;
BEGIN
  SELECT id INTO v_tid FROM tenants LIMIT 1;
  
  IF v_tid IS NULL THEN
    INSERT INTO tenants (id, name, status)
    VALUES ('10000000-0000-0000-0000-000000000001', 'Dev Tenant', 'active')
    RETURNING id INTO v_tid;
  END IF;

  INSERT INTO leads (tenant_id, name, company, email, phone, status, source, icp_score, assigned_node, sort_order) VALUES
  (v_tid, 'Jorge García', 'Teseo', 'jorge@teseo.lat', '555-0100', 'New', 'inbound_web', 95, 'sdr', 1000),
  (v_tid, 'Ana López', 'TechCorp', 'ana@techcorp.com', '555-0101', 'Contacted', 'inbound_telegram', 80, 'gatekeeper', 2000),
  (v_tid, 'Carlos Ruiz', NULL, 'carlos@ruiz.dev', NULL, 'Qualified', 'inbound_whatsapp', 99, 'admin', 3000),
  (v_tid, 'María Fernanda', 'GlobalNet', 'maria@globalnet.io', '555-0103', 'Lost', 'outbound_hunter', 40, 'hunter', 4000),
  (v_tid, 'Luis Suárez', 'DevsStudio', 'luis@devs.studio', '555-0104', 'Won', 'referral', 85, 'unassigned', 5000),
  (v_tid, 'Elena Torres', 'InnovateX', 'elena@innovatex.co', '555-0105', 'New', 'manual', 70, 'gatekeeper', 6000),
  (v_tid, 'Diego Medina', 'CodeBusters', 'diego@codebusters.mx', '555-0106', 'New', 'inbound_web', 60, 'unassigned', 7000);
END $$;