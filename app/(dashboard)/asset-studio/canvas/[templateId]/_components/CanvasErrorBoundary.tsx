"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Canvas Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-destructive/10 text-destructive p-6 rounded-lg border border-destructive/20">
          <AlertCircle className="w-12 h-12 mb-4 opacity-80" />
          <h2 className="text-lg font-semibold mb-2">Canvas Rendering Error</h2>
          <p className="text-sm opacity-80 text-center max-w-md">
            {this.state.error?.message || "An unexpected error occurred in the GSAP engine or React tree."}
          </p>
          <button
            className="mt-6 px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90 transition-colors"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
