"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Octane Core render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-amber-400">
            <AlertTriangle className="size-5" aria-hidden />
          </div>
          <div className="max-w-md space-y-2">
            <h2 className="text-lg font-medium text-zinc-100">
              Something went wrong
            </h2>
            <p className="text-sm text-zinc-500">
              A render error occurred. Open Settings to clear local data or export a backup.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-zinc-700"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.assign("/settings");
            }}
          >
            <RotateCcw className="size-4" />
            Open Settings
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
