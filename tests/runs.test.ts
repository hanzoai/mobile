type Registry = typeof import('@/lib/runs')

// The registry is module state on purpose — every surface shares it — so
// each test takes a fresh module graph instead of leaking runs across cases.
function fresh(): Registry {
  jest.resetModules()
  return require('@/lib/runs') as Registry
}

test('start shows in live() and active(), newest first', () => {
  const runs = fresh()
  const a = runs.start({ kind: 'chat', title: 'first', phase: 'streaming' })
  const b = runs.start({ kind: 'image', title: 'second', phase: 'generating' })
  expect(runs.live().map((run) => run.id)).toEqual([b.id, a.id])
  expect(runs.active()?.id).toBe(b.id)
})

test('update patches by id and keeps order; unknown ids are a no-op', () => {
  const runs = fresh()
  const a = runs.start({ kind: 'chat', title: 'a', phase: 'streaming' })
  const b = runs.start({ kind: 'chat', title: 'b', phase: 'streaming' })
  runs.update(a.id, { phase: 'thinking', detail: '12 tok/s' })
  runs.update('missing', { phase: 'never' })
  expect(runs.live().map((run) => run.id)).toEqual([b.id, a.id])
  const patched = runs.live().find((run) => run.id === a.id)!
  expect(patched.phase).toBe('thinking')
  expect(patched.detail).toBe('12 tok/s')
})

test('end folds the final patch, moves the run to history, and bars resurrection', () => {
  const runs = fresh()
  const run = runs.start({ kind: 'image', title: 'sunset', phase: 'generating' })
  runs.end(run.id, { phase: 'done', thumb: 'data:image/png;base64,x' })
  expect(runs.live()).toEqual([])
  expect(runs.active()).toBeNull()
  const past = runs.history()[0]!
  expect(past.done).toBe(true)
  expect(past.phase).toBe('done')
  expect(past.thumb).toBe('data:image/png;base64,x')
  expect(typeof past.endedAt).toBe('number')
  runs.update(run.id, { phase: 'zombie' })
  expect(runs.live()).toEqual([])
  expect(runs.history()[0]!.phase).toBe('done')
})

test('subscribe fires per write and unsubscribe stops it', () => {
  const runs = fresh()
  let seen = 0
  const off = runs.subscribe(() => {
    seen += 1
  })
  const run = runs.start({ kind: 'voice', title: 'v', phase: 'listening' })
  runs.update(run.id, { phase: 'thinking' })
  runs.end(run.id)
  expect(seen).toBe(3)
  off()
  runs.start({ kind: 'chat', title: 'later', phase: 'streaming' })
  expect(seen).toBe(3)
})

test('snapshots are stable by reference between writes', () => {
  const runs = fresh()
  runs.start({ kind: 'chat', title: 'a', phase: 'streaming' })
  const first = runs.live()
  expect(runs.live()).toBe(first)
  runs.start({ kind: 'chat', title: 'b', phase: 'streaming' })
  expect(runs.live()).not.toBe(first)
})

test('history keeps the latest 20, newest first', () => {
  const runs = fresh()
  for (let i = 0; i < 25; i++) {
    const run = runs.start({ kind: 'task', title: `t${i}`, phase: 'working' })
    runs.end(run.id)
  }
  const past = runs.history()
  expect(past).toHaveLength(20)
  expect(past[0]!.title).toBe('t24')
  expect(past[19]!.title).toBe('t5')
})

test('two runs born in the same millisecond still order newest first', () => {
  const runs = fresh()
  const now = Date.now()
  const spy = jest.spyOn(Date, 'now').mockReturnValue(now)
  const a = runs.start({ kind: 'chat', title: 'a', phase: 'streaming' })
  const b = runs.start({ kind: 'chat', title: 'b', phase: 'streaming' })
  spy.mockRestore()
  expect(runs.live().map((run) => run.id)).toEqual([b.id, a.id])
})
