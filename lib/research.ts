import { bearer, reason, refusal, v1, type Refusal } from './api'
import type { StoreAdapter } from './runs'

const CACHE_KEY = 'hanzo.research.snapshot.v1'

export type Hypothesis = {
  hypothesis_id: string
  statement: string
  null_hypothesis: string
  gate_ref: string
  proposer: string
  seq: number
  budget: {
    max_compute_seconds: number
    max_cost_usd: number
  }
}

export type ResearchRun = {
  id: string
  benchmark: string
  split: string
  system: string
  completion: string
  facts_digest: string
  notes: string
  measures: { metric: string; value: number }[]
}

export type Claim = {
  claim_id: string
  hypothesis_id?: string
  run_id: string
  mode: string
  metric: string
  value: number
  effect_size: number
  proposer: string
  status: string
  replications: number
}

export type Candidate = {
  candidate_id: string
  mutation_surface: string
  artifact_digest: string
  proposer: string
  status: string
  verified_success?: number
  cost_per_success_usd?: number
}

export type XPBalance = {
  principal: string
  total_xp: number
  domains: Record<string, number>
}

export type ResearchSnapshot = {
  hypotheses: Hypothesis[]
  runs: ResearchRun[]
  claims: Claim[]
  frontier: Candidate[]
  xp: XPBalance[]
  updatedAt: number
}

export type LoadResearch =
  | { kind: 'ok'; snapshot: ResearchSnapshot; cached?: boolean }
  | { kind: 'anon' }
  | { kind: 'refused'; refusal: Refusal; cached?: ResearchSnapshot }

let storageOverride: StoreAdapter | null = null

export function configureResearchStorage(custom: StoreAdapter | null): void {
  storageOverride = custom
}

function resolveStorage(): StoreAdapter | null {
  if (storageOverride) return storageOverride
  try {
    const mod = require('@react-native-async-storage/async-storage')
    const resolved = (mod?.default ?? mod) as StoreAdapter | undefined
    if (resolved && typeof resolved.getItem === 'function' && typeof resolved.setItem === 'function') {
      return resolved
    }
  } catch {
    return null
  }
  return null
}

async function readCache(): Promise<ResearchSnapshot | undefined> {
  const st = resolveStorage()
  if (!st) return undefined
  try {
    const raw = await st.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as ResearchSnapshot) : undefined
  } catch {
    return undefined
  }
}

async function writeCache(snapshot: ResearchSnapshot): Promise<void> {
  const st = resolveStorage()
  if (!st) return
  try {
    await st.setItem(CACHE_KEY, JSON.stringify(snapshot))
  } catch {
    // Ignore storage quota errors.
  }
}

async function getList(path: string, auth: Record<string, string>): Promise<{ ok: true; data: unknown[] } | { ok: false; refusal: Refusal }> {
  let res: Response
  try {
    res = await fetch(v1(path), { headers: { Accept: 'application/json', ...auth } })
  } catch {
    return { ok: false, refusal: refusal(0, 'No connection. Check the network and pull to retry.') }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, refusal: refusal(res.status, reason(body)) }
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | unknown[] | null
  if (Array.isArray(body)) return { ok: true, data: body }
  if (body && typeof body === 'object' && Array.isArray(body.data)) return { ok: true, data: body.data }
  if (body && typeof body === 'object' && Array.isArray(body.balances)) return { ok: true, data: body.balances }
  return { ok: true, data: [] }
}

