import {
  Users,
  CircleDollarSign,
  Palette,
  GraduationCap,
  Scale,
  MonitorPlay,
  FlaskConical,
  Command
} from "lucide-react";
import { MenuItem } from "./types";
import { UserRole } from "@/types/rbac";

export const crmMenuItems: MenuItem[] = [
  {
    name: "CRM",
    icon: Command,
    subMenus: [
      { name: "Dashboard", href: "/dashboard" },
      { name: "Inbox (IA Copilot)", href: "/inbox" },
      { name: "Pipeline", href: "/pipeline" },
      { name: "Cartera", href: "/cartera" },
      { name: "Actividades", href: "/actividades" }
    ],
  },
  {
    name: "Asset Studio",
    icon: Palette,
    subMenus: [
      { name: "Materiales & Scripts", href: "/asset-studio" },
    ],
  },
  {
    name: "LMS",
    icon: GraduationCap,
    comingSoon: true,
  },
  {
    name: "Compliance",
    icon: Scale,
    comingSoon: true,
  },
  {
    name: "Content Factory",
    icon: MonitorPlay,
    comingSoon: true,
  },
  {
    name: "R&D Studio",
    icon: FlaskConical,
    comingSoon: true,
  },
  // --- Admin Zone ---
  {
    name: "Uso y Facturación",
    icon: CircleDollarSign,
    href: "/finops",
    allowedRoles: ["owner", "admin"] as UserRole[],
  },
  {
    name: "Control de Acceso",
    icon: Users,
    href: "/tenants",
    allowedRoles: ["owner", "admin"] as UserRole[],
  }
];
