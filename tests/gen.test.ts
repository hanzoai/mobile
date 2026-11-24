type Suite = {
  gen: typeof import('@/lib/gen')
  runs: typeof import('@/lib/runs')
  store: typeof import('@/lib/store')
}

function fresh(): Suite {
  jest.resetModules()
  return {
    gen: require('@/lib/gen') as typeof import('@/lib/gen'),
    runs: require('@/lib/runs') as typeof import('@/lib/runs'),
    store: require('@/lib/store') as typeof import('@/lib/store'),
  }
}

function jsonReply(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

test('Cloud start posts /v1/agent/coding with tool=gen and model=enso-auto and mirrors into runs.ts', async () => {
  const { gen, runs, store } = fresh()
  await store.set({ kind: 'key', token: 'sk-live-secret-token' })

  const seen: Array<{ url: string; method?: string; headers?: unknown; body: Record<string, unknown> }> = []
  const real = globalThis.fetch
  globalThis.fetch = jest.fn(async (input, init) => {
    seen.push({
      url: String(input),
      method: init?.method,
      headers: init?.headers,
      body: JSON.parse(String(init?.body ?? '{}')),
    })
    return jsonReply(202, { sessionId: 'sess_cloud_1', repo: 'hanzoai/mobile', branch: 'agent/gen-1' })
  }) as unknown as typeof fetch

  try {
    const out = await gen.start({ prompt: 'add unit tests for tasks', repo: 'hanzoai/mobile' })
    expect(out.kind).toBe('ok')
    if (out.kind !== 'ok') throw new Error('expected ok')
    expect(out.value).toMatchObject({
      session: 'sess_cloud_1',
      status: 'running',
      local: false,
      repo: 'hanzoai/mobile',
      branch: 'agent/gen-1',
    })
    expect(seen[0]?.url).toBe('https://api.hanzo.ai/v1/agent/coding')
    expect(seen[0]?.body).toMatchObject({
      prompt: 'add unit tests for tasks',
      repo: 'hanzoai/mobile',
      tool: 'gen',
      model: 'enso-auto',
    })

    // Live run is visible to PiP, Widget and Tasks immediately.
    const active = runs.active()
    expect(active).toMatchObject({
      id: out.value.runId,
      kind: 'task',
      title: 'add unit tests for tasks',
      phase: 'running',
      detail: 'agent/gen-1',
    })
  } finally {
    globalThis.fetch = real
  }
})

test('steer sends follow-up to Cloud /v1/agent/coding/:id/steer and sync finishes completed runs', async () => {
  const { gen, runs, store } = fresh()
  await store.set({ kind: 'iam', token: 'iam-jwt-token' })

  const calls: Array<{ url: string; method?: string; body?: Record<string, unknown> }> = []
  const real = globalThis.fetch
  globalThis.fetch = jest.fn(async (input, init) => {
    const url = String(input)
    calls.push({
      url,
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    if (url.endsWith('/v1/agent/coding')) {
      return jsonReply(202, { sessionId: 'sess_42', branch: 'agent/sess_42' })
    }
    if (url.endsWith('/v1/agent/coding/sess_42/steer')) {
      return jsonReply(202, { ok: true })
    }
    return jsonReply(200, {
      sessions: [{ id: 'sess_42', title: 'Mobile steer test', status: 'completed' }],
    })
  }) as unknown as typeof fetch

  try {
    const started = await gen.start({ prompt: 'wire tasks screen' })
    expect(started.kind).toBe('ok')

    const steered = await gen.steer('sess_42', 'also typecheck with tsc')
    expect(steered).toEqual({ kind: 'ok', value: { session: 'sess_42' } })
    expect(calls[1]).toMatchObject({
      url: 'https://api.hanzo.ai/v1/agent/coding/sess_42/steer',
      method: 'POST',
      body: { text: 'also typecheck with tsc' },
    })
    expect(runs.active()?.phase).toBe('running')

    // Syncing /v1/agents/sessions moves the finished session out of live() into history().
    const synced = await gen.sync()
    expect(synced.kind).toBe('ok')
    expect(runs.live()).toEqual([])
    expect(runs.history()[0]).toMatchObject({ done: true, phase: 'done' })
  } finally {
    globalThis.fetch = real
  }
})

test('local hanzod endpoint supports both /v1/agent/coding wire parity and /v1/dev/sessions turns', async () => {
  const { gen, runs } = fresh()
  gen.setEndpoint('http://192.168.1.50:3690/')
  expect(gen.endpoint()).toBe('http://192.168.1.50:3690')

  const urls: string[] = []
  const real = globalThis.fetch
  globalThis.fetch = jest.fn(async (input) => {
    const url = String(input)
    urls.push(url)
    if (url.endsWith('/v1/agent/coding')) {
      return jsonReply(404, { error: 'not mounted' })
    }
    if (url.endsWith('/v1/dev/sessions')) {
      return jsonReply(201, { id: 'dev_99' })
    }
    return jsonReply(200, { outcome: 'complete', text: 'Refactored local workspace.' })
  }) as unknown as typeof fetch

  try {
    const out = await gen.start({ prompt: 'fix local rust build' })
    expect(out).toEqual({
      kind: 'ok',
      value: {
        session: 'dev_99',
        runId: expect.any(String),
        status: 'done',
        local: true,
        output: 'Refactored local workspace.',
      },
    })
    expect(runs.live()).toEqual([])
    expect(runs.history()[0]).toMatchObject({
      done: true,
      phase: 'done',
      detail: 'Refactored local workspace.',
    })

    const followUp = await gen.steer('dev_99', 'run cargo clippy')
    expect(followUp).toEqual({
      kind: 'ok',
      value: { session: 'dev_99', output: 'Refactored local workspace.' },
    })
    expect(urls).toEqual([
      'http://192.168.1.50:3690/v1/agent/coding',
      'http://192.168.1.50:3690/v1/dev/sessions',
      'http://192.168.1.50:3690/v1/dev/sessions/dev_99/turns',
      'http://192.168.1.50:3690/v1/dev/sessions/dev_99/turns',
    ])
  } finally {
    globalThis.fetch = real
  }
})

test('signed-out Cloud calls answer anon without network traffic, and 401/402/403/500 map through refusal()', async () => {
  const { gen, runs, store } = fresh()
  const real = globalThis.fetch
  const spy = jest.fn()
  globalThis.fetch = spy as unknown as typeof fetch

  try {
    await expect(gen.start({ prompt: 'hello' })).resolves.toEqual({ kind: 'anon' })
    await expect(gen.steer('sess_1', 'more')).resolves.toEqual({ kind: 'anon' })
    expect(spy).not.toHaveBeenCalled()

    await store.set({ kind: 'key', token: 'sk-test123456' })
    const cases: Array<[number, unknown, 'credential' | 'credits' | 'permission' | 'service', string]> = [
      [401, { error: 'Invalid token sk-abcd999999' }, 'credential', 'Invalid token sk-abcd…'],
      [402, { message: 'Insufficient balance' }, 'credits', 'Insufficient balance'],
      [403, { error: { message: 'Folder not granted' } }, 'permission', 'Folder not granted'],
      [500, '<html>500 Internal Server Error</html>', 'service', 'The service had a problem. Try again in a minute.'],
    ]

    for (const [status, body, expectedKind, expectedMessage] of cases) {
      globalThis.fetch = jest.fn(async () => jsonReply(status, body)) as unknown as typeof fetch
      const res = await gen.start({ prompt: `case-${status}` })
      expect(res).toEqual({
        kind: 'refused',
        refusal: { kind: expectedKind, message: expectedMessage },
      })
      expect(runs.live()).toEqual([])
      expect(runs.history()[0]).toMatchObject({
        done: true,
        phase: 'error',
        detail: expectedMessage,
      })
    }
  } finally {
    globalThis.fetch = real
  }
})
