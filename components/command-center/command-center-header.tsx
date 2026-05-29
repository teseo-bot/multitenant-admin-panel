"use client";

import React from 'react';

export function CommandCenterHeader() {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
      <h1 className="text-xl font-semibold tracking-tight">Command Center</h1>
      <div className="flex items-center space-x-2">
        {/* El contador hardcodeado fue eliminado. 
            TODO: Conectar a useLeads() para conteo dinámico en el próximo sprint. */}
      </div>
    </div>
  );
}
