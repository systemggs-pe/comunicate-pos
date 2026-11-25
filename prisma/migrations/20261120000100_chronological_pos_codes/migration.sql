BEGIN;

LOCK TABLE "Client", "Equipment", "Sale", "RegistrationRequest" IN ACCESS EXCLUSIVE MODE;

CREATE OR REPLACE FUNCTION next_visible_code(seq regclass, prefix text) RETURNS text
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  n text := nextval(seq)::text;
  digits integer := CASE WHEN prefix = 'USR-' THEN 6 ELSE 5 END;
BEGIN
  RETURN prefix || lpad(n, greatest(digits, length(n)), '0');
END;
$$;

DO $$
DECLARE
  entity record;
  next_number bigint;
  temporary_prefix text := 'renumber-' || gen_random_uuid()::text || '-';
BEGIN
  FOR entity IN SELECT * FROM (VALUES
    ('Client', 'createdAt', 'CL', 'client_code_seq'),
    ('Equipment', 'createdAt', 'EQ-', 'equipment_code_seq'),
    ('Sale', 'occurredAt', 'SALE-', 'sale_code_seq'),
    ('RegistrationRequest', 'occurredAt', 'RECO-', 'registration_code_seq')
  ) AS entities(table_name, date_field, prefix, sequence_name)
  LOOP
    EXECUTE format('CREATE TEMP TABLE code_map ON COMMIT DROP AS
      SELECT id, row_number() OVER (ORDER BY %I, id)::text AS number FROM %I',
      entity.date_field, entity.table_name);
    EXECUTE format('UPDATE %I t SET code = $1 || t.id::text FROM code_map m
      WHERE t.id = m.id AND t.code <> $2 || lpad(m.number, greatest(5, length(m.number)), ''0'')',
      entity.table_name) USING temporary_prefix, entity.prefix;
    EXECUTE format('UPDATE %I t SET code = $1 || lpad(m.number, greatest(5, length(m.number)), ''0'')
      FROM code_map m WHERE t.id = m.id AND t.code LIKE $2 || ''%%''',
      entity.table_name) USING entity.prefix, temporary_prefix;
    SELECT count(*) + 1 INTO next_number FROM code_map;
    EXECUTE format('ALTER SEQUENCE %I RESTART WITH %s', entity.sequence_name, next_number);
    DROP TABLE code_map;
  END LOOP;
END
$$;

ALTER TABLE "Client" ALTER COLUMN code SET DEFAULT next_visible_code('client_code_seq'::regclass, 'CL');

COMMIT;
