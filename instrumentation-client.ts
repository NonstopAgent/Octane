import posthog from "posthog-js";

/**
 * PostHog client capture — pageviews (incl. SPA navigation), autocapture,
 * exceptions, and web vitals into the Octane Nexus PostHog project.
 * Key is the public ingest token (safe as NEXT_PUBLIC).
 */
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;

if (key) {
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    ui_host: "https://us.posthog.com",
    defaults: "2025-05-24",
    capture_exceptions: true,
  });
}
