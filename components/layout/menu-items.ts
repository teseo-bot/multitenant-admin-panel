import {
  Users,
  CircleDollarSign,
  MonitorPlay,
  Command
} from "lucide-react";
import { MenuItem } from "./types";
import { UserRole } from "@/types/rbac";

export const crmMenuItems: MenuItem[] = [
  {
    name: "Global Admin",
    icon: Command,
    subMenus: [
      { name: "Users", href: "/admin/users" },
      { name: "Tenants", href: "/tenants" },
    ],
  },
  {
    name: "Uso y Facturación",
    icon: CircleDollarSign,
    href: "/finops",
  }
];
