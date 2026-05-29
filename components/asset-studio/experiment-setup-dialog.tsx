"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PromptTemplate } from "@/types/prompt";

interface ExperimentSetupDialogProps {
  prompt: PromptTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartExperiment: (config: { name: string; trafficPct: number; minImpressions: number }) => Promise<void>;
}

export function ExperimentSetupDialog({ prompt, open, onOpenChange, onStartExperiment }: ExperimentSetupDialogProps) {
  const [name, setName] = useState(`A/B Test - ${prompt.name}`);
  const [trafficPct, setTrafficPct] = useState(50);
  const [minImpressions, setMinImpressions] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const handleStart = async () => {
    try {
      setIsLoading(true);
      await onStartExperiment({ name, trafficPct, minImpressions });
      toast.success("Experiment started", {
        description: `Traffic split set to ${trafficPct}%`,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error("Error starting experiment", {
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setup A/B Experiment</DialogTitle>
          <DialogDescription>
            Test your current draft against the active version.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Experiment Name</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g. Test new greeting"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="traffic">Traffic Allocation to Variant (%)</Label>
            <Input 
              id="traffic" 
              type="number" 
              min="1" 
              max="99" 
              value={trafficPct} 
              onChange={(e) => setTrafficPct(Number(e.target.value))} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="impressions">Min Impressions for Significance</Label>
            <Input 
              id="impressions" 
              type="number" 
              min="10" 
              value={minImpressions} 
              onChange={(e) => setMinImpressions(Number(e.target.value))} 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={isLoading}>
            {isLoading ? "Starting..." : "Start Experiment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
