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
  primaryColor: string;
  themeConfig: ThemeConfig | null;
  setLogoUrl: (url: string | null) => void;
  setPrimaryColor: (color: string) => void;
  setThemeConfig: (config: ThemeConfig) => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      logoUrl: null,
      primaryColor: 'oklch(0.556 0.2 250)', // OKLCH default equivalent to primary blue
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
    }
  )
);
