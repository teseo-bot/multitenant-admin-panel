import { ReactNode } from "react";
import Link from "next/link";
import { User, Palette, Shield } from "lucide-react";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-full space-y-6 max-w-5xl mx-auto w-full p-4 md:p-8">
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">Configuración</h2>
        <p className="text-muted-foreground">
          Administra la configuración de tu cuenta y preferencias de interfaz.
        </p>
      </div>
      
      <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <aside className="-mx-4 lg:w-1/5">
          <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1 px-4 lg:px-0">
            <Link 
              href="/settings/profile" 
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted text-muted-foreground hover:text-primary"
            >
              <User className="h-4 w-4" />
              Perfil
            </Link>
            <Link 
              href="/settings/appearance" 
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted text-muted-foreground hover:text-primary"
            >
              <Palette className="h-4 w-4" />
              Apariencia
            </Link>
            <Link 
              href="/settings/security" 
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted text-muted-foreground hover:text-primary"
            >
              <Shield className="h-4 w-4" />
              Seguridad
            </Link>
          </nav>
        </aside>
        
        <div className="flex-1 lg:max-w-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