export async function load(): Promise<LoadResearch> {
  const auth = await bearer()
  if (!auth.Authorization) return { kind: 'anon' }

  const [hyps, runs, claims, frontier, xp] = await Promise.all([
    getList('/research/hypotheses', auth),
    getList('/research/runs', auth),
    getList('/research/claims', auth),
    getList('/research/candidates/frontier', auth),
    getList('/research/xp', auth),
  ])

  const firstFailure = [hyps, runs, claims, frontier, xp].find((r) => !r.ok)
  if (firstFailure && !firstFailure.ok) {
    const cached = await readCache()
    return { kind: 'refused', refusal: firstFailure.refusal, cached }
  }

  const snapshot: ResearchSnapshot = {
    hypotheses: (hyps.ok ? hyps.data : []).map(asHypothesis),
    runs: (runs.ok ? runs.data : []).map(asRun),
    claims: (claims.ok ? claims.data : []).map(asClaim),
    frontier: (frontier.ok ? frontier.data : []).map(asCandidate),
    xp: (xp.ok ? xp.data : []).map(asXP),
    updatedAt: Date.now(),
  }
  await writeCache(snapshot)
  return { kind: 'ok', snapshot }
}

export async function replicateClaim(claimId: string, runId: string): Promise<{ ok: true } | { ok: false; refusal: Refusal }> {
  const auth = await bearer()
  if (!auth.Authorization) return { ok: false, refusal: refusal(401, 'Sign in required.') }
  let res: Response
  try {
    res = await fetch(v1(`/research/claims/${encodeURIComponent(claimId)}/replicate`), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ run_id: runId }),
    })
  } catch {
    return { ok: false, refusal: refusal(0, 'No connection.') }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { ok: false, refusal: refusal(res.status, reason(body)) }
  }
  return { ok: true }
}

function str(v: unknown, fallback = '—'): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function asHypothesis(raw: unknown): Hypothesis {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const b = (r.budget && typeof r.budget === 'object' ? r.budget : {}) as Record<string, unknown>
  return {
    hypothesis_id: str(r.hypothesis_id),
    statement: str(r.statement),
    null_hypothesis: str(r.null_hypothesis),
    gate_ref: str(r.gate_ref),
    proposer: str(r.proposer),
    seq: num(r.seq),
    budget: {
      max_compute_seconds: num(b.max_compute_seconds),
      max_cost_usd: num(b.max_cost_usd),
    },
  }
}

function asRun(raw: unknown): ResearchRun {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const ms = Array.isArray(r.measures) ? r.measures : []
  return {
    id: str(r.id),
    benchmark: str(r.benchmark),
    split: str(r.split, 'test'),
    system: str(r.system),
    completion: str(r.completion, 'unknown'),
    facts_digest: str(r.facts_digest, ''),
    notes: str(r.notes, ''),
    measures: ms.map((m) => {
      const mr = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>
      return { metric: str(mr.metric), value: num(mr.value) }
    }),
  }
}

function asClaim(raw: unknown): Claim {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    claim_id: str(r.claim_id),
    hypothesis_id: typeof r.hypothesis_id === 'string' ? r.hypothesis_id : undefined,
    run_id: str(r.run_id),
    mode: str(r.mode, 'confirmatory'),
    metric: str(r.metric),
    value: num(r.value),
    effect_size: num(r.effect_size),
    proposer: str(r.proposer),
    status: str(r.status, 'unreplicated'),
    replications: Array.isArray(r.replications) ? r.replications.length : 0,
  }
}

function asCandidate(raw: unknown): Candidate {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const pf = (r.product_fitness && typeof r.product_fitness === 'object' ? r.product_fitness : {}) as Record<string, unknown>
  return {
    candidate_id: str(r.candidate_id),
    mutation_surface: str(r.mutation_surface),
    artifact_digest: str(r.artifact_digest),
    proposer: str(r.proposer),
    status: str(r.status, 'proposed'),
    verified_success: typeof pf.verified_success === 'number' ? pf.verified_success : undefined,
    cost_per_success_usd: typeof pf.cost_per_success_usd === 'number' ? pf.cost_per_success_usd : undefined,
  }
}

function asXP(raw: unknown): XPBalance {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const doms = (r.domains && typeof r.domains === 'object' ? r.domains : {}) as Record<string, unknown>
  const cleanDoms: Record<string, number> = {}
  for (const [k, v] of Object.entries(doms)) {
    if (typeof v === 'number') cleanDoms[k] = v
  }
  return {
    principal: str(r.principal),
    total_xp: num(r.total_xp),
    domains: cleanDoms,
  }
}
