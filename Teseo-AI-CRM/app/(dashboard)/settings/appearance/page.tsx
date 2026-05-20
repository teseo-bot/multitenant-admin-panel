import { AppearanceForm } from "./AppearanceForm";

export default function AppearancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Apariencia y Tema</h3>
        <p className="text-sm text-muted-foreground">
          Personaliza el aspecto visual del panel. Esta configuración solo afecta a tu dispositivo.
        </p>
      </div>
      
      <AppearanceForm />
    </div>
  );
}
