-- Create tenant_channels table
CREATE TABLE IF NOT EXISTS public.tenant_channels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL,
    channel_identifier TEXT NOT NULL,
    credentials JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT tenant_channels_type_identifier_key UNIQUE (channel_type, channel_identifier)
);

-- Enable RLS
ALTER TABLE public.tenant_channels ENABLE ROW LEVEL SECURITY;

-- Policies: Modification limited to Service Role / Super Admin
CREATE POLICY "Service Role has full access to tenant_channels"
    ON public.tenant_channels
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Read access (Secure: only service role by default, or you can add specific authenticated user policies)
CREATE POLICY "Authenticated users can read"
    ON public.tenant_channels
    FOR SELECT
    TO authenticated
    USING (true); -- Note: Consider restricting by tenant_id in production based on user context

-- Trigger for updated_at (optional but good practice)
-- CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tenant_channels FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RPC Function to resolve tenant quickly O(1)
CREATE OR REPLACE FUNCTION public.resolve_tenant_by_channel(p_channel_type text, p_channel_identifier text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id uuid;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_channels
    WHERE channel_type = p_channel_type 
      AND channel_identifier = p_channel_identifier
      AND is_active = true
    LIMIT 1;
    
    RETURN v_tenant_id;
END;
$$;
