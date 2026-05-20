"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export function NuevoLeadModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    // Obtener tenant dummy (o el activo)
    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
    
    const { error } = await supabase.from('leads').insert({
      tenant_id: tenant?.id,
      name: `${formData.get("first_name")} ${formData.get("last_name")}`.trim(),
      company: formData.get("company") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      status: 'New',
      source: 'manual'
    });

    setLoading(false);
    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success("Lead creado exitosamente.");
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <div className="inline-block">{children}</div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo Lead</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nombre</Label><Input name="first_name" required placeholder="Ej. Carlos" /></div>
            <div className="space-y-2"><Label>Apellidos</Label><Input name="last_name" placeholder="Ej. Ruiz" /></div>
          </div>
          <div className="space-y-2"><Label>Empresa</Label><Input name="company" placeholder="Empresa (Opcional)" /></div>
          <div className="space-y-2"><Label>Correo Electrónico</Label><Input name="email" type="email" placeholder="correo@empresa.com" /></div>
          <div className="space-y-2"><Label>Teléfono</Label><Input name="phone" required placeholder="+52 55..." /></div>
          <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar Lead"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NuevoContactoModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();

    const { error } = await supabase.from('contacts').insert({
      tenant_id: tenant?.id,
      name: formData.get("name") as string,
      position: formData.get("position") as string,
      phone: formData.get("phone") as string,
    });

    setLoading(false);
    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success("Contacto creado exitosamente.");
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <div className="inline-block">{children}</div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo Contacto</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label>Nombre del Contacto</Label><Input name="name" required placeholder="Juan Pérez" /></div>
          <div className="space-y-2"><Label>Puesto</Label><Input name="position" placeholder="Gerente de TI" /></div>
          <div className="space-y-2"><Label>Teléfono Directo</Label><Input name="phone" required placeholder="+52 55..." /></div>
          <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar Contacto"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NuevaTareaModal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();

    const { error } = await supabase.from('tasks').insert({
      tenant_id: tenant?.id,
      title: formData.get("title") as string,
      due_date: formData.get("due_date") as string,
      notes: formData.get("notes") as string,
    });

    setLoading(false);
    if (error) {
      toast.error("Error: " + error.message);
    } else {
      toast.success("Tarea asignada exitosamente.");
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <div className="inline-block">{children}</div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva Tarea</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label>Título de la Tarea</Label><Input name="title" required placeholder="Llamada de seguimiento" /></div>
          <div className="space-y-2"><Label>Fecha de Vencimiento</Label><Input name="due_date" type="date" required /></div>
          <div className="space-y-2"><Label>Notas</Label><Input name="notes" placeholder="Discutir presupuesto..." /></div>
          <DialogFooter><Button type="submit" disabled={loading}>{loading ? "Guardando..." : "Crear Tarea"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
