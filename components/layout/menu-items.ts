import {
  CircleDollarSign,
  Command
} from "lucide-react";
import { MenuItem } from "./types";

// En español y sin jerga interna: «Global Admin» y «Users» describen el rol que
// escribió la pantalla, no la tarea de quien la usa.
export const crmMenuItems: MenuItem[] = [
  {
    name: "Administración",
    icon: Command,
    subMenus: [
      { name: "Usuarios", href: "/admin/users" },
      { name: "Cuentas", href: "/tenants" },
      { name: "Auditoría", href: "/admin/audit" },
      { name: "Aliados", href: "/admin/aliados" },
      { name: "Catálogo de aliados", href: "/admin/catalogo-aliados" },
    ],
  },
  {
    name: "Consumo y facturación",
    icon: CircleDollarSign,
    href: "/finops",
  }
];
