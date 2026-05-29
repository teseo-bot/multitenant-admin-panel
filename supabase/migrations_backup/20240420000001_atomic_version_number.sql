CREATE OR REPLACE FUNCTION set_next_version_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.version_number IS NULL THEN
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO NEW.version_number
    FROM prompt_versions
    WHERE template_id = NEW.template_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_next_version_number ON prompt_versions;

CREATE TRIGGER tr_set_next_version_number
BEFORE INSERT ON prompt_versions
FOR EACH ROW
EXECUTE FUNCTION set_next_version_number();
