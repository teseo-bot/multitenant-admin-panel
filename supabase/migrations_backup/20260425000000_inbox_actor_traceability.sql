-- Migration: Trazabilidad Omnicanal (Sprint Cero)
-- Agrega actor_id a inbox_messages para trazar exactamente qué vendedor o SDR respondió.

ALTER TABLE public.inbox_messages ADD COLUMN IF NOT EXISTS actor_id UUID;

-- Establecer llave foránea opcional hacia auth.users para integridad referencial
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_inbox_messages_actor'
    ) THEN
        ALTER TABLE public.inbox_messages 
        ADD CONSTRAINT fk_inbox_messages_actor 
        FOREIGN KEY (actor_id) 
        REFERENCES auth.users(id) 
        ON DELETE SET NULL;
    END IF;
END $$;
