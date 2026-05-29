import { redirect } from "next/navigation";

export default function SettingsIndex() {
  // Redirigir la ruta base a la primera pestaña (Perfil)
  redirect("/settings/profile");
}
