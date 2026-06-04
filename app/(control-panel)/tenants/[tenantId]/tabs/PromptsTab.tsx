'use client';

import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  getSystemModules,
  getAgentRoles,
  getPromptVersions,
  getABExperiments,
  SystemModule,
  AgentRole,
  PromptVersion,
  ABExperiment
} from '../_promptsActions';

export function PromptsTab({ tenantId }: { tenantId: string }) {
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  
  const [roles, setRoles] = useState<AgentRole[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [experiments, setExperiments] = useState<ABExperiment[]>([]);

  useEffect(() => {
    getSystemModules().then(setModules);
  }, []);

  useEffect(() => {
    if (selectedModule) {
      getAgentRoles(selectedModule).then(setRoles);
      setSelectedRole(null);
      setPrompts([]);
      setExperiments([]);
    }
  }, [selectedModule]);

  useEffect(() => {
    if (selectedRole) {
      getPromptVersions(selectedRole).then(setPrompts);
      getABExperiments(selectedRole).then(setExperiments);
    }
  }, [selectedRole]);

  const activePrompt = prompts.find(p => p.is_active);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dynamic Role Selection</CardTitle>
          <CardDescription>Select a module and a role to configure Prompts & A/B testing.</CardDescription>
        </CardHeader>
        <CardContent className="flex space-x-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Module</label>
            <Select value={selectedModule || undefined} onValueChange={setSelectedModule}>
              <SelectTrigger>
                <SelectValue placeholder="Select Module" />
              </SelectTrigger>
              <SelectContent>
                {modules.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Role</label>
            <Select value={selectedRole || undefined} onValueChange={setSelectedRole} disabled={!selectedModule}>
              <SelectTrigger>
                <SelectValue placeholder="Select Role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedRole && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Prompt Version</CardTitle>
              <CardDescription>
                {activePrompt ? `Version ${activePrompt.version} (Active)` : 'No active prompt found.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea 
                readOnly 
                value={activePrompt?.prompt_content || ''} 
                className="h-64 font-mono text-sm"
                placeholder="Select a role to view its active prompt."
              />
              <Button className="mt-4 w-full">Draft New Version</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>A/B Experiments</CardTitle>
              <CardDescription>Active experiments splitting traffic between prompt versions.</CardDescription>
            </CardHeader>
            <CardContent>
              {experiments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active experiments for this role.</p>
              ) : (
                <div className="space-y-4">
                  {experiments.map(exp => (
                    <div key={exp.id} className="border rounded-md p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold">{exp.name}</span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full uppercase">{exp.status}</span>
                      </div>
                      <div className="space-y-2 mt-4">
                        {exp.variants.map(variant => (
                          <div key={variant.id} className="flex justify-between text-sm items-center">
                            <span>Prompt {variant.prompt_version_id}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-muted-foreground">Split:</span>
                              <span className="font-mono bg-muted px-2 py-1 rounded">{(variant.traffic_split * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button variant="outline" size="sm" className="mt-4 w-full">Edit Allocation</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
