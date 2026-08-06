// The run registry: every long piece of work the app is doing, one shape in
// one place. PiP, the widget and any screen subscribe here rather than to
// each feature. Pure TS with a tiny emitter so native modules and tests can
// use it without a mounted tree.

export type Run = {
  id: string
  kind: 'chat' | 'image' | 'voice' | 'task'
  title: string
  phase: string
  detail?: string
  progress?: number
  startedAt: number
  done?: boolean
}

const runs = new Map<string, Run>()
const listeners = new Set<() => void>()
let seq = 0

function emit() {
  for (const listener of listeners) listener()
}

export function start(run: Omit<Run, 'id' | 'startedAt' | 'done'> & { id?: string }): Run {
  const id = run.id ?? `run-${++seq}-${Date.now().toString(36)}`
  const full: Run = { ...run, id, startedAt: Date.now() }
  runs.set(id, full)
  emit()
  return full
}

export function update(
  id: string,
  patch: Partial<Pick<Run, 'title' | 'phase' | 'detail' | 'progress'>>
): void {
  const run = runs.get(id)
  if (!run) return
  runs.set(id, { ...run, ...patch })
  emit()
}

export function end(id: string): void {
  const run = runs.get(id)
  if (!run) return
  runs.set(id, { ...run, done: true })
  // Finished runs stay readable so a subscriber that wakes late still sees
  // the final phase; the cap keeps the registry from growing without bound.
  if (runs.size > 32) {
    for (const [key, kept] of runs) {
      if (kept.done && runs.size > 32) runs.delete(key)
    }
  }
  emit()
}

// The most recently started run that has not finished, or null.
export function active(): Run | null {
  let latest: Run | null = null
  for (const run of runs.values()) {
    if (run.done) continue
    if (!latest || run.startedAt > latest.startedAt) latest = run
  }
  return latest
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
