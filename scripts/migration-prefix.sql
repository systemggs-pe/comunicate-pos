CREATE SEQUENCE client_code_seq;
CREATE SEQUENCE equipment_code_seq;
CREATE SEQUENCE sale_code_seq;
CREATE FUNCTION next_visible_code(seq regclass, prefix text) RETURNS text
LANGUAGE plpgsql VOLATILE AS $$
DECLARE n text;
BEGIN
  n := nextval(seq)::text;
  RETURN prefix || lpad(n, greatest(6, length(n)), '0');
END;
$$;
