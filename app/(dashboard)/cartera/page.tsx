"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Download, Plus, MoreHorizontal, Mail, Phone, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/utils/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type Contact = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  updated_at: string;
};

export default function CarteraPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContacts() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, company, email, phone, status, updated_at")
        .order("updated_at", { ascending: false });

      if (!error && data) {
        setContacts(data);
      }
      setLoading(false);
    }
    fetchContacts();
  }, []);

  const formatActivity = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
    } catch {
      return "Desconocido";
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cartera (Directorio)</h2>
          <p className="text-muted-foreground">Base de datos de contactos, clientes y oportunidades perdidas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="hidden md:flex">
            <Download className="w-4 h-4 mr-2" /> Exportar CSV
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" /> Nuevo Contacto
          </Button>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-t-0 shadow-sm">
        <CardHeader className="bg-muted/30 border-b pb-4 px-4 py-3 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center flex-1 max-w-sm gap-2">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por nombre, empresa o correo..."
                className="w-full pl-9 bg-background"
              />
            </div>
            <Button variant="outline" size="icon" className="shrink-0" title="Filtros avanzados">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
             <Button variant="secondary" size="sm" className="hidden sm:flex bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-200">
               Nueva Campaña (Retargeting)
             </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 overflow-y-auto flex-1">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
              <TableRow>
                <TableHead>Contacto</TableHead>
                <TableHead className="hidden md:table-cell">Empresa</TableHead>
                <TableHead className="hidden lg:table-cell">Datos de Contacto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden sm:table-cell">Última Actividad</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4">Cargando...</TableCell>
                </TableRow>
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4">No hay contactos.</TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => (
                  <TableRow key={contact.id} className="hover:bg-muted/50 cursor-pointer">
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{contact.name}</span>
                        <span className="text-xs text-muted-foreground md:hidden">{contact.company || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{contact.company || "-"}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {contact.email || "-"}</span>
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {contact.phone || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact.status.toLowerCase() === "won" && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Cliente (Won)</Badge>}
                      {contact.status.toLowerCase() === "lost" && <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">Perdido (Lost)</Badge>}
                      {contact.status.toLowerCase() === "qualified" && <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">En Nutrición (MQL)</Badge>}
                      {["new", "contacted"].includes(contact.status.toLowerCase()) && <Badge variant="secondary">Prospecto</Badge>}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                      {formatActivity(contact.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
