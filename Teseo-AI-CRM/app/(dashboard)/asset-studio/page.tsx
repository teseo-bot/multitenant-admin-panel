import { redirect } from "next/navigation";

export default function AssetStudioRootPage() {
  // Redirección por defecto a la gestión de Prompts
  redirect("/asset-studio/prompts");
}
