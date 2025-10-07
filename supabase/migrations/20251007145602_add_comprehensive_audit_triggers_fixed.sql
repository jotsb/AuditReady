/*
  # Comprehensive Audit Triggers
  
  ## Overview
  This migration replaces and extends existing audit triggers with full snapshot support
  for all operations across the platform.
  
  ## Changes
  
  ### 1. Updated Receipt Triggers
  - Full before/after snapshots
  - Track all field changes
  
  ### 2. Business Member Triggers
  - Track invitations, removals, role changes
  - Capture member details
  
  ### 3. Category Triggers (expense_categories)
  - Track category CRUD operations
  - Store full category state
  
  ### 4. Business Settings Triggers
  - Enhanced business change tracking
  - Full business object snapshots
  
  ### 5. Invitation Triggers
  - Track team invitations
  
  ### 6. Receipt Approval Triggers
  - Track approval workflow
  
  ### 7. Failed Action Logging
  - Helper functions for permission denials
  - Track unsuccessful operations
  
  ## Security
  - All triggers run with SECURITY DEFINER
  - Captures actor context automatically
  - Cannot be bypassed by users
*/

-- ============================================
-- PART 1: Enhanced Receipt Triggers
-- ============================================

DROP TRIGGER IF EXISTS audit_receipt_insert ON receipts;
DROP TRIGGER IF EXISTS audit_receipt_update ON receipts;
DROP TRIGGER IF EXISTS audit_receipt_delete ON receipts;

