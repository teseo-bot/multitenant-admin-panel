import { createClient } from "@/utils/supabase/server";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Perfil de Usuario</h3>
        <p className="text-sm text-muted-foreground">
          Actualiza tu información personal y cómo te ven otros miembros de la organización.
        </p>
      </div>
      
      <ProfileForm 
        initialData={{
          id: user.id,
          fullName: user.user_metadata?.full_name || user.user_metadata?.name || "",
          email: user.email || "",
          avatarUrl: user.user_metadata?.avatar_url || "",
        }} 
      />
    </div>
  );
}
