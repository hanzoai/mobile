import { bearer, reason, refusal, v1, type Refusal } from './api'

// The cloud half of the tasks plane: agent sessions from /v1/agents/sessions.
// One fetch, one defensive normalize — envelope and field names drift across
// deployments, so every read degrades to something honest ('—') rather than
// throwing or inventing.

export type Session = {
  id: string
  title: string
  // running | paused | done | error when the server's word is recognizable;
  // otherwise the server's word itself, verbatim, never a guess.
  status: string
  // Last movement as ms epoch, only when the server said.
  at?: number
}

export type Load =
  | { kind: 'ok'; sessions: Session[] }
  | { kind: 'anon' }
  | { kind: 'refused'; refusal: Refusal }

export async function load(): Promise<Load> {
  const auth = await bearer()
  // No credential is not a refusal — nothing was asked. The screen offers
  // sign-in instead of sending a request that can only bounce.
  if (!auth.Authorization) return { kind: 'anon' }
  let res: Response
  try {
    res = await fetch(v1('/agents/sessions'), {
      headers: { Accept: 'application/json', ...auth },
    })
  } catch {
    return {
      kind: 'refused',
      refusal: refusal(0, 'No connection. Check the network and pull to retry.'),
    }
  }
  if (!res.ok) {
    // reason() in lib/api is the ONE reader of what a server said — strict
    // JSON, key redaction, capped — so a refusal here speaks with the same
    // voice as every other surface.
    const body = await res.text().catch(() => '')
    return { kind: 'refused', refusal: refusal(res.status, reason(body)) }
  }
  const body = await res.json().catch(() => null)
  return { kind: 'ok', sessions: normalize(body) }
}

// Words other deployments use for the same four states. Anything not here
// passes through verbatim — an unknown word rendered plainly beats a wrong
// chip.
const alias: Record<string, string> = {
  active: 'running',
  in_progress: 'running',
  started: 'running',
  working: 'running',
  complete: 'done',
  completed: 'done',
  finished: 'done',
  succeeded: 'done',
  failed: 'error',
  errored: 'error',
}

function normalize(body: unknown): Session[] {
  return rows(body).map((row, index) => {
    const raw = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>
    const status = (text(raw.status) ?? text(raw.state) ?? '—').toLowerCase()
    return {
      id: text(raw.id) ?? text(raw.session_id) ?? `row-${index}`,
      title: text(raw.title) ?? text(raw.name) ?? text(raw.task) ?? '—',
      status: alias[status] ?? status,
      at: when(
        raw.updated_at ?? raw.updatedAt ?? raw.created_at ?? raw.createdAt ?? raw.started_at ?? raw.startedAt
      ),
    }
  })
}

function rows(body: unknown): unknown[] {
  if (Array.isArray(body)) return body
  if (body && typeof body === 'object') {
    for (const key of ['data', 'items', 'sessions'] as const) {
      const value = (body as Record<string, unknown>)[key]
      if (Array.isArray(value)) return value
    }
  }
  return []
}

function text(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value.trim()
  return undefined
}

function when(value: unknown): number | undefined {
  // Epochs arrive in seconds or milliseconds; anything under ~2001-09 as ms
  // is really seconds.
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value < 1e12 ? value * 1000 : value
  }
  if (typeof value === 'string') {
    const t = Date.parse(value)
    if (!Number.isNaN(t)) return t
  }
  return undefined
}