CREATE OR REPLACE FUNCTION log_receipt_insert_enhanced()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_audit_event(
    'create_receipt',
    'receipt',
    NEW.id,
    jsonb_build_object(
      'vendor_name', NEW.vendor_name,
      'total_amount', NEW.total_amount,
      'collection_id', NEW.collection_id,
      'category', NEW.category
    ),
    NULL, -- no before state
    to_jsonb(NEW), -- full after state
    'success',
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_receipt_update_enhanced()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_audit_event(
    'update_receipt',
    'receipt',
    NEW.id,
    jsonb_build_object('collection_id', NEW.collection_id),
    to_jsonb(OLD), -- full before state
    to_jsonb(NEW), -- full after state
    'success',
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION log_receipt_delete_enhanced()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM log_audit_event(
    'delete_receipt',
    'receipt',
    OLD.id,
    jsonb_build_object(
      'vendor_name', OLD.vendor_name,
      'total_amount', OLD.total_amount,
      'collection_id', OLD.collection_id
    ),
    to_jsonb(OLD), -- full before state
    NULL, -- no after state
    'success',
    NULL
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_receipt_insert
  AFTER INSERT ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION log_receipt_insert_enhanced();

CREATE TRIGGER audit_receipt_update
  AFTER UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION log_receipt_update_enhanced();

CREATE TRIGGER audit_receipt_delete
  BEFORE DELETE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION log_receipt_delete_enhanced();

-- ============================================
-- PART 2: Business Member Triggers
-- ============================================

CREATE OR REPLACE FUNCTION log_business_member_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'add_team_member',
      'business_member',
      NEW.id,
      jsonb_build_object(
        'business_id', NEW.business_id,
        'user_id', NEW.user_id,
        'role', NEW.role
      ),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'update_team_member_role',
      'business_member',
      NEW.id,
      jsonb_build_object(
        'business_id', NEW.business_id,
        'user_id', NEW.user_id,
        'old_role', OLD.role,
        'new_role', NEW.role
      ),
      to_jsonb(OLD),
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'remove_team_member',
      'business_member',
      OLD.id,
      jsonb_build_object(
        'business_id', OLD.business_id,
        'user_id', OLD.user_id,
        'role', OLD.role
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

DROP TRIGGER IF EXISTS audit_business_member_changes ON business_members;
CREATE TRIGGER audit_business_member_changes
  AFTER INSERT OR UPDATE OR DELETE ON business_members
  FOR EACH ROW
  EXECUTE FUNCTION log_business_member_changes();

-- ============================================
-- PART 3: Expense Category Triggers
-- ============================================

CREATE OR REPLACE FUNCTION log_expense_category_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'create_category',
      'expense_category',
      NEW.id,
      jsonb_build_object(
        'name', NEW.name,
        'description', NEW.description
      ),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'update_category',
      'expense_category',
      NEW.id,
      jsonb_build_object(
        'name', NEW.name,
        'description', NEW.description
      ),
      to_jsonb(OLD),
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'delete_category',
      'expense_category',
      OLD.id,
      jsonb_build_object(
        'name', OLD.name,
        'description', OLD.description
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

DROP TRIGGER IF EXISTS audit_expense_category_changes ON expense_categories;
CREATE TRIGGER audit_expense_category_changes
  AFTER INSERT OR UPDATE OR DELETE ON expense_categories
  FOR EACH ROW
  EXECUTE FUNCTION log_expense_category_changes();

-- ============================================
-- PART 4: Enhanced Business Triggers
-- ============================================

DROP TRIGGER IF EXISTS audit_business_changes ON businesses;

CREATE OR REPLACE FUNCTION log_business_changes_enhanced()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'create_business',
      'business',
      NEW.id,
      jsonb_build_object('name', NEW.name),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'update_business',
      'business',
      NEW.id,
      jsonb_build_object('name', NEW.name),
      to_jsonb(OLD),
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_business_changes
  AFTER INSERT OR UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION log_business_changes_enhanced();

-- ============================================
-- PART 5: Enhanced Collection Triggers
-- ============================================

DROP TRIGGER IF EXISTS audit_collection_changes ON collections;

CREATE OR REPLACE FUNCTION log_collection_changes_enhanced()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'create_collection',
      'collection',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'business_id', NEW.business_id),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      'update_collection',
      'collection',
      NEW.id,
      jsonb_build_object('name', NEW.name, 'business_id', NEW.business_id),
      to_jsonb(OLD),
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'delete_collection',
      'collection',
      OLD.id,
      jsonb_build_object('name', OLD.name, 'business_id', OLD.business_id),
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

CREATE TRIGGER audit_collection_changes
  AFTER INSERT OR UPDATE OR DELETE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION log_collection_changes_enhanced();

-- ============================================
-- PART 6: Invitation Triggers
-- ============================================

CREATE OR REPLACE FUNCTION log_invitation_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'send_invitation',
      'invitation',
      NEW.id,
      jsonb_build_object(
        'business_id', NEW.business_id,
        'email', NEW.email,
        'role', NEW.role
      ),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      PERFORM log_audit_event(
        'update_invitation_status',
        'invitation',
        NEW.id,
        jsonb_build_object(
          'business_id', NEW.business_id,
          'email', NEW.email,
          'old_status', OLD.status,
          'new_status', NEW.status
        ),
        to_jsonb(OLD),
        to_jsonb(NEW),
        'success',
        NULL
      );
    END IF;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      'cancel_invitation',
      'invitation',
      OLD.id,
      jsonb_build_object(
        'business_id', OLD.business_id,
        'email', OLD.email,
        'status', OLD.status
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

DROP TRIGGER IF EXISTS audit_invitation_changes ON invitations;
CREATE TRIGGER audit_invitation_changes
  AFTER INSERT OR UPDATE OR DELETE ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION log_invitation_changes();

-- ============================================
-- PART 7: Receipt Approval Triggers
-- ============================================

CREATE OR REPLACE FUNCTION log_receipt_approval_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      'submit_for_approval',
      'receipt_approval',
      NEW.id,
      jsonb_build_object(
        'receipt_id', NEW.receipt_id,
        'status', NEW.status
      ),
      NULL,
      to_jsonb(NEW),
      'success',
      NULL
    );
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      PERFORM log_audit_event(
        CASE NEW.status
          WHEN 'approved' THEN 'approve_receipt'
          WHEN 'rejected' THEN 'reject_receipt'
          ELSE 'update_approval_status'
        END,
        'receipt_approval',
        NEW.id,
        jsonb_build_object(
          'receipt_id', NEW.receipt_id,
          'old_status', OLD.status,
          'new_status', NEW.status,
          'notes', NEW.notes
        ),
        to_jsonb(OLD),
        to_jsonb(NEW),
        'success',
        NULL
      );
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_receipt_approval_changes ON receipt_approvals;
CREATE TRIGGER audit_receipt_approval_changes
  AFTER INSERT OR UPDATE ON receipt_approvals
  FOR EACH ROW
  EXECUTE FUNCTION log_receipt_approval_changes();

-- ============================================
-- PART 8: Failed Action Logging Helpers
-- ============================================

-- Function to log permission denial
CREATE OR REPLACE FUNCTION log_permission_denied(
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_reason text
)
RETURNS uuid AS $$
BEGIN
  RETURN log_audit_event(
    p_action,
    p_resource_type,
    p_resource_id,
    jsonb_build_object('denial_reason', p_reason),
    NULL,
    NULL,
    'denied',
    p_reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log failed operations
CREATE OR REPLACE FUNCTION log_failed_operation(
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_error_message text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid AS $$
BEGIN
  RETURN log_audit_event(
    p_action,
    p_resource_type,
    p_resource_id,
    p_details,
    NULL,
    NULL,
    'failure',
    p_error_message
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
