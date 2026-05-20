"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SaveIcon, UploadCloudIcon } from "lucide-react";

const profileSchema = z.object({
  fullName: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(50),
  email: z.string().email(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileForm({ initialData }: { initialData: { id: string; fullName: string; email: string; avatarUrl: string } }) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(initialData.avatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const supabase = createClient();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: initialData.fullName,
      email: initialData.email,
    },
  });

  const getInitials = (name: string) => {
    if (!name) return "US";
    return name.substring(0, 2).toUpperCase();
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error("Debes seleccionar una imagen para subir.");
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${initialData.id}-${Math.random()}.${fileExt}`;

      // Upload to Supabase Storage bucket
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
        
      const newAvatarUrl = data.publicUrl;

      // Update user metadata with the new avatar
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: newAvatarUrl }
      });

      if (updateError) {
        throw updateError;
      }

      setAvatarUrl(newAvatarUrl);
      toast.success("Foto de perfil actualizada.");
      window.location.reload();
    } catch (error: any) {
      toast.error(error.message || "Error al subir la imagen.");
    } finally {
      setUploading(false);
    }
  };

  async function onSubmit(data: ProfileFormValues) {
    try {
      setLoading(true);
      // Supabase metadata update
      const { error } = await supabase.auth.updateUser({
        data: { full_name: data.fullName, name: data.fullName }
      });

      if (error) throw error;
      
      toast.success("Perfil actualizado correctamente");
      window.location.reload(); 
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar el perfil");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-6">
        <Avatar className="h-24 w-24 border">
          <AvatarImage src={avatarUrl} alt="Avatar" className="object-cover" />
          <AvatarFallback className="text-2xl">{getInitials(form.watch("fullName"))}</AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <h4 className="text-sm font-medium leading-none">Foto de Perfil</h4>
          <p className="text-sm text-muted-foreground">Recomendado: 256x256px en PNG o JPG (máx. 2MB).</p>
          <div>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloudIcon className="w-4 h-4 mr-2" />
              {uploading ? "Subiendo..." : "Subir nueva foto"}
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/png, image/jpeg, image/webp" 
              onChange={uploadAvatar} 
            />
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre Completo</FormLabel>
                <FormControl>
                  <Input placeholder="Tu nombre..." {...field} />
                </FormControl>
                <FormDescription>
                  Este es el nombre que verán los demás usuarios de la plataforma.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo Electrónico</FormLabel>
                <FormControl>
                  <Input disabled placeholder="correo@ejemplo.com" {...field} />
                </FormControl>
                <FormDescription>
                  El correo principal asociado a la cuenta. No puede modificarse por seguridad.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={loading}>
            <SaveIcon className="w-4 h-4 mr-2" />
            {loading ? "Guardando..." : "Guardar Perfil"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
