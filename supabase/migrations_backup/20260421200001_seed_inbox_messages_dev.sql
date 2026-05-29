-- RFC-027: Seed for inbox_messages
-- Remueve cualquier condicional de seed y usa leads que existen.

DO $$
DECLARE
    jorge_id UUID;
    ana_id UUID;
    carlos_id UUID;
    maria_id UUID;
BEGIN
    SELECT id INTO jorge_id FROM leads WHERE name = 'Jorge García' LIMIT 1;
    SELECT id INTO ana_id FROM leads WHERE name = 'Ana López' LIMIT 1;
    SELECT id INTO carlos_id FROM leads WHERE name = 'Carlos Ruiz' LIMIT 1;
    SELECT id INTO maria_id FROM leads WHERE name = 'María Fernanda' LIMIT 1;

    IF jorge_id IS NOT NULL THEN
        INSERT INTO inbox_messages (lead_id, sender, channel, content, created_at) VALUES
        (jorge_id, 'customer', 'web', 'Hola, me interesa saber más sobre Teseo.', now() - interval '3 hours'),
        (jorge_id, 'ai_agent', 'web', '¡Hola Jorge! Claro que sí. ¿En qué te podemos ayudar específicamente?', now() - interval '2 hours'),
        (jorge_id, 'customer', 'web', 'Quiero automatizar mi CRM.', now() - interval '1 hour');
    END IF;

    IF ana_id IS NOT NULL THEN
        INSERT INTO inbox_messages (lead_id, sender, channel, content, created_at) VALUES
        (ana_id, 'customer', 'telegram', '¿Tienen soporte para Telegram?', now() - interval '1 day'),
        (ana_id, 'human_admin', 'telegram', 'Sí, Ana. De hecho, te estamos respondiendo desde ahí.', now() - interval '23 hours');
    END IF;

    IF carlos_id IS NOT NULL THEN
        INSERT INTO inbox_messages (lead_id, sender, channel, content, created_at) VALUES
        (carlos_id, 'customer', 'whatsapp', 'Necesito una demo.', now() - interval '2 days'),
        (carlos_id, 'ai_agent', 'whatsapp', 'Por supuesto, ¿qué día te viene mejor?', now() - interval '1 day');
    END IF;

    IF maria_id IS NOT NULL THEN
        INSERT INTO inbox_messages (lead_id, sender, channel, content, created_at) VALUES
        (maria_id, 'ai_agent', 'email', 'Hola María, ¿tienes disponibilidad esta semana?', now() - interval '5 days'),
        (maria_id, 'customer', 'email', 'No, no me interesa, gracias.', now() - interval '4 days');
    END IF;
END $$;