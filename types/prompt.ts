export type AgentRole = 'sdr' | 'gatekeeper' | 'hunter' | 'l1_support';
export type VersionStatus = 'draft' | 'active' | 'testing' | 'archived';

export interface VariableRef {
  key: string;
  label: string;
  type: string;
  required: boolean;
  defaultValue?: string;
}

export interface PromptTemplate {
  id: string;
  tenantId: string;
  role: AgentRole;
  name: string;
  description: string | null;
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface PromptVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  content: string;
  variables: VariableRef[];
  changelog: string | null;
  status: VersionStatus;
  createdBy: string;
  createdAt: string;
}
