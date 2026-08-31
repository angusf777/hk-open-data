CREATE OR REPLACE FUNCTION reject_immutable_change()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% rows are immutable', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER raw_object_immutable
BEFORE UPDATE OR DELETE ON raw_object
FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();

CREATE TRIGGER audit_entry_immutable
BEFORE UPDATE OR DELETE ON audit_entry
FOR EACH ROW EXECUTE FUNCTION reject_immutable_change();
