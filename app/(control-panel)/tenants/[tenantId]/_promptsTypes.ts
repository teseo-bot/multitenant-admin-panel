export interface SystemModule {
  id: string;
  name: string;
}
export interface AgentRole {
  id: string;
  name: string;
  module_id: string;
}
export interface PromptVersion {
  id: string;
  role_id: string;
  version: number;
  prompt_content: string;
  is_active: boolean;
  created_at: string;
}
export interface ABVariant {
  id: string;
  experiment_id: string;
  prompt_version_id: string;
  traffic_split: number;
}
export interface ABExperiment {
  id: string;
  role_id: string;
  name: string;
  status: 'active' | 'inactive';
  variants: ABVariant[];
}
