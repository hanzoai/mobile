import { bearer, reason, refusal, v1, type Refusal } from './api'
import * as runs from './runs'
import * as sessions from './sessions'

// Unified `gen` (`hanzo-gen`) agentic harness client for Mobile:
// Cloud (/v1/agent/coding, /steer, /agents/sessions) + local/LAN `hanzod`
// (http://<host>:3690/v1/agent/coding & /v1/dev/sessions), mirrored into lib/runs.

export const DEFAULT_TOOL = 'gen'
export const DEFAULT_MODEL = 'enso-auto'

export type Ask = {
  prompt: string
  repo?: string
  base?: string
  workspace?: string
  model?: string
  tool?: string
  targetId?: string
  endpoint?: string | null
}

export type Task = {
  session: string
  runId: string
  status: string
  local: boolean
  repo?: string
  branch?: string
  output?: string
}

export type Outcome<T> = { kind: 'ok'; value: T } | { kind: 'anon' } | { kind: 'refused'; refusal: Refusal }

let configuredEndpoint: string | null = null
let reqSeq = 0
const tracked = new Map<string, string>()

const cleanOrigin = (raw?: string | null): string | null => {
  const t = raw?.trim().replace(/\/+$/, '')
  return t && /^https?:\/\//i.test(t) ? t : null
}

export const setEndpoint = (url: string | null): void => {
  configuredEndpoint = cleanOrigin(url)
}
export const endpoint = (): string | null => configuredEndpoint

const nextRequestId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `req_${Date.now().toString(36)}_${(++reqSeq).toString(36)}`
const urlFor = (origin: string | null, path: string): string =>
  origin ? `${origin}/v1${path.startsWith('/') ? path : `/${path}`}` : v1(path)
const shortTitle = (text: string): string => (text.length > 64 ? `${text.slice(0, 64)}…` : text)
const jsonHeaders = (auth: Record<string, string>) => ({ 'Content-Type': 'application/json', Accept: 'application/json', ...auth })

function refuseRun<T>(runId: string, status: number, detail: string, sid?: string): Outcome<T> {
  const said = refusal(status, detail)
  runs.finish(runId, { phase: 'error', detail: said.message })
  if (sid) tracked.delete(sid)
  return { kind: 'refused', refusal: said }
}

async function fail<T>(runId: string, res: Response, sid?: string): Promise<Outcome<T>> {
  return refuseRun(runId, res.status, reason(await res.text().catch(() => '')), sid)
}

async function runHanzodTurn(
  origin: string,
  auth: Record<string, string>,
  runId: string,
  prompt: string,
  model: string,
  workspace: string
): Promise<Outcome<Task>> {
  const headers = jsonHeaders(auth)
  const createdRes = await fetch(`${origin}/v1/dev/sessions`, { method: 'POST', headers, body: JSON.stringify({ workspace, model }) })
  if (!createdRes.ok) return fail(runId, createdRes)
  const created = (await createdRes.json().catch(() => null)) as Record<string, unknown> | null
  const sid = String(created?.id ?? created?.session_id ?? '')
  if (!sid) return refuseRun(runId, 502, 'hanzod created a session without an id.')
  tracked.set(sid, runId)
  runs.update(runId, { phase: 'running', detail: workspace })
  const turnRes = await fetch(`${origin}/v1/dev/sessions/${encodeURIComponent(sid)}/turns`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt, model }),
  })
  if (!turnRes.ok) return fail(runId, turnRes, sid)
  const turn = (await turnRes.json().catch(() => null)) as Record<string, unknown> | null
  const complete = turn?.outcome === 'complete'
  const output = typeof turn?.text === 'string' ? turn.text.trim() : undefined
  runs.finish(runId, { phase: complete ? 'done' : 'error', detail: output || workspace })
  tracked.delete(sid)
  return { kind: 'ok', value: { session: sid, runId, status: complete ? 'done' : 'error', local: true, output } }
}

export async function start(ask: Ask): Promise<Outcome<Task>> {
  const prompt = ask.prompt.trim()
  if (!prompt) return { kind: 'refused', refusal: refusal(400, 'Describe what Gen should build or fix.') }
  const origin = cleanOrigin(ask.endpoint) ?? configuredEndpoint
  const auth = await bearer()
  if (!origin && !auth.Authorization) return { kind: 'anon' }

  const repo = ask.repo?.trim() || undefined
  const model = ask.model?.trim() || DEFAULT_MODEL
  const tool = ask.tool?.trim() || DEFAULT_TOOL
  const run = runs.start({ kind: 'task', title: shortTitle(prompt), phase: 'starting', detail: repo ?? (origin ? 'hanzod' : `${tool} · ${model}`) })

  try {
    if (origin && ask.workspace?.trim()) return await runHanzodTurn(origin, auth, run.id, prompt, model, ask.workspace.trim())
    const body: Record<string, unknown> = { prompt, tool, model, requestId: nextRequestId() }
    if (repo) body.repo = repo
    if (ask.base?.trim()) body.base = ask.base.trim()
    if (ask.targetId?.trim()) body.targetId = ask.targetId.trim()
    const res = await fetch(urlFor(origin, '/agent/coding'), { method: 'POST', headers: jsonHeaders(auth), body: JSON.stringify(body) })
    if (origin && res.status === 404) return await runHanzodTurn(origin, auth, run.id, prompt, model, '.')
    if (!res.ok) return await fail(run.id, res)
    const doc = (await res.json().catch(() => null)) as Record<string, unknown> | null
    const session = String(doc?.sessionId ?? doc?.id ?? doc?.session_id ?? '')
    if (!session) return refuseRun(run.id, 502, 'The run was admitted without a session id.')
    const branch = typeof doc?.branch === 'string' && doc.branch ? doc.branch : undefined
    tracked.set(session, run.id)
    runs.update(run.id, { phase: 'running', detail: branch ?? repo ?? session })
    return { kind: 'ok', value: { session, runId: run.id, status: 'running', local: Boolean(origin), repo, branch } }
  } catch {
    return refuseRun(run.id, 0, `Could not reach ${origin ?? 'api.hanzo.ai'}. Check the connection and try again.`)
  }
}

