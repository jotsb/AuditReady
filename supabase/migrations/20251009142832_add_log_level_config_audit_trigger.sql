/*
  # Add Log Level Config Audit Trigger

  Adds audit logging for log_level_config table changes to complete audit coverage.
*/

CREATE OR REPLACE FUNCTION log_log_level_config_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'create_log_config',
      'log_level_config',
      NEW.id,
      jsonb_build_object(
        'category', NEW.category,
        'min_level', NEW.min_level,
        'enabled', NEW.enabled
      ),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'update_log_config',
      'log_level_config',
      NEW.id,
      jsonb_build_object(
        'category', NEW.category,
        'old_min_level', OLD.min_level,
        'new_min_level', NEW.min_level,
        'old_enabled', OLD.enabled,
        'new_enabled', NEW.enabled
      ),
      to_jsonb(OLD),
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'delete_log_config',
      'log_level_config',
      OLD.id,
      jsonb_build_object(
        'category', OLD.category,
        'min_level', OLD.min_level,
        'enabled', OLD.enabled
      ),
      to_jsonb(OLD),
      NULL,
      'success',
      NULL
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS audit_log_level_config_changes ON log_level_config;
CREATE TRIGGER audit_log_level_config_changes
  AFTER INSERT OR UPDATE OR DELETE ON log_level_config
  FOR EACH ROW
  EXECUTE FUNCTION log_log_level_config_changes();
