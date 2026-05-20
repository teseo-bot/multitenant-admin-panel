import { LucideIcon } from 'lucide-react';

export interface MenuItem {
  name: string;
  icon: LucideIcon;
  href?: string; // Optional if it only contains subMenus
  subPaths?: string[];
  subMenus?: SubMenuItem[];
  open?: boolean;
  allowedRoles?: string[];
  comingSoon?: boolean;
}

export interface SubMenuItem {
  name: string;
  href: string;
  icon?: LucideIcon;
  allowedRoles?: string[];
  comingSoon?: boolean;
}
