import { generateOctaneSignature, OctanePayload } from '@/lib/octane-auth';

interface DispatchOptions {
  targetUrl: string;
  project: string;
  command: string;
  params: Record<string, any>;
}

export async function dispatchToSpoke({ targetUrl, project, command, params }: DispatchOptions) {
  const secret = process.env.OCTANE_SHARED_SECRET!;

  const payload: OctanePayload = {
    command,
    project,
    timestamp: Date.now(),
    params,
  };

  const signature = generateOctaneSignature(payload, secret);

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-octane-signature': signature,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(`Spoke dispatch failed [${response.status}]: ${errData.error || response.statusText}`);
  }

  return response.json();
}
