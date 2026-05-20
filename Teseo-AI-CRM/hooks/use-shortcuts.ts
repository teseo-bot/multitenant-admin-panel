"use client";

import { useEffect } from 'react';
import { useCommandCenterStore } from '@/stores/command-center-store';

export function useShortcuts() {
  const { setActiveTab } = useCommandCenterStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === 'k') {
          e.preventDefault();
          setActiveTab('kanban');
        } else if (e.key.toLowerCase() === 'i') {
          e.preventDefault();
          setActiveTab('inbox');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab]);
}
