'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';
import { BrandingConfig } from '../_brandingTypes';
import { BrandingFormValues, brandingFormSchema } from '../schemas';

interface BrandingTabProps {
  tenantId: string;
  initialData: BrandingConfig;
  onSave: (tenantId: string, data: BrandingConfig) => Promise<any>;
}

export function BrandingTab({ tenantId, initialData, onSave }: BrandingTabProps) {
  const form = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingFormSchema),
    defaultValues: initialData,
  });

  async function onSubmit(data: BrandingFormValues) {
    try {
      await onSave(tenantId, data as BrandingConfig);
      toast.success('Branding configurado exitosamente.');
    } catch (error: any) {
      toast.error(error.message || 'Error guardando branding');
    }
  }

  // Handle local file conversion to Base64
  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>, 
    onChange: (value: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("El archivo no debe exceder 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        onChange(reader.result);
        toast.success("Imagen cargada (Base64)");
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-2xl p-4">
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField control={form.control} name="primaryColor" render={({ field }) => (
            <FormItem>
              <FormLabel>Color Primario</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Input type="color" className="w-12 h-10 p-1" {...field} />
                  <Input type="text" placeholder="#007bff" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>

          <FormField control={form.control} name="secondaryColor" render={({ field }) => (
            <FormItem>
              <FormLabel>Color Secundario</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Input type="color" className="w-12 h-10 p-1" {...field} />
                  <Input type="text" placeholder="#6c757d" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>

          <FormField control={form.control} name="accentColor" render={({ field }) => (
            <FormItem>
              <FormLabel>Color Acento</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Input type="color" className="w-12 h-10 p-1" {...field} />
                  <Input type="text" placeholder="#6c757d" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>

          <FormField control={form.control} name="backgroundColor" render={({ field }) => (
            <FormItem>
              <FormLabel>Fondo General</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Input type="color" className="w-12 h-10 p-1" {...field} />
                  <Input type="text" placeholder="#ffffff" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>

          <FormField control={form.control} name="cardBackgroundColor" render={({ field }) => (
            <FormItem>
              <FormLabel>Fondo de Tarjetas/Tablas</FormLabel>
              <FormControl>
                <div className="flex items-center gap-2">
                  <Input type="color" className="w-12 h-10 p-1" {...field} />
                  <Input type="text" placeholder="#ffffff" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}/>

          <FormField control={form.control} name="themeMode" render={({ field }) => (
            <FormItem>
              <FormLabel>Theme Mode</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a theme mode" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}/>
        </div>

        <div className="space-y-6">
          <div className="border-b pb-2">
            <h3 className="text-lg font-medium">Logotipos e Iconos</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Puedes pegar una URL directamente o seleccionar un archivo local (PNG/JPG) para codificarlo e inyectarlo automáticamente en Base64 a la BD.
            </p>
          </div>
          
          <FormField control={form.control} name="logoLightUrl" render={({ field }) => (
            <FormItem>
              <FormLabel>Logo (Light Mode)</FormLabel>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <FormControl>
                  <Input placeholder="https://... o Base64" {...field} className="flex-1" />
                </FormControl>
                <Input 
                  type="file" 
                  accept="image/png, image/jpeg, image/svg+xml" 
                  className="w-full sm:w-auto"
                  onChange={(e) => handleFileChange(e, field.onChange)} 
                />
              </div>
              <FormMessage />
            </FormItem>
          )}/>

          <FormField control={form.control} name="logoDarkUrl" render={({ field }) => (
            <FormItem>
              <FormLabel>Logo (Dark Mode)</FormLabel>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <FormControl>
                  <Input placeholder="https://... o Base64" {...field} className="flex-1" />
                </FormControl>
                <Input 
                  type="file" 
                  accept="image/png, image/jpeg, image/svg+xml" 
                  className="w-full sm:w-auto"
                  onChange={(e) => handleFileChange(e, field.onChange)} 
                />
              </div>
              <FormMessage />
            </FormItem>
          )}/>

          <FormField control={form.control} name="faviconUrl" render={({ field }) => (
            <FormItem>
              <FormLabel>Favicon</FormLabel>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <FormControl>
                  <Input placeholder="https://... o Base64" {...field} className="flex-1" />
                </FormControl>
                <Input 
                  type="file" 
                  accept="image/png, image/jpeg, image/svg+xml" 
                  className="w-full sm:w-auto"
                  onChange={(e) => handleFileChange(e, field.onChange)} 
                />
              </div>
              <FormMessage />
            </FormItem>
          )}/>

          <FormField control={form.control} name="appIconUrl" render={({ field }) => (
            <FormItem>
              <FormLabel>App Icon (Touch)</FormLabel>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <FormControl>
                  <Input placeholder="https://... o Base64" {...field} className="flex-1" />
                </FormControl>
                <Input 
                  type="file" 
                  accept="image/png, image/jpeg, image/svg+xml" 
                  className="w-full sm:w-auto"
                  onChange={(e) => handleFileChange(e, field.onChange)} 
                />
              </div>
              <FormMessage />
            </FormItem>
          )}/>
        </div>

        <Button type="submit">Guardar Branding</Button>
      </form>
    </Form>
  );
}
