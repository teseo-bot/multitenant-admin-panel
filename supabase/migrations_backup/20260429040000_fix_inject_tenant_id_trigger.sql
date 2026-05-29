-- Modificar la función inject_tenant_id para eliminar el hardcode de 'fleetco'
-- Ahora extrae el tenant_id dinámicamente:
-- 1. Respeta el 'tenant_id' si se envía explícitamente en raw_user_meta_data al crear la cuenta.
-- 2. Si no viene, usa una lógica de dominio parseando el email (ej. usuario@fleetco.mx -> fleetco).

CREATE OR REPLACE FUNCTION public.inject_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  extracted_tenant text;
BEGIN
  -- Si el tenant_id ya viene en el metadata, lo respetamos
  IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data ? 'tenant_id' THEN
    RETURN NEW;
  END IF;

  -- Extraer el slug del tenant basado en el dominio del email
  IF NEW.email IS NOT NULL THEN
    extracted_tenant := split_part(split_part(NEW.email, '@', 2), '.', 1);
  END IF;

  -- Inyectar el tenant dinámico si pudimos extraer algo
  IF extracted_tenant IS NOT NULL AND extracted_tenant != '' THEN
    IF NEW.raw_user_meta_data IS NULL THEN
      NEW.raw_user_meta_data := jsonb_build_object('tenant_id', extracted_tenant);
    ELSE
      NEW.raw_user_meta_data := NEW.raw_user_meta_data || jsonb_build_object('tenant_id', extracted_tenant);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
