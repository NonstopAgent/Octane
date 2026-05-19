"use client";

import { ThemeProvider } from "next-themes";

import { ErrorBoundary } from "@/components/error-boundary";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </ThemeProvider>
  );
}
