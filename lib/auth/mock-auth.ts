"use client";

import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_VALUE,
  AUTH_STORAGE_KEY,
} from "@/lib/auth/constants";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function setAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=${AUTH_COOKIE_VALUE}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  localStorage.setItem(AUTH_STORAGE_KEY, AUTH_COOKIE_VALUE);
}

export function clearAuthSession() {
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function isAuthenticatedClient() {
  if (typeof window === "undefined") {
    return false;
  }

  return localStorage.getItem(AUTH_STORAGE_KEY) === AUTH_COOKIE_VALUE;
}
