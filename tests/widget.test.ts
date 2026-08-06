// lib/widget captures its native binding at import, so each case installs a
// fake into the expo-modules-core shim FIRST and then requires a fresh graph.
type Fake = { set: jest.Mock }

function fresh(fake?: Fake): {
  widget: typeof import('@/lib/widget')
  runs: typeof import('@/lib/runs')
} {
  jest.resetModules()
  const shim = require('./stubs/modules') as typeof import('./stubs/modules')
  if (fake) shim.install('Widget', fake)
  return {
    widget: require('@/lib/widget') as typeof import('@/lib/widget'),
    runs: require('@/lib/runs') as typeof import('@/lib/runs'),
  }
}

function state(fake: Fake, call: number): { snippet: string; updatedAt: number } {
  return JSON.parse(fake.set.mock.calls[call]![0] as string)
}

test('setState hands the platform one JSON string {snippet, updatedAt}', async () => {
  const fake: Fake = { set: jest.fn() }
  const { widget } = fresh(fake)
  await widget.setState({ snippet: 'hello', updatedAt: 1234 })
  expect(fake.set).toHaveBeenCalledTimes(1)
  expect(state(fake, 0)).toEqual({ snippet: 'hello', updatedAt: 1234 })
})

test('setLastMessage trims, collapses whitespace and caps at 200', () => {
  const fake: Fake = { set: jest.fn() }
  const { widget } = fresh(fake)
  widget.setLastMessage('  a markdown\n\nanswer   with breaks  ')
  expect(state(fake, 0).snippet).toBe('a markdown answer with breaks')
  widget.setLastMessage(`${'x'.repeat(300)}`)
  expect(state(fake, 1).snippet).toHaveLength(200)
  widget.setLastMessage('   \n  ')
  expect(fake.set).toHaveBeenCalledTimes(2)
})

test('an absent native module makes every call a silent no-op', async () => {
  const { widget } = fresh()
  await expect(widget.setState({ snippet: 'ghost', updatedAt: 1 })).resolves.toBeUndefined()
  expect(() => widget.setLastMessage('ghost')).not.toThrow()
})

test('follow() pushes only changed run lines and leaves the last message on end', () => {
  const fake: Fake = { set: jest.fn() }
  const { widget, runs } = fresh(fake)
  const off = widget.follow()
  const run = runs.start({ kind: 'chat', title: 'zen5', phase: 'streaming' })
  expect(fake.set).toHaveBeenCalledTimes(1)
  expect(state(fake, 0).snippet).toBe('zen5 — streaming')
  // A detail-only patch keeps the same line; WidgetKit reload budgets are
  // real, so no write happens.
  runs.update(run.id, { detail: '42 tok/s' })
  expect(fake.set).toHaveBeenCalledTimes(1)
  runs.update(run.id, { phase: 'thinking' })
  expect(fake.set).toHaveBeenCalledTimes(2)
  expect(state(fake, 1).snippet).toBe('zen5 — thinking')
  // Ending the run writes nothing: the last message stays on the widget.
  runs.end(run.id)
  expect(fake.set).toHaveBeenCalledTimes(2)
  off()
  runs.start({ kind: 'image', title: 'later', phase: 'generating' })
  expect(fake.set).toHaveBeenCalledTimes(2)
})
