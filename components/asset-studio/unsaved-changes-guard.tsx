"use client";

import { useEffect } from "react";
import { useAssetStudioStore } from "@/stores/asset-studio-store";

/**
 * UnsavedChangesGuard handles preventing the user from closing the tab
 * or reloading when there are unsaved changes.
 * 
 * Note: Next.js App Router currently does not provide a native way to intercept
 * client-side navigation (router events are no longer exposed).
 * For a complete client-side routing guard, we would need to create a custom 
 * <Link> wrapper or use a third-party interception library. 
 * This component currently only catches the native window `beforeunload` event.
 */
export function UnsavedChangesGuard() {
  const { isDirty } = useAssetStudioStore();
  
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  return null;
}
