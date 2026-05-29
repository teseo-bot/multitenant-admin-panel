export type VariableType = 'text' | 'url' | 'number' | 'enum' | 'json';

export interface VariableDef {
  id: string;
  tenantId: string;
  key: string;
  label: string;
  type: VariableType;
  defaultValue: string | null;
  enumOptions: string[] | null;
  required: boolean;
  description: string | null;
  createdAt: string;
}
