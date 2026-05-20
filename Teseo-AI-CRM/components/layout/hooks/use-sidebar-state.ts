"use client";

import { useState, useEffect } from "react";

export function useSidebarState(initialState: boolean = true) {
  const [expanded, setExpanded] = useState<boolean>(initialState);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedState = localStorage.getItem("mission-control:sidebar-expanded");
    if (storedState !== null) {
      setExpanded(storedState === "true");
    }
  }, []);

  const toggleSidebar = () => {
    const newState = !expanded;
    setExpanded(newState);
    if (isMounted) {
      localStorage.setItem("mission-control:sidebar-expanded", String(newState));
    }
  };

  return { expanded, toggleSidebar, isMounted };
}