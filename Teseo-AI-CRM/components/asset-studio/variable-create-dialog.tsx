"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSaveVariable } from "@/hooks/mutations/use-save-variable";
import { VariableType } from "@/types/variable";

interface FormValues {
  key: string;
  label: string;
  type: VariableType;
  defaultValue?: string;
  required: boolean;
  description?: string;
}

export function VariableCreateDialog() {
  const [open, setOpen] = useState(false);
  const { mutate: createVariable, isPending } = useSaveVariable();

  const { register, handleSubmit, setValue, watch, reset } = useForm<FormValues>({
    defaultValues: {
      key: "",
      label: "",
      type: "text",
      defaultValue: "",
      required: false,
      description: "",
    },
  });

  const typeValue = watch("type");
  const requiredValue = watch("required");

  const onSubmit = (data: FormValues) => {
    // validation
    if (!data.key.match(/^[a-zA-Z0-9_]+$/)) {
      toast.error("El Key solo puede contener letras, números y guiones bajos (_).");
      return;
    }
    if (!data.label) {
      toast.error("La etiqueta es requerida.");
      return;
    }

    if (data.defaultValue === "") {
      data.defaultValue = undefined;
    }

    createVariable(data, {
      onSuccess: () => {
        toast.success("Variable creada exitosamente.");
        setOpen(false);
        reset();
      },
      onError: (err) => {
        toast.error(`Error al crear: ${err.message}`);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="h-4 w-4" />
        Nueva Variable
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Añadir Variable Dinámica</DialogTitle>
          <DialogDescription>
            Crea una nueva llave que podrá ser inyectada en los Prompts del Tenant usando {'{{key}}'}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Key (snake_case)</label>
              <Input placeholder="company_name" {...register("key")} />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Etiqueta (UI)</label>
              <Input placeholder="Nombre de Empresa" {...register("label")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Dato</label>
              <Select value={typeValue} onValueChange={(val) => setValue("type", val as VariableType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto (Text)</SelectItem>
                  <SelectItem value="number">Número (Number)</SelectItem>
                  <SelectItem value="url">Enlace (URL)</SelectItem>
                  <SelectItem value="enum">Lista Cerrada (Enum)</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Valor por Defecto</label>
              <Input placeholder="(Opcional)" {...register("defaultValue")} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Descripción / Contexto</label>
            <Textarea 
              placeholder="Describe en qué contexto debe usar el agente esta variable..."
              className="resize-none"
              {...register("description")}
            />
          </div>

          <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
            <div className="space-y-0.5">
              <label className="text-base font-medium">Requerida</label>
              <p className="text-[0.8rem] text-muted-foreground">
                Impide que el LangGraph se ejecute si este valor está vacío.
              </p>
            </div>
            <Switch
              checked={requiredValue}
              onCheckedChange={(checked) => setValue("required", checked)}
            />
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Guardando..." : "Crear Variable"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
