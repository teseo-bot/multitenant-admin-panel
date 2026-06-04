'use server';

// import { Pool } from 'pg';
// const pool = new Pool({ connectionString: process.env.DATABASE_URL });






// Mock Data
import { SystemModule, AgentRole, PromptVersion, ABExperiment, ABVariant } from "./_promptsTypes";

const mockModules: SystemModule[] = [
  { id: 'mod_crm', name: 'CRM' },
  { id: 'mod_assets', name: 'Assets Studio' },
  { id: 'mod_compliance', name: 'Compliance' },
];

const mockRoles: AgentRole[] = [
  { id: 'role_crm_hunter', name: 'crm_hunter', module_id: 'mod_crm' },
  { id: 'role_crm_closer', name: 'crm_closer', module_id: 'mod_crm' },
  { id: 'role_odoo_mcp', name: 'odoo_mcp_handler', module_id: 'mod_assets' },
];

const mockPrompts: PromptVersion[] = [
  { id: 'pv_1', role_id: 'role_crm_hunter', version: 1, prompt_content: 'You are a CRM Hunter...', is_active: false, created_at: new Date().toISOString() },
  { id: 'pv_2', role_id: 'role_crm_hunter', version: 2, prompt_content: 'You are an aggressive CRM Hunter...', is_active: true, created_at: new Date().toISOString() },
];

const mockExperiments: ABExperiment[] = [
  {
    id: 'exp_1',
    role_id: 'role_crm_hunter',
    name: 'Hunter Tone Test',
    status: 'active',
    variants: [
      { id: 'var_1', experiment_id: 'exp_1', prompt_version_id: 'pv_1', traffic_split: 0.2 },
      { id: 'var_2', experiment_id: 'exp_1', prompt_version_id: 'pv_2', traffic_split: 0.8 }
    ]
  }
];

export async function getSystemModules(): Promise<SystemModule[]> {
  /*
  const query = `SELECT id, name FROM system_modules ORDER BY name ASC;`;
  const res = await pool.query(query);
  return res.rows;
  */
  return Promise.resolve(mockModules);
}

export async function getAgentRoles(moduleId: string): Promise<AgentRole[]> {
  /*
  const query = `SELECT id, name, module_id FROM agent_roles WHERE module_id = $1 ORDER BY name ASC;`;
  const res = await pool.query(query, [moduleId]);
  return res.rows;
  */
  return Promise.resolve(mockRoles.filter(r => r.module_id === moduleId));
}

export async function getPromptVersions(roleId: string): Promise<PromptVersion[]> {
  /*
  const query = `SELECT id, role_id, version, prompt_content, is_active, created_at FROM prompt_versions WHERE role_id = $1 ORDER BY version DESC;`;
  const res = await pool.query(query, [roleId]);
  return res.rows;
  */
  return Promise.resolve(mockPrompts.filter(p => p.role_id === roleId));
}

export async function getABExperiments(roleId: string): Promise<ABExperiment[]> {
  /*
  const expQuery = `SELECT id, role_id, name, status FROM ab_experiments WHERE role_id = $1;`;
  const expRes = await pool.query(expQuery, [roleId]);
  const experiments = expRes.rows;

  for (let exp of experiments) {
    const varQuery = `SELECT id, experiment_id, prompt_version_id, traffic_split FROM ab_variants WHERE experiment_id = $1;`;
    const varRes = await pool.query(varQuery, [exp.id]);
    exp.variants = varRes.rows;
  }
  return experiments;
  */
  return Promise.resolve(mockExperiments.filter(e => e.role_id === roleId));
}
