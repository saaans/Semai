export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      attendances: {
        Row: {
          clock_in_accuracy_m: number | null;
          clock_in_at: string | null;
          clock_in_distance_m: number | null;
          clock_in_lat: number | null;
          clock_in_lng: number | null;
          clock_in_photo_path: string | null;
          clock_out_accuracy_m: number | null;
          clock_out_at: string | null;
          clock_out_distance_m: number | null;
          clock_out_lat: number | null;
          clock_out_lng: number | null;
          clock_out_photo_path: string | null;
          company_id: string;
          corrected_at: string | null;
          corrected_by: string | null;
          correction_reason: string | null;
          created_at: string;
          device_captured_at: string | null;
          early_leave_minutes: number;
          employee_id: string;
          id: string;
          late_minutes: number;
          location_id: string | null;
          mock_location_suspected: boolean;
          overtime_minutes: number;
          photos_deleted_at: string | null;
          scheduled_end: string | null;
          scheduled_start: string | null;
          status: string;
          updated_at: string;
          work_date: string;
        };
        Insert: {
          clock_in_accuracy_m?: number | null;
          clock_in_at?: string | null;
          clock_in_distance_m?: number | null;
          clock_in_lat?: number | null;
          clock_in_lng?: number | null;
          clock_in_photo_path?: string | null;
          clock_out_accuracy_m?: number | null;
          clock_out_at?: string | null;
          clock_out_distance_m?: number | null;
          clock_out_lat?: number | null;
          clock_out_lng?: number | null;
          clock_out_photo_path?: string | null;
          company_id: string;
          corrected_at?: string | null;
          corrected_by?: string | null;
          correction_reason?: string | null;
          created_at?: string;
          device_captured_at?: string | null;
          early_leave_minutes?: number;
          employee_id: string;
          id?: string;
          late_minutes?: number;
          location_id?: string | null;
          mock_location_suspected?: boolean;
          overtime_minutes?: number;
          photos_deleted_at?: string | null;
          scheduled_end?: string | null;
          scheduled_start?: string | null;
          status?: string;
          updated_at?: string;
          work_date: string;
        };
        Update: {
          clock_in_accuracy_m?: number | null;
          clock_in_at?: string | null;
          clock_in_distance_m?: number | null;
          clock_in_lat?: number | null;
          clock_in_lng?: number | null;
          clock_in_photo_path?: string | null;
          clock_out_accuracy_m?: number | null;
          clock_out_at?: string | null;
          clock_out_distance_m?: number | null;
          clock_out_lat?: number | null;
          clock_out_lng?: number | null;
          clock_out_photo_path?: string | null;
          company_id?: string;
          corrected_at?: string | null;
          corrected_by?: string | null;
          correction_reason?: string | null;
          created_at?: string;
          device_captured_at?: string | null;
          early_leave_minutes?: number;
          employee_id?: string;
          id?: string;
          late_minutes?: number;
          location_id?: string | null;
          mock_location_suspected?: boolean;
          overtime_minutes?: number;
          photos_deleted_at?: string | null;
          scheduled_end?: string | null;
          scheduled_start?: string | null;
          status?: string;
          updated_at?: string;
          work_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendances_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendances_employee_id_company_id_fkey";
            columns: ["employee_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "attendances_location_id_company_id_fkey";
            columns: ["location_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_role: string;
          actor_user_id: string | null;
          after: Json | null;
          before: Json | null;
          company_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_table: string | null;
          id: number;
          reason: string | null;
        };
        Insert: {
          action: string;
          actor_role: string;
          actor_user_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          company_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_table?: string | null;
          id?: never;
          reason?: string | null;
        };
        Update: {
          action?: string;
          actor_role?: string;
          actor_user_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          company_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_table?: string | null;
          id?: never;
          reason?: string | null;
        };
        Relationships: [];
      };
      cash_advances: {
        Row: {
          amount: number;
          balance: number;
          company_id: string;
          created_at: string;
          created_by: string | null;
          employee_id: string;
          given_on: string;
          id: string;
          installment_amount: number;
          note: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          balance: number;
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          employee_id: string;
          given_on?: string;
          id?: string;
          installment_amount: number;
          note?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          balance?: number;
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          employee_id?: string;
          given_on?: string;
          id?: string;
          installment_amount?: number;
          note?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cash_advances_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_advances_employee_id_company_id_fkey";
            columns: ["employee_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      companies: {
        Row: {
          archived_at: string | null;
          branch_count: number;
          business_type: string | null;
          city: string | null;
          created_at: string;
          created_by: string | null;
          employee_range: string | null;
          id: string;
          last_active_at: string | null;
          name: string | null;
          onboarding: NonNullable<Json>;
          onboarding_completed_at: string | null;
          suspended_at: string | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          branch_count?: number;
          business_type?: string | null;
          city?: string | null;
          created_at?: string;
          created_by?: string | null;
          employee_range?: string | null;
          id?: string;
          last_active_at?: string | null;
          name?: string | null;
          onboarding?: NonNullable<Json>;
          onboarding_completed_at?: string | null;
          suspended_at?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          branch_count?: number;
          business_type?: string | null;
          city?: string | null;
          created_at?: string;
          created_by?: string | null;
          employee_range?: string | null;
          id?: string;
          last_active_at?: string | null;
          name?: string | null;
          onboarding?: NonNullable<Json>;
          onboarding_completed_at?: string | null;
          suspended_at?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      company_members: {
        Row: {
          company_id: string;
          created_at: string;
          role: string;
          user_id: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          role: string;
          user_id: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      employees: {
        Row: {
          activated_at: string | null;
          base_salary: number;
          company_id: string;
          created_at: string;
          deactivated_at: string | null;
          full_name: string;
          id: string;
          invite_expires_at: string | null;
          invite_token_hash: string | null;
          joined_on: string | null;
          location_id: string | null;
          phone: string;
          position: string | null;
          status: string;
          updated_at: string;
          user_id: string | null;
          work_schedule_id: string | null;
        };
        Insert: {
          activated_at?: string | null;
          base_salary?: number;
          company_id: string;
          created_at?: string;
          deactivated_at?: string | null;
          full_name: string;
          id?: string;
          invite_expires_at?: string | null;
          invite_token_hash?: string | null;
          joined_on?: string | null;
          location_id?: string | null;
          phone: string;
          position?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
          work_schedule_id?: string | null;
        };
        Update: {
          activated_at?: string | null;
          base_salary?: number;
          company_id?: string;
          created_at?: string;
          deactivated_at?: string | null;
          full_name?: string;
          id?: string;
          invite_expires_at?: string | null;
          invite_token_hash?: string | null;
          joined_on?: string | null;
          location_id?: string | null;
          phone?: string;
          position?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
          work_schedule_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employees_location_id_company_id_fkey";
            columns: ["location_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "employees_work_schedule_id_company_id_fkey";
            columns: ["work_schedule_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "work_schedules";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      invoices: {
        Row: {
          amount: number;
          company_id: string;
          created_at: string;
          due_at: string | null;
          id: string;
          number: string;
          paid_at: string | null;
          payment_method: string | null;
          period_end: string | null;
          period_start: string | null;
          provider: string | null;
          provider_invoice_id: string | null;
          status: string;
          subscription_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount: number;
          company_id: string;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          number: string;
          paid_at?: string | null;
          payment_method?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          provider?: string | null;
          provider_invoice_id?: string | null;
          status?: string;
          subscription_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          company_id?: string;
          created_at?: string;
          due_at?: string | null;
          id?: string;
          number?: string;
          paid_at?: string | null;
          payment_method?: string | null;
          period_end?: string | null;
          period_start?: string | null;
          provider?: string | null;
          provider_invoice_id?: string | null;
          status?: string;
          subscription_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_subscription_id_company_id_fkey";
            columns: ["subscription_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      locations: {
        Row: {
          address: string | null;
          company_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          latitude: number;
          longitude: number;
          name: string;
          radius_m: number;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          company_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          latitude: number;
          longitude: number;
          name: string;
          radius_m?: number;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          company_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          latitude?: number;
          longitude?: number;
          name?: string;
          radius_m?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "locations_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      payroll_rules: {
        Row: {
          amount: number | null;
          calc: string;
          company_id: string;
          created_at: string;
          employee_id: string | null;
          id: string;
          is_active: boolean;
          kind: string;
          name: string;
          trigger_event: string | null;
          updated_at: string;
        };
        Insert: {
          amount?: number | null;
          calc: string;
          company_id: string;
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          is_active?: boolean;
          kind: string;
          name: string;
          trigger_event?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number | null;
          calc?: string;
          company_id?: string;
          created_at?: string;
          employee_id?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: string;
          name?: string;
          trigger_event?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_rules_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payroll_rules_employee_id_company_id_fkey";
            columns: ["employee_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      payroll_runs: {
        Row: {
          company_id: string;
          created_at: string;
          created_by: string | null;
          employee_count: number;
          id: string;
          locked_at: string | null;
          locked_by: string | null;
          period_end: string;
          period_start: string;
          status: string;
          total_deductions: number;
          total_gross: number;
          total_net: number;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          created_at?: string;
          created_by?: string | null;
          employee_count?: number;
          id?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          period_end: string;
          period_start: string;
          status?: string;
          total_deductions?: number;
          total_gross?: number;
          total_net?: number;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          created_at?: string;
          created_by?: string | null;
          employee_count?: number;
          id?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          period_end?: string;
          period_start?: string;
          status?: string;
          total_deductions?: number;
          total_gross?: number;
          total_net?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payroll_runs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      payslips: {
        Row: {
          adjustment: number;
          attendance_summary: NonNullable<Json>;
          base_salary: number;
          cash_advance_deduction: number;
          company_id: string;
          created_at: string;
          employee_id: string;
          id: string;
          lines: NonNullable<Json>;
          net_pay: number;
          payroll_run_id: string;
          pdf_path: string | null;
          total_allowances: number;
          total_deductions: number;
          total_overtime: number;
          updated_at: string;
          wa_sent_at: string | null;
        };
        Insert: {
          adjustment?: number;
          attendance_summary?: NonNullable<Json>;
          base_salary?: number;
          cash_advance_deduction?: number;
          company_id: string;
          created_at?: string;
          employee_id: string;
          id?: string;
          lines?: NonNullable<Json>;
          net_pay?: number;
          payroll_run_id: string;
          pdf_path?: string | null;
          total_allowances?: number;
          total_deductions?: number;
          total_overtime?: number;
          updated_at?: string;
          wa_sent_at?: string | null;
        };
        Update: {
          adjustment?: number;
          attendance_summary?: NonNullable<Json>;
          base_salary?: number;
          cash_advance_deduction?: number;
          company_id?: string;
          created_at?: string;
          employee_id?: string;
          id?: string;
          lines?: NonNullable<Json>;
          net_pay?: number;
          payroll_run_id?: string;
          pdf_path?: string | null;
          total_allowances?: number;
          total_deductions?: number;
          total_overtime?: number;
          updated_at?: string;
          wa_sent_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payslips_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payslips_employee_id_company_id_fkey";
            columns: ["employee_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id", "company_id"];
          },
          {
            foreignKeyName: "payslips_payroll_run_id_company_id_fkey";
            columns: ["payroll_run_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "payroll_runs";
            referencedColumns: ["id", "company_id"];
          },
        ];
      };
      plan_features: {
        Row: {
          enabled: boolean;
          feature_key: string;
          level: string;
          limit_value: number | null;
        };
        Insert: {
          enabled?: boolean;
          feature_key: string;
          level: string;
          limit_value?: number | null;
        };
        Update: {
          enabled?: boolean;
          feature_key?: string;
          level?: string;
          limit_value?: number | null;
        };
        Relationships: [];
      };
      plans: {
        Row: {
          code: string;
          created_at: string;
          is_active: boolean;
          level: string;
          max_employees: number | null;
          min_employees: number;
          name: string;
          price_monthly: number | null;
          price_yearly: number | null;
          sort_order: number;
          tier: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          is_active?: boolean;
          level: string;
          max_employees?: number | null;
          min_employees: number;
          name: string;
          price_monthly?: number | null;
          price_yearly?: number | null;
          sort_order: number;
          tier: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          is_active?: boolean;
          level?: string;
          max_employees?: number | null;
          min_employees?: number;
          name?: string;
          price_monthly?: number | null;
          price_yearly?: number | null;
          sort_order?: number;
          tier?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          is_platform_admin: boolean;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          is_platform_admin?: boolean;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          is_platform_admin?: boolean;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          billing_cycle: string;
          cancel_at_period_end: boolean;
          company_id: string;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          plan_code: string;
          price_override: number | null;
          provider: string | null;
          provider_ref: string | null;
          status: string;
          trial_ends_at: string | null;
          updated_at: string;
        };
        Insert: {
          billing_cycle?: string;
          cancel_at_period_end?: boolean;
          company_id: string;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          plan_code: string;
          price_override?: number | null;
          provider?: string | null;
          provider_ref?: string | null;
          status: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          billing_cycle?: string;
          cancel_at_period_end?: boolean;
          company_id?: string;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          plan_code?: string;
          price_override?: number | null;
          provider?: string | null;
          provider_ref?: string | null;
          status?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_code_fkey";
            columns: ["plan_code"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["code"];
          },
        ];
      };
      support_access_grants: {
        Row: {
          company_id: string;
          created_at: string;
          expires_at: string;
          granted_by: string;
          id: string;
          reason: string;
          revoked_at: string | null;
          scope: string[];
        };
        Insert: {
          company_id: string;
          created_at?: string;
          expires_at?: string;
          granted_by?: string;
          id?: string;
          reason: string;
          revoked_at?: string | null;
          scope: string[];
        };
        Update: {
          company_id?: string;
          created_at?: string;
          expires_at?: string;
          granted_by?: string;
          id?: string;
          reason?: string;
          revoked_at?: string | null;
          scope?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "support_access_grants_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      work_schedules: {
        Row: {
          company_id: string;
          created_at: string;
          early_leave_tolerance_min: number;
          end_time: string;
          id: string;
          is_default: boolean;
          late_tolerance_min: number;
          name: string;
          start_time: string;
          updated_at: string;
          work_days: number[];
        };
        Insert: {
          company_id: string;
          created_at?: string;
          early_leave_tolerance_min?: number;
          end_time: string;
          id?: string;
          is_default?: boolean;
          late_tolerance_min?: number;
          name: string;
          start_time: string;
          updated_at?: string;
          work_days?: number[];
        };
        Update: {
          company_id?: string;
          created_at?: string;
          early_leave_tolerance_min?: number;
          end_time?: string;
          id?: string;
          is_default?: boolean;
          late_tolerance_min?: number;
          name?: string;
          start_time?: string;
          updated_at?: string;
          work_days?: number[];
        };
        Relationships: [
          {
            foreignKeyName: "work_schedules_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      company_level: { Args: { p_company_id: string }; Returns: string };
      ensure_owner_company: { Args: Record<PropertyKey, never>; Returns: string };
      has_feature: {
        Args: { p_company_id: string; p_feature_key: string };
        Returns: boolean;
      };
      has_support_access: {
        Args: { p_company_id: string; p_scope: string };
        Returns: boolean;
      };
      is_company_employee: { Args: { p_company_id: string }; Returns: boolean };
      is_company_member: { Args: { p_company_id: string }; Returns: boolean };
      is_company_owner: { Args: { p_company_id: string }; Returns: boolean };
      is_payroll_run_locked: {
        Args: { p_payroll_run_id: string };
        Returns: boolean;
      };
      is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      log_audit: {
        Args: {
          p_action: string;
          p_actor_role: string;
          p_after: Json;
          p_before: Json;
          p_company_id: string;
          p_entity_id: string;
          p_entity_table: string;
          p_reason: string;
        };
        Returns: number;
      };
      my_employee_ids: { Args: Record<PropertyKey, never>; Returns: string[] };
      plan_limit: {
        Args: { p_company_id: string; p_limit_key: string };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
