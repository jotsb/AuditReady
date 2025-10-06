export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          phone_number: string | null;
          mfa_method: 'authenticator' | 'sms';
          mfa_enabled: boolean;
          trusted_devices: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email?: string | null;
          phone_number?: string | null;
          mfa_method?: 'authenticator' | 'sms';
          mfa_enabled?: boolean;
          trusted_devices?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string | null;
          phone_number?: string | null;
          mfa_method?: 'authenticator' | 'sms';
          mfa_enabled?: boolean;
          trusted_devices?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      businesses: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          tax_id: string | null;
          currency: string;
          require_approval_workflow: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          tax_id?: string | null;
          currency?: string;
          require_approval_workflow?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          tax_id?: string | null;
          currency?: string;
          require_approval_workflow?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      collections: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          description: string | null;
          year: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string | null;
          year: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          description?: string | null;
          year?: number;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      collection_members: {
        Row: {
          id: string;
          collection_id: string;
          user_id: string;
          role: 'admin' | 'submitter' | 'viewer';
          invited_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          user_id: string;
          role?: 'admin' | 'submitter' | 'viewer';
          invited_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string;
          user_id?: string;
          role?: 'admin' | 'submitter' | 'viewer';
          invited_by?: string;
          created_at?: string;
        };
      };
      receipts: {
        Row: {
          id: string;
          collection_id: string;
          uploaded_by: string;
          vendor_name: string | null;
          vendor_address: string | null;
          transaction_date: string | null;
          subtotal: number | null;
          gst_amount: number;
          pst_amount: number;
          total_amount: number;
          payment_method: string | null;
          category: string | null;
          notes: string | null;
          file_path: string | null;
          file_type: string | null;
          extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
          extraction_data: Json | null;
          is_edited: boolean;
          requires_approval: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          collection_id: string;
          uploaded_by: string;
          vendor_name?: string | null;
          vendor_address?: string | null;
          transaction_date?: string | null;
          subtotal?: number | null;
          gst_amount?: number;
          pst_amount?: number;
          total_amount: number;
          payment_method?: string | null;
          category?: string | null;
          notes?: string | null;
          file_path?: string | null;
          file_type?: string | null;
          extraction_status?: 'pending' | 'processing' | 'completed' | 'failed';
          extraction_data?: Json | null;
          is_edited?: boolean;
          requires_approval?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          collection_id?: string;
          uploaded_by?: string;
          vendor_name?: string | null;
          vendor_address?: string | null;
          transaction_date?: string | null;
          subtotal?: number | null;
          gst_amount?: number;
          pst_amount?: number;
          total_amount?: number;
          payment_method?: string | null;
          category?: string | null;
          notes?: string | null;
          file_path?: string | null;
          file_type?: string | null;
          extraction_status?: 'pending' | 'processing' | 'completed' | 'failed';
          extraction_data?: Json | null;
          is_edited?: boolean;
          requires_approval?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          resource_type?: string;
          resource_id?: string | null;
          details?: Json;
          created_at?: string;
        };
      };
      expense_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          icon: string | null;
          color: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          icon?: string | null;
          color?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          icon?: string | null;
          color?: string | null;
          sort_order?: number;
        };
      };
      system_roles: {
        Row: {
          id: string;
          user_id: string;
          role: 'admin' | 'technical_support';
          granted_by: string | null;
          granted_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: 'admin' | 'technical_support';
          granted_by?: string | null;
          granted_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: 'admin' | 'technical_support';
          granted_by?: string | null;
          granted_at?: string;
          created_at?: string;
        };
      };
      business_members: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          role: 'owner' | 'manager' | 'member';
          invited_by: string | null;
          joined_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id: string;
          role?: 'owner' | 'manager' | 'member';
          invited_by?: string | null;
          joined_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string;
          role?: 'owner' | 'manager' | 'member';
          invited_by?: string | null;
          joined_at?: string;
          created_at?: string;
        };
      };
      invitations: {
        Row: {
          id: string;
          business_id: string;
          email: string;
          role: 'owner' | 'manager' | 'member';
          invited_by: string;
          token: string;
          status: 'pending' | 'accepted' | 'rejected' | 'expired';
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          email: string;
          role?: 'owner' | 'manager' | 'member';
          invited_by: string;
          token?: string;
          status?: 'pending' | 'accepted' | 'rejected' | 'expired';
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          email?: string;
          role?: 'owner' | 'manager' | 'member';
          invited_by?: string;
          token?: string;
          status?: 'pending' | 'accepted' | 'rejected' | 'expired';
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
      };
      receipt_approvals: {
        Row: {
          id: string;
          receipt_id: string;
          status: 'pending' | 'approved' | 'rejected';
          submitted_by: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          receipt_id: string;
          status?: 'pending' | 'approved' | 'rejected';
          submitted_by: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          receipt_id?: string;
          status?: 'pending' | 'approved' | 'rejected';
          submitted_by?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
