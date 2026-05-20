"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateLeadSchema } from "@/lib/validations/lead";

import { useCommandCenterStore } from "@/stores/command-center-store";
import { useLeadDetail } from "@/hooks/queries/use-lead-detail";
import { useUpdateLead } from "@/hooks/mutations/use-update-lead";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type FormData = z.infer<typeof updateLeadSchema>;

export function LeadDetailsSheet() {
  const { isLeadSheetOpen, setIsLeadSheetOpen, selectedLeadId } = useCommandCenterStore();
  const { data: lead, isLoading } = useLeadDetail(isLeadSheetOpen ? selectedLeadId : null);
  const updateLead = useUpdateLead();

  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting, errors } } = useForm<FormData>({
    resolver: zodResolver(updateLeadSchema as never),
    defaultValues: {
      status: 'New',
      assigned_node: 'unassigned',
      name: '',
      company: '',
      email: '',
      phone: '',
      icp_score: 0,
    }
  });

  useEffect(() => {
    if (lead) {
      reset({
        status: lead.status,
        assigned_node: lead.assigned_node,
        name: lead.name,
        company: lead.company || '',
        email: lead.email || '',
        phone: lead.phone || '',
        icp_score: lead.icp_score || 0,
      });
    }
  }, [lead, reset]);

  const onSubmit = async (data: FormData) => {
    if (!selectedLeadId) return;
    
    // Clean up empty strings for optional fields if necessary, or just send
    try {
      await updateLead.mutateAsync({ leadId: selectedLeadId, data });
      toast.success("Lead updated successfully");
      setIsLeadSheetOpen(false);
    } catch {
      toast.error("Failed to update lead");
    }
  };

  const onOpenChange = (open: boolean) => {
    setIsLeadSheetOpen(open);
  };

  return (
    <Sheet open={isLeadSheetOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Lead Details</SheetTitle>
          <SheetDescription>
            {lead ? `Editing ${lead.name}` : "View and edit lead information."}
          </SheetDescription>
        </SheetHeader>
        
        {isLoading && !lead ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : lead ? (
          <form id="lead-form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <ScrollArea className="flex-1 p-6">
              <div className="flex flex-col gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" {...register("name")} />
                  {errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" {...register("company")} />
                  {errors.company && <span className="text-xs text-destructive">{errors.company.message}</span>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...register("email")} />
                  {errors.email && <span className="text-xs text-destructive">{errors.email.message}</span>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" {...register("phone")} />
                  {errors.phone && <span className="text-xs text-destructive">{errors.phone.message}</span>}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={watch("status")} 
                    onValueChange={(val) => {
                      if (val) setValue("status", val as FormData["status"], { shouldDirty: true });
                    }}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Contacted">Contacted</SelectItem>
                      <SelectItem value="Qualified">Qualified</SelectItem>
                      <SelectItem value="Lost">Lost</SelectItem>
                      <SelectItem value="Won">Won</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="assigned_node">Assigned Node</Label>
                  <Select 
                    value={watch("assigned_node")} 
                    onValueChange={(val) => {
                      if (val) setValue("assigned_node", val as FormData["assigned_node"], { shouldDirty: true });
                    }}
                  >
                    <SelectTrigger id="assigned_node">
                      <SelectValue placeholder="Select node" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      <SelectItem value="gatekeeper">Gatekeeper</SelectItem>
                      <SelectItem value="sdr">SDR</SelectItem>
                      <SelectItem value="hunter">Hunter</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="icp_score">ICP Score (0-100)</Label>
                  <Input 
                    id="icp_score" 
                    type="number" 
                    {...register("icp_score", { valueAsNumber: true })} 
                  />
                  {errors.icp_score && <span className="text-xs text-destructive">{errors.icp_score.message}</span>}
                </div>
              </div>
            </ScrollArea>
            
            <SheetFooter className="px-6 py-4 border-t bg-background">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsLeadSheetOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" form="lead-form" disabled={isSubmitting || !lead}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </SheetFooter>
          </form>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-muted-foreground">
            {selectedLeadId ? "Lead not found." : "No lead selected."}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
