export type CodingJobLogLevel = "info" | "warn" | "error" | "success";

/** Timestamped log line for a coding job run timeline. */
export interface CodingJobLog {
  id: string;
  timestamp: string;
  level: CodingJobLogLevel;
  message: string;
  phase?: string;
}
