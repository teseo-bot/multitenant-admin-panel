import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ThemeColors {
  secondary?: string;
  accent?: string;
  background?: string;
  cardBackground?: string;
}

export interface ThemeConfig {
  primaryColor: string;
  /** Nombre de la organización: se muestra bajo la marca en el sidebar. */
  organizacion?: string;
  colors?: ThemeColors;
  logos?: {
    fullUrl?: string;
    collapsedUrl?: string;
  };
  appearance?: {
    radius?: string | number;
    fontFamily?: string;
    themeMode?: 'LIGHT' | 'DARK' | 'SYSTEM';
  };
}

interface TenantState {
  logoUrl: string | null;
  primaryColor: string | null;
  themeConfig: ThemeConfig | null;
  setLogoUrl: (url: string | null) => void;
  setPrimaryColor: (color: string) => void;
  setThemeConfig: (config: ThemeConfig) => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      logoUrl: null,
      // null = el tenant no configuró marca ⇒ manda app/globals.css.
      // Un color aquí se inyecta como <style> y pisa el sistema de diseño.
      primaryColor: null,
      themeConfig: null,
      setLogoUrl: (url) => set({ logoUrl: url }),
      setPrimaryColor: (color) => {
        set({ primaryColor: color });
      },
      setThemeConfig: (config) => {
        set({ themeConfig: config });
        if (config.primaryColor) {
          set({ primaryColor: config.primaryColor });
        }
        if (config.logos?.fullUrl) {
          set({ logoUrl: config.logos.fullUrl });
        }
      }
    }),
    {
      name: 'teseo-tenant-settings',
      // v2: el azul por defecto quedó persistido en el localStorage de cualquiera
      // que haya abierto el panel antes. Sin esta migración, el navegador lo
      // rehidrata y vuelve a pisar la paleta aunque el código ya no lo tenga.
      version: 2,
      migrate: (estado: any) => {
        if (estado?.primaryColor === 'oklch(0.556 0.2 250)') {
          return { ...estado, primaryColor: null };
        }
        return estado;
      },
    }
  )
);
