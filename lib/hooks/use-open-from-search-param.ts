"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Opens UI when a URL search param matches — including same-route navigation
 * (e.g. /projects → /projects?new=1 from the topbar).
 */
export function useOpenFromSearchParam(
  param: string,
  value: string,
  onOpen: () => void,
  enabled = true,
) {
  const searchParams = useSearchParams();
  const queryKey = searchParams.toString();

  useEffect(() => {
    if (!enabled) return;
    if (searchParams.get(param) === value) onOpen();
  }, [param, value, queryKey, onOpen, enabled, searchParams]);
}

/** Opens when param is present and passes an optional matcher. */
export function useOpenWhenSearchParam(
  param: string,
  matches: (value: string | null) => boolean,
  onOpen: () => void,
  enabled = true,
) {
  const searchParams = useSearchParams();
  const queryKey = searchParams.toString();

  useEffect(() => {
    if (!enabled) return;
    if (matches(searchParams.get(param))) onOpen();
  }, [param, queryKey, onOpen, enabled, matches, searchParams]);
}
