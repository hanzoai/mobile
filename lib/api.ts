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

// The refusal as a throwable, so a catch block can route on kind while an
// unknown error still reads as the service case.
export class Refused extends Error {
  kind: Refusal['kind']
  status: number
  constructor(status: number, said: Refusal) {
    super(said.message)
    this.name = 'Refused'
    this.kind = said.kind
    this.status = status
  }
}

export function refuse(error: unknown): Refusal {
  if (error instanceof Refused) return { kind: error.kind, message: error.message }
  return refusal(0, 'Could not reach api.hanzo.ai. Check the connection and try again.')
}

// What the server itself said, from a strict-JSON body only: msg,
// error.message, error, message. An HTML error page yields "" — dumping
// markup into the UI is worse than the honest generic. Key material is
// redacted at this boundary rather than trusting every upstream, and the
// sentence is capped so a stack trace cannot become the toast.
export function reason(body: string): string {
  let said = ''
  try {
    const parsed = JSON.parse(body) as {
      msg?: unknown
      message?: unknown
      error?: { message?: unknown } | string
    }
    if (typeof parsed?.msg === 'string') said = parsed.msg
    else if (typeof parsed?.error === 'object' && typeof parsed.error?.message === 'string') said = parsed.error.message
    else if (typeof parsed?.error === 'string') said = parsed.error
    else if (typeof parsed?.message === 'string') said = parsed.message
  } catch {
    return ''
  }
  return said.replace(/\b([sh]k-[A-Za-z0-9_-]{4})[A-Za-z0-9_-]+/g, '$1…').slice(0, 300)
}

// The one fetch wrapper: a /v1 path, bearer attached, JSON in and out. A
// non-2xx throws Refused through the estate mapping, the server's own
// sentence first when it stated one; an unreachable network throws the
// honest service case instead of a bare TypeError.
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(v1(path), {
      ...init,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(await bearer()),
        ...(init.headers as Record<string, string> | undefined),
      },
    })
  } catch {
    throw new Refused(0, refusal(0, 'Could not reach api.hanzo.ai. Check the connection and try again.'))
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Refused(response.status, refusal(response.status, reason(body)))
  }
  return (await response.json()) as T
}
