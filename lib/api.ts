import { token } from './store'

export const base = 'https://api.hanzo.ai'

export function v1(path: string): string {
  return `${base}/v1${path.startsWith('/') ? path : `/${path}`}`
}

// Headers for an authenticated call. An absent credential returns no header
// at all — the caller routes to auth instead of sending a request that can
// only be refused.
export async function bearer(): Promise<Record<string, string>> {
  const value = await token()
  return value ? { Authorization: `Bearer ${value}` } : {}
}

// Refusal mapping, same law as the estate: 401 is the credential (never loop
// back to login), 402 is credits, 403 is permission (never suggest retry),
// and only the service case may honestly say "try again".
export type Refusal = {
  kind: 'credential' | 'credits' | 'permission' | 'service'
  message: string
}

export function refusal(status: number, detail?: string): Refusal {
  const said = detail?.trim()
  switch (status) {
    case 401:
      return {
        kind: 'credential',
        message: said || 'The credential was rejected. Replace the key or sign in again from Settings.',
      }
    case 402:
      return { kind: 'credits', message: said || 'Out of credits. Top up to continue.' }
    case 403:
      return { kind: 'permission', message: said || 'This account is not allowed to do that.' }
    default:
      return { kind: 'service', message: said || 'The service had a problem. Try again in a minute.' }
  }
}

// One frame of a server-sent event stream.
export type Frame = { event?: string; data: string }

// Streams v1(path) and hands each frame to onFrame. The chat agent owns the
// implementation; the signature is fixed here so parallel work compiles.
export async function sse(
  path: string,
  init: RequestInit,
  onFrame: (frame: Frame) => void,
  signal?: AbortSignal
): Promise<void> {
  throw new Error('sse is not implemented yet')
}
