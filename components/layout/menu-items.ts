import {
  CircleDollarSign,
  Command
} from "lucide-react";
import { MenuItem } from "./types";

export const crmMenuItems: MenuItem[] = [
  {
    name: "Global Admin",
    icon: Command,
    subMenus: [
      { name: "Users", href: "/admin/users" },
      { name: "Tenants", href: "/tenants" },
      { name: "Auditoría", href: "/admin/audit" },
      { name: "Catálogo aliados", href: "/admin/catalogo-aliados" },
    ],
  },
  {
    name: "Uso y Facturación",
    icon: CircleDollarSign,
    href: "/finops",
  }
];
