import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

import { OctaneEngineerCore } from "@/lib/octane-engineer-core";
import { hasSupabaseServiceRole } from "@/lib/supabase/service-client";
import type { InternalTypecheckResult } from "@/lib/types/engineer-execution";

const execFileAsync = promisify(execFile);

const OCTANE_CORE_ROOT = path.resolve(process.cwd());

function combineExecOutput(stdout: string, stderr: string): string {
  const parts = [stdout.trim(), stderr.trim()].filter(Boolean);
  return parts.join("\n") || "(no output)";
}

function requireServiceRole(): void {
  if (!hasSupabaseServiceRole()) {
    throw new Error(
      "Supabase service role not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running internal engineer tasks.",
    );
  }
}

/** Run `npx tsc --noEmit` for octane-core and record the run in engineer_executions. */
export async function runInternalTypecheck(): Promise<InternalTypecheckResult> {
  requireServiceRole();

  const executionId = await OctaneEngineerCore.createExecution({
    projectName: "octane_engineer",
    commandType: "run_typecheck",
    payload: {},
  });

  await OctaneEngineerCore.startExecution(executionId);

  try {
    const { stdout, stderr } = await execFileAsync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["tsc", "--noEmit"],
      {
        cwd: OCTANE_CORE_ROOT,
        maxBuffer: 10 * 1024 * 1024,
        env: process.env,
      },
    );

    const output = combineExecOutput(stdout, stderr);
    await OctaneEngineerCore.closeExecution(executionId, "completed", output);

    return { executionId, success: true, output };
  } catch (err) {
    const execErr = err as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
    };
    const output = combineExecOutput(
      execErr.stdout ?? "",
      execErr.stderr ?? execErr.message,
    );

    await OctaneEngineerCore.closeExecution(executionId, "failed", output);

    return { executionId, success: false, output };
  }
}
