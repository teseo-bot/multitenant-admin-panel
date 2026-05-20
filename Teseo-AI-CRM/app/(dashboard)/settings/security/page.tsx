import { SecurityForm } from "./SecurityForm";

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-red-500">Seguridad</h3>
        <p className="text-sm text-muted-foreground">
          Gestión de credenciales y acceso a tu cuenta.
        </p>
      </div>
      
      <SecurityForm />
    </div>
  );
}
