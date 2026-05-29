import { PromptGallery } from "@/components/asset-studio/prompt-gallery";

export const metadata = {
  title: "Prompts | Asset Studio",
  description: "Gestión de instrucciones maestras para el Motor Agéntico.",
};

export default function PromptsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prompts (Gallery)</h1>
          <p className="text-muted-foreground text-sm">
            Configura y versiona las instrucciones del sistema (Gatekeeper, SDR, Hunter).
          </p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <PromptGallery />
      </div>
    </div>
  );
}
