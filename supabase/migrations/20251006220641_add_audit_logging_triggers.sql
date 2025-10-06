/*
  # Add Audit Logging Triggers

  ## Overview
  Creates automatic audit logging for all receipt operations and other key actions.

  ## Changes
  1. Functions
    - `log_receipt_insert()` - Logs receipt creation
    - `log_receipt_update()` - Logs receipt modifications
    - `log_receipt_delete()` - Logs receipt deletions
    - `log_business_action()` - Logs business creation/updates
    - `log_collection_action()` - Logs collection creation/updates

  2. Triggers
    - Automatically populate audit_logs table on receipt operations
    - Automatically populate audit_logs table on business operations
    - Automatically populate audit_logs table on collection operations

  3. RLS Updates
    - Add policy for business owners to see their team's audit logs
    - Add policy for system admins to see all audit logs

  ## Security
  - Audit logs remain read-only for users
  - Only triggers can insert into audit_logs
  - Business owners can see logs for their business
  - System admins can see all logs
*/

-- Function to log receipt insertions
CREATE OR REPLACE FUNCTION log_receipt_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'create_receipt',
    'receipt',
    NEW.id,
    jsonb_build_object(
      'vendor_name', NEW.vendor_name,
      'total_amount', NEW.total_amount,
      'collection_id', NEW.collection_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log receipt updates
CREATE OR REPLACE FUNCTION log_receipt_update()
RETURNS TRIGGER AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
BEGIN
  IF OLD.vendor_name IS DISTINCT FROM NEW.vendor_name THEN
    changes := changes || jsonb_build_object('vendor_name', jsonb_build_object('old', OLD.vendor_name, 'new', NEW.vendor_name));
  END IF;
  
  IF OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
    changes := changes || jsonb_build_object('total_amount', jsonb_build_object('old', OLD.total_amount, 'new', NEW.total_amount));
  END IF;
  
  IF OLD.category IS DISTINCT FROM NEW.category THEN
    changes := changes || jsonb_build_object('category', jsonb_build_object('old', OLD.category, 'new', NEW.category));
  END IF;
  
  IF OLD.transaction_date IS DISTINCT FROM NEW.transaction_date THEN
    changes := changes || jsonb_build_object('transaction_date', jsonb_build_object('old', OLD.transaction_date, 'new', NEW.transaction_date));
  END IF;

  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'update_receipt',
    'receipt',
    NEW.id,
    jsonb_build_object(
      'changes', changes,
      'collection_id', NEW.collection_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log receipt deletions
CREATE OR REPLACE FUNCTION log_receipt_delete()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'delete_receipt',
    'receipt',
    OLD.id,
    jsonb_build_object(
      'vendor_name', OLD.vendor_name,
      'total_amount', OLD.total_amount,
      'collection_id', OLD.collection_id
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log business actions
CREATE OR REPLACE FUNCTION log_business_action()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
      auth.uid(),
      'create_business',
      'business',
      NEW.id,
      jsonb_build_object('name', NEW.name)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
      auth.uid(),
      'update_business',
      'business',
      NEW.id,
      jsonb_build_object('name', NEW.name)
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log collection actions
CREATE OR REPLACE FUNCTION log_collection_action()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
      auth.uid(),
      'create_collection',
      'collection',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'business_id', NEW.business_id)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
      auth.uid(),
      'update_collection',
      'collection',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'business_id', NEW.business_id)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
      auth.uid(),
      'delete_collection',
      'collection',
      OLD.id,
      jsonb_build_object('name', OLD.name, 'business_id', OLD.business_id)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for receipts
DROP TRIGGER IF EXISTS audit_receipt_insert ON receipts;
CREATE TRIGGER audit_receipt_insert
  AFTER INSERT ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION log_receipt_insert();

DROP TRIGGER IF EXISTS audit_receipt_update ON receipts;
CREATE TRIGGER audit_receipt_update
  AFTER UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION log_receipt_update();

DROP TRIGGER IF EXISTS audit_receipt_delete ON receipts;
CREATE TRIGGER audit_receipt_delete
  BEFORE DELETE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION log_receipt_delete();

-- Create triggers for businesses
DROP TRIGGER IF EXISTS audit_business_changes ON businesses;
CREATE TRIGGER audit_business_changes
  AFTER INSERT OR UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION log_business_action();

-- Create triggers for collections
DROP TRIGGER IF EXISTS audit_collection_changes ON collections;
CREATE TRIGGER audit_collection_changes
  AFTER INSERT OR UPDATE OR DELETE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION log_collection_action();

-- Update RLS policies for audit_logs to allow business owners to see their team's logs
DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;

CREATE POLICY "Users can view own audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Business owners can view team audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.owner_id = auth.uid()
      AND (
        -- Logs related to business itself
        (audit_logs.resource_type = 'business' AND audit_logs.resource_id = b.id) OR
        -- Logs related to collections in this business
        (audit_logs.resource_type = 'collection' AND (audit_logs.details->>'business_id')::uuid = b.id) OR
        -- Logs related to receipts in collections of this business
        (audit_logs.resource_type = 'receipt' AND EXISTS (
          SELECT 1 FROM collections c
          WHERE c.id = (audit_logs.details->>'collection_id')::uuid
          AND c.business_id = b.id
        ))
      )
    )
  );

CREATE POLICY "System admins can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
