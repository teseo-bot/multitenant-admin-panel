"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePromptTemplates } from "@/hooks/queries/use-prompt-templates";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { PromptCard } from "./prompt-card";
import { PromptCreateDialog } from "./prompt-create-dialog";
import { EmptyState } from "./empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquareText, Search, Plus } from "lucide-react";
import { AgentRole, PromptTemplate } from "@/types/prompt";

export function PromptGallery() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: templates, isLoading } = usePromptTemplates();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<AgentRole | "all">("all");

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; role: AgentRole; description: string }) => {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create template");
      return res.json() as Promise<PromptTemplate>;
    },
    onSuccess: (newTemplate) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.all });
      router.push(`/asset-studio/prompts/${newTemplate.id}`);
    },
  });

  const filteredTemplates = templates?.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesRole = roleFilter === "all" || t.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search prompts..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={roleFilter} onValueChange={(val) => setRoleFilter(val as AgentRole | "all")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="sdr">SDR</SelectItem>
              <SelectItem value="gatekeeper">Gatekeeper</SelectItem>
              <SelectItem value="hunter">Hunter</SelectItem>
              <SelectItem value="l1_support">L1 Support</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {!templates || templates.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="No prompts yet"
          description="Create your first prompt template to start managing different versions and running A/B tests."
          action={{ label: "Create Template", onClick: () => setCreateDialogOpen(true) }}
        />
      ) : filteredTemplates?.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No prompts match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTemplates?.map((template) => (
            <PromptCard
              key={template.id}
              template={template}
              onClick={() => router.push(`/asset-studio/prompts/${template.id}`)}
            />
          ))}
        </div>
      )}

      <PromptCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={(data) => createMutation.mutate(data)}
      />
    </div>
  );
}
