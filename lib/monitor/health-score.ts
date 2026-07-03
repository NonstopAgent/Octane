/**
 * Project Health Score — one 0–100 number per project so the dashboard can
 * answer "what needs me" instead of showing raw stats.
 *
 * Weights: deploy 25 · signals 25 · uptime 20 · commit recency 15 · reachability 15.
 * Isomorphic: server routes and client components share this module.
 */

export type HealthFactorInput = {
  /** Latest production deployment state (READY, ERROR, BUILDING, CANCELED, …). */
  latestDeployState?: string | null;
  /** Open (new/acknowledged/in_progress) signal counts for this project. */
  openCriticalSignals?: number;
  openHighSignals?: number;
  /** Trailing 24h uptime percentage (0–100) from heartbeats. */
  uptimePct24h?: number | null;
  /** Whether the last heartbeat succeeded (null = never checked). */
  lastPingOk?: boolean | null;
  /** Days since last repo push (null = unknown). */
  lastCommitDaysAgo?: number | null;
};

export type HealthFactor = {
  key: "deploy" | "signals" | "uptime" | "commits" | "reachability";
  label: string;
  score: number;
  max: number;
  detail: string;
};

export type HealthScore = {
  score: number;
  grade: "healthy" | "watch" | "attention" | "critical";
  factors: HealthFactor[];
};

function deployFactor(state?: string | null): HealthFactor {
  const s = (state ?? "").toUpperCase();
  let score = 13;
  let detail = "No deployment data.";
  if (s === "READY") {
    score = 25;
    detail = "Latest production deployment is live.";
  } else if (s === "BUILDING" || s === "QUEUED" || s === "INITIALIZING") {
    score = 18;
    detail = `Deployment in progress (${s.toLowerCase()}).`;
  } else if (s === "CANCELED") {
    score = 10;
    detail = "Latest deployment was canceled.";
  } else if (s === "ERROR" || s === "FAILED") {
    score = 0;
    detail = "Latest production deployment FAILED.";
  }
  return { key: "deploy", label: "Deploys", score, max: 25, detail };
}

function signalsFactor(critical = 0, high = 0): HealthFactor {
  const penalty = Math.min(25, critical * 12 + high * 5);
  const score = 25 - penalty;
  const detail =
    critical + high === 0
      ? "No open high-severity signals."
      : `${critical} critical, ${high} high open signal(s).`;
  return { key: "signals", label: "Signals", score, max: 25, detail };
}

function uptimeFactor(uptimePct?: number | null): HealthFactor {
  if (uptimePct === null || uptimePct === undefined) {
    return {
      key: "uptime",
      label: "Uptime",
      score: 10,
      max: 20,
      detail: "No heartbeat history yet.",
    };
  }
  const score = Math.round((Math.max(0, Math.min(100, uptimePct)) / 100) * 20);
  return {
    key: "uptime",
    label: "Uptime",
    score,
    max: 20,
    detail: `${uptimePct}% uptime over 24h.`,
  };
}

function commitsFactor(daysAgo?: number | null): HealthFactor {
  if (daysAgo === null || daysAgo === undefined) {
    return {
      key: "commits",
      label: "Momentum",
      score: 8,
      max: 15,
      detail: "No repo linked / no commit data.",
    };
  }
  let score = 15;
  if (daysAgo > 30) score = 3;
  else if (daysAgo > 14) score = 7;
  else if (daysAgo > 7) score = 11;
  return {
    key: "commits",
    label: "Momentum",
    score,
    max: 15,
    detail:
      daysAgo === 0
        ? "Pushed today."
        : `Last push ${Math.round(daysAgo)} day(s) ago.`,
  };
}

function reachabilityFactor(lastPingOk?: boolean | null): HealthFactor {
  if (lastPingOk === null || lastPingOk === undefined) {
    return {
      key: "reachability",
      label: "Reachability",
      score: 8,
      max: 15,
      detail: "Not monitored yet.",
    };
  }
  return lastPingOk
    ? {
        key: "reachability",
        label: "Reachability",
        score: 15,
        max: 15,
        detail: "Production URL responding.",
      }
    : {
        key: "reachability",
        label: "Reachability",
        score: 0,
        max: 15,
        detail: "Production URL DOWN on last check.",
      };
}

export function computeHealthScore(input: HealthFactorInput): HealthScore {
  const factors = [
    deployFactor(input.latestDeployState),
    signalsFactor(input.openCriticalSignals ?? 0, input.openHighSignals ?? 0),
    uptimeFactor(input.uptimePct24h),
    commitsFactor(input.lastCommitDaysAgo),
    reachabilityFactor(input.lastPingOk),
  ];
  const score = factors.reduce((sum, f) => sum + f.score, 0);
  const grade =
    score >= 85
      ? "healthy"
      : score >= 65
        ? "watch"
        : score >= 40
          ? "attention"
          : "critical";
  return { score, grade, factors };
}