export async function steer(
  sessionId: string,
  prompt: string,
  opts?: { endpoint?: string | null }
): Promise<Outcome<{ session: string; output?: string }>> {
  const sid = sessionId.trim()
  const words = prompt.trim()
  if (!sid || !words) return { kind: 'refused', refusal: refusal(400, 'Enter a follow-up instruction.') }
  const origin = cleanOrigin(opts?.endpoint) ?? configuredEndpoint
  const isLocalDev = sid.startsWith('dev_')
  const auth = await bearer()
  if (!origin && !isLocalDev && !auth.Authorization) return { kind: 'anon' }

  const existingId = tracked.get(sid)
  const runId = existingId ?? runs.start({ kind: 'task', title: shortTitle(words), phase: 'steering', detail: sid }).id
  tracked.set(sid, runId)
  if (existingId) runs.update(runId, { phase: 'steering', detail: shortTitle(words) })

  try {
    const targetOrigin = origin ?? (isLocalDev ? 'http://127.0.0.1:3690' : null)
    const targetUrl = isLocalDev
      ? `${targetOrigin}/v1/dev/sessions/${encodeURIComponent(sid)}/turns`
      : urlFor(targetOrigin, `/agent/coding/${encodeURIComponent(sid)}/steer`)
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: jsonHeaders(auth),
      body: JSON.stringify(isLocalDev ? { prompt: words } : { text: words, requestId: nextRequestId() }),
    })
    if (!res.ok) return await fail(runId, res, sid)
    if (isLocalDev) {
      const doc = (await res.json().catch(() => null)) as Record<string, unknown> | null
      const output = typeof doc?.text === 'string' ? doc.text.trim() : undefined
      runs.finish(runId, { phase: doc?.outcome === 'complete' ? 'done' : 'error', detail: output ?? sid })
      tracked.delete(sid)
      return { kind: 'ok', value: { session: sid, output } }
    }
    runs.update(runId, { phase: 'running', detail: shortTitle(words) })
    return { kind: 'ok', value: { session: sid } }
  } catch {
    return refuseRun(runId, 0, 'Could not reach the coding session. Check the connection and try again.', sid)
  }
}

export async function sync(opts?: { endpoint?: string | null }): Promise<sessions.Load> {
  const origin = cleanOrigin(opts?.endpoint) ?? configuredEndpoint
  const loaded: sessions.Load = origin ? await loadDaemonSessions(origin) : await sessions.load()
  if (loaded.kind === 'ok') {
    for (const row of loaded.sessions) {
      const runId = tracked.get(row.id)
      if (!runId) continue
      if (row.status === 'done' || row.status === 'error') {
        runs.finish(runId, { phase: row.status })
        tracked.delete(row.id)
      } else {
        runs.update(runId, { phase: row.status, ...(row.title !== '—' ? { title: row.title } : {}) })
      }
    }
  }
  return loaded
}

async function loadDaemonSessions(origin: string): Promise<sessions.Load> {
  const auth = await bearer()
  try {
    let res = await fetch(`${origin}/v1/agents/sessions`, { headers: { Accept: 'application/json', ...auth } })
    if (res.status === 404) res = await fetch(`${origin}/v1/dev/sessions`, { headers: { Accept: 'application/json', ...auth } })
    if (!res.ok) return { kind: 'refused', refusal: refusal(res.status, reason(await res.text().catch(() => ''))) }
    const doc = (await res.json().catch(() => null)) as { sessions?: Array<Record<string, unknown>> } | null
    const list = Array.isArray(doc?.sessions) ? doc.sessions : []
    return {
      kind: 'ok',
      sessions: list.map((s, i) => ({
        id: String(s.id ?? `dev_${i}`),
        title: String(s.title ?? s.label ?? s.workspace ?? '—'),
        status: s.status === 'complete' || s.status === 'completed' ? 'done' : String(s.status ?? 'running'),
      })),
    }
  } catch {
    return { kind: 'refused', refusal: refusal(0, `Could not reach ${origin}. Check the connection and pull to retry.`) }
  }
}
