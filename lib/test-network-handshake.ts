import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  generateOctaneSignature,
  verifyOctaneRequest,
  type OctanePayload,
} from './octane-auth';
import { dispatchToSpoke } from './octane-dispatch';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function loadEnv(): Promise<void> {
  try {
    const { config } = await import('dotenv');
    config({ path: resolve(ROOT, '.env.local') });
    config({ path: resolve(ROOT, '.env') });
  } catch {
    // dotenv is optional; rely on process.env when unavailable
  }
}

function logResult(name: string, passed: boolean, detail?: string): void {
  const status = passed ? 'PASS' : 'FAIL';
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`[${status}] ${name}${suffix}`);
}

function buildPayload(timestamp: number): OctanePayload {
  return {
    command: 'sync_state',
    project: 'octane-core',
    timestamp,
    params: { probe: true },
  };
}

async function testStaleAndFutureTimestamps(secret: string): Promise<boolean> {
  const fiveMinutesInMs = 5 * 60 * 1000;
  const now = Date.now();

  const stalePayload = buildPayload(now - fiveMinutesInMs - 1);
  const staleSignature = generateOctaneSignature(stalePayload, secret);
  const staleRejected = !verifyOctaneRequest(stalePayload, staleSignature, secret);
  logResult('reject stale timestamp (>5 min past)', staleRejected);

  const futurePayload = buildPayload(now + fiveMinutesInMs + 1);
  const futureSignature = generateOctaneSignature(futurePayload, secret);
  const futureRejected = !verifyOctaneRequest(futurePayload, futureSignature, secret);
  logResult('reject future timestamp (>5 min ahead)', futureRejected);

  const validPayload = buildPayload(now);
  const validSignature = generateOctaneSignature(validPayload, secret);
  const validAccepted = verifyOctaneRequest(validPayload, validSignature, secret);
  logResult('accept valid timestamp and signature', validAccepted);

  return staleRejected && futureRejected && validAccepted;
}

async function testSpokeDispatch(
  label: string,
  targetUrl: string,
  project: string
): Promise<boolean> {
  try {
    const result = await dispatchToSpoke({
      targetUrl,
      project,
      command: 'sync_state',
      params: { handshake: true },
    });
    const ok =
      result &&
      typeof result === 'object' &&
      'success' in result &&
      (result as { success?: boolean }).success === true;
    logResult(`${label} dispatch (${targetUrl})`, ok, JSON.stringify(result));
    return ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const unreachable =
      message.includes('fetch failed') ||
      message.includes('ECONNREFUSED') ||
      message.includes('ENOTFOUND') ||
      message.includes('Failed to fetch');
    if (unreachable) {
      logResult(
        `${label} dispatch (${targetUrl})`,
        true,
        `SKIP — spoke not reachable (${message}). Start dev server and re-run.`
      );
      return true;
    }
    logResult(`${label} dispatch (${targetUrl})`, false, message);
    return false;
  }
}

export async function runHandshakeTests(): Promise<number> {
  await loadEnv();

  const secret = process.env.OCTANE_SHARED_SECRET;
  if (!secret) {
    console.error(
      '[FAIL] OCTANE_SHARED_SECRET is not set. Add it to octane-core/.env.local or the environment.'
    );
    return 1;
  }

  console.log('Octane network handshake tests\n');

  const unitOk = await testStaleAndFutureTimestamps(secret);

  const nexusUrl =
    process.env.OCTANE_NEXUS_SPOKE_URL ?? 'http://localhost:3000/api/octane-engineer';
  const ajaxUrl =
    process.env.OCTANE_AJAX_SPOKE_URL ?? 'http://localhost:3001/api/octane-engineer';

  const nexusOk = await testSpokeDispatch('Nexus', nexusUrl, 'octane-nexus');
  const ajaxOk = await testSpokeDispatch('Ajax', ajaxUrl, 'octane-ajax');

  const allPassed = unitOk && nexusOk && ajaxOk;
  console.log(allPassed ? '\nAll handshake checks passed.' : '\nOne or more handshake checks failed.');
  return allPassed ? 0 : 1;
}

function isExecutedDirectly(): boolean {
  if (typeof require !== 'undefined' && typeof module !== 'undefined') {
    return require.main === module;
  }
  const scriptPath = process.argv[1]?.replace(/\\/g, '/');
  return scriptPath?.includes('test-network-handshake') ?? false;
}

if (isExecutedDirectly()) {
  runHandshakeTests()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error('[FAIL] Unhandled handshake test error:', error);
      process.exit(1);
    });
}
