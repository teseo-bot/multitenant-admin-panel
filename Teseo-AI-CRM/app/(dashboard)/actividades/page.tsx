"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, Clock, PhoneCall, Mail, UserCircle, Plus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type Activity = {
  id: string;
  title: string;
  type: "call" | "email" | "meeting" | "task" | "handoff";
  status: "pending" | "completed" | "overdue";
  time: string;
  priority: "high" | "normal";
  related_to: string;
};

export default function ActividadesPage() {
  const [tasks, setTasks] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivities() {
      const supabase = createClient();
      
      // 1. Fetch Handoff Requests (Alta prioridad)
      const { data: handoffs } = await supabase
        .from("campaign_events")
        .select("id, payload, occurred_at, lead_id")
        .eq("event_type", "handoff_request")
        .order("occurred_at", { ascending: false })
        .limit(5);

      // 2. Fetch Leads Nuevos o en Contacted (Prioridad normal)
      const { data: activeLeads } = await supabase
        .from("leads")
        .select("id, name, company, created_at, status")
        .in("status", ["New", "Contacted"])
        .order("created_at", { ascending: false })
        .limit(5);

      const newTasks: Activity[] = [];

      if (handoffs) {
        for (const h of handoffs) {
          const payload = typeof h.payload === 'string' ? JSON.parse(h.payload) : h.payload;
          newTasks.push({
            id: h.id,
            title: payload?.reason || "Handoff solicitado por la IA",
            type: "handoff",
            status: "pending",
            time: formatDistanceToNow(new Date(h.occurred_at), { addSuffix: true, locale: es }),
            priority: "high",
            related_to: `Lead ID: ${h.lead_id?.substring(0,8) || "Desconocido"}`
          });
        }
      }

      if (activeLeads) {
        for (const l of activeLeads) {
          newTasks.push({
            id: l.id,
            title: `Dar seguimiento a prospecto (${l.status})`,
            type: "task",
            status: "pending",
            time: formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: es }),
            priority: "normal",
            related_to: l.name + (l.company ? ` (${l.company})` : "")
          });
        }
      }

      setTasks(newTasks);
      setLoading(false);
    }

    fetchActivities();
  }, []);

  const pendingCount = tasks.filter(t => t.status !== "completed").length;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-6 overflow-hidden">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Actividades</h2>
          <p className="text-muted-foreground">Tu agenda diaria y recordatorios (Derivados de Leads y Handoffs).</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" /> Nueva Tarea
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 flex-1 min-h-0">
        
        {/* Sidebar Panel */}
        <div className="col-span-1 space-y-6 overflow-y-auto pr-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CalendarDays className="w-4 h-4" /> Resumen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Pendientes</span>
                <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary">{pendingCount}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Filtros Automáticos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
                <AlertCircle className="w-4 h-4" /> Intervención manual
              </div>
              <div className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors">
                <UserCircle className="w-4 h-4" /> Nuevos Leads
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Task List */}
        <div className="col-span-1 md:col-span-3">
          <Card className="h-full flex flex-col">
            <CardHeader className="border-b pb-4">
              <div className="flex items-center justify-between">
                <CardTitle>Lista de Tareas</CardTitle>
                <div className="text-sm text-muted-foreground">{pendingCount} pendientes</div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <div className="divide-y">
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">Cargando actividades...</div>
                ) : tasks.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No hay actividades pendientes. ¡Buen trabajo!</div>
                ) : (
                  tasks.map((task) => (
                    <div 
                      key={task.id} 
                      className={cn(
                        "p-4 flex items-start gap-4 hover:bg-muted/50 transition-colors group",
                        task.status === "completed" && "opacity-60"
                      )}
                    >
                      <Checkbox className="mt-1" checked={task.status === "completed"} />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("text-sm font-medium", task.status === "completed" && "line-through text-muted-foreground")}>
                            {task.title}
                          </p>
                          {task.priority === "high" && task.status !== "completed" && (
                            <Badge variant="destructive" className="text-[10px] h-4">Alta Prioridad</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            {task.type === "call" && <PhoneCall className="w-3 h-3" />}
                            {task.type === "email" && <Mail className="w-3 h-3" />}
                            {task.type === "meeting" && <UserCircle className="w-3 h-3" />}
                            {task.type === "task" && <Clock className="w-3 h-3" />}
                            {task.type === "handoff" && <AlertCircle className="w-3 h-3 text-amber-500" />}
                            <span className={task.status === "overdue" ? "text-red-500 font-medium" : ""}>{task.time}</span>
                          </div>
                          <div className="flex items-center gap-1 border-l pl-4">
                            <span>{task.related_to}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
