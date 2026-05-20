CREATE OR REPLACE FUNCTION rebalance_column()
RETURNS void AS $$
DECLARE
    lead_record RECORD;
    new_order FLOAT := 1000;
BEGIN
    FOR lead_record IN 
        SELECT id FROM leads ORDER BY sort_order ASC
    LOOP
        UPDATE leads SET sort_order = new_order WHERE id = lead_record.id;
        new_order := new_order + 1000;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
