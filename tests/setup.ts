// Cargar variables de entorno locales (DATABASE_URL, etc.) ANTES de que los
// módulos de test importen lib/db (que crea el pool al evaluarse).
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

export const setup = () => {
  const dummyStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
  global.localStorage = dummyStorage as any;
};
setup();
