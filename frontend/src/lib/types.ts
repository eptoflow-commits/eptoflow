export type PlanName = 'basic' | 'standard' | 'premium';

export interface User {
  id: string; full_name: string; email: string; phone?: string | null;
  role: string; status: string;
}

export interface Subscription {
  id: string; user_id: string; plan_name: PlanName; amount: string | number;
  start_date: string; end_date: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  isActive?: boolean; daysRemaining?: number;
}

export interface Plan {
  plan: PlanName;
  maxValves: number;
  hasRelay1: boolean;
  hasMoisture: boolean;
  hasVoice: boolean;
  moistureAutomation: boolean;
  allowedOutputs: string[];
  amount?: number;
}

export interface Device {
  id: string; device_uid: string; device_name: string; plan_bound: PlanName;
  status: 'online' | 'offline' | 'disabled';
  last_seen_at?: string | null;
  enabled: boolean;
  firmware_version?: string | null;
}

export interface Command {
  id: string; device_id: string; command_type: string;
  payload: Record<string, any>;
  status: 'pending' | 'delivered' | 'executed' | 'failed' | 'expired';
  source: string;
  created_at: string;
  executed_at?: string | null;
}

export interface Schedule {
  id: string; device_id: string; zone_or_output: string;
  days_of_week: number[]; start_time: string; duration_seconds: number;
  enabled: boolean; last_run_at?: string | null;
}

export interface Notification {
  id: string; user_id: string; title: string; message: string;
  type: string; is_read: boolean; created_at: string;
}
