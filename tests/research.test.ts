jest.mock('@/lib/api', () => ({
  bearer: jest.fn(async () => ({ Authorization: 'Bearer mobile-tok-1' })),
  v1: (p: string) => `https://api.hanzo.ai/v1${p}`,
  reason: (s: string) => s || 'refused',
  refusal: (status: number, message: string) => ({ status, message }),
}))

import * as research from '@/lib/research'

describe('mobile Hanzo Dō research client & offline cache', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  test('loads hypotheses, runs with SHA-256 digests, claims, Pareto frontier, and XP, surviving offline reload', async () => {
    const disk = new Map<string, string>()
    research.configureResearchStorage({
      getItem: async (k) => disk.get(k) ?? null,
      setItem: async (k, v) => {
        disk.set(k, v)
      },
    })

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/research/hypotheses')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                hypothesis_id: 'sha256:hyp1',
                statement: 'Sandbox verifier improves pass@1',
                null_hypothesis: 'No lift',
                gate_ref: 'swe-bench-verified',
                proposer: 'did:hanzo:alice',
                seq: 1,
                budget: { max_compute_seconds: 300, max_cost_usd: 15 },
              },
            ],
          }),
          { status: 200 },
        )
      }
      if (url.endsWith('/research/runs')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'exp-desktop-1',
                benchmark: 'swe-bench-verified',
                split: 'test',
                system: 'hanzod-local',
                completion: 'complete',
                facts_digest: 'sha256:deadbeef1234',
                measures: [{ metric: 'pass@1', value: 0.86 }],
              },
            ],
          }),
          { status: 200 },
        )
      }
      if (url.endsWith('/research/claims')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                claim_id: 'sha256:cl1',
                run_id: 'exp-desktop-1',
                mode: 'confirmatory',
                metric: 'pass@1',
                value: 0.86,
                effect_size: 0.05,
                proposer: 'did:hanzo:alice',
                status: 'replicated',
                replications: [{ run_id: 'rep-1' }],
              },
            ],
          }),
          { status: 200 },
        )
      }
      if (url.endsWith('/research/candidates/frontier')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                candidate_id: 'sha256:cand1',
                mutation_surface: 'engine.strategy',
                artifact_digest: 'sha256:art1',
                proposer: 'did:hanzo:alice',
                status: 'promoted',
                product_fitness: { verified_success: 0.86, cost_per_success_usd: 0.42 },
              },
            ],
          }),
          { status: 200 },
        )
      }
      if (url.endsWith('/research/xp')) {
        return new Response(
          JSON.stringify({
            balances: [{ principal: 'did:hanzo:alice', total_xp: 286, domains: { engine: 186, science: 100 } }],
          }),
          { status: 200 },
        )
      }
      return new Response('{}', { status: 404 })
    }) as typeof fetch

    const res = await research.load()
    expect(res.kind).toBe('ok')
    if (res.kind !== 'ok') return
    expect(res.snapshot.runs[0]?.facts_digest).toBe('sha256:deadbeef1234')
    expect(res.snapshot.claims[0]?.status).toBe('replicated')
    expect(res.snapshot.frontier[0]?.mutation_surface).toBe('engine.strategy')
    expect(res.snapshot.xp[0]?.total_xp).toBe(286)

    // Simulate network offline after restart: cached snapshot is still served!
    global.fetch = jest.fn(async () => {
      throw new Error('offline')
    }) as typeof fetch

    const offline = await research.load()
    expect(offline.kind).toBe('refused')
    if (offline.kind === 'refused') {
      expect(offline.cached?.runs[0]?.id).toBe('exp-desktop-1')
      expect(offline.cached?.xp[0]?.total_xp).toBe(286)
    }
  })
})
