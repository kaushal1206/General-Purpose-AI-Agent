export type CapabilityCategory =
  | 'ai_model'
  | 'computation'
  | 'filesystem'
  | 'documents'
  | 'structured_data'
  | 'web_search'
  | 'email'
  | 'crm'
  | 'memory';

export interface CapabilityStatus {
  id: string;
  name: string;
  category: CapabilityCategory;
  implemented: boolean;
  configured: boolean;
  credentialsAvailable: boolean;
  providerReachable: boolean;
  lastHealthCheckSuccess: boolean;
  lastHealthCheckTime: string;
  errorDetails?: string;
  actionsPermitted: string[];
  limits?: Record<string, any>;
  setupInstructions: string;
  alternatives?: string[];
}

export interface CapabilityCheckResult {
  available: boolean;
  capability: CapabilityStatus;
  reason?: string;
}
