// The run registry: every long piece of work the app is doing, one shape in
// one place. PiP, the widget and the tasks screen subscribe here rather than
// to each feature. Pure TS with a tiny emitter — no React, no native code —
// so tests can drive it without a mounted tree.

export type Kind = 'chat' | 'image' | 'voice' | 'task'

export type Run = {
  id: string
  kind: Kind
  title: string
  // Free prose for the current step — 'generating', 'thinking', 'done'. The
  // one loaded word is 'error': cards read it and tint the phase line.
  phase: string
  detail?: string
  // Fraction 0..1 when the work can measure itself; absent is indeterminate.
  progress?: number
  // A small picture for surfaces that can show one: data URI or https URL.
  thumb?: string
  startedAt: number
  endedAt?: number
  done?: boolean
}

export type Patch = Partial<Pick<Run, 'title' | 'phase' | 'detail' | 'progress' | 'thumb'>>

// Finished runs stay readable in a short ring so a subscriber that wakes
// late still sees what just happened, without the registry growing forever.
const KEEP = 20

const open = new Map<string, Run>()
const listeners = new Set<() => void>()
let seq = 0

// Snapshots are rebuilt on write and handed out by reference, so React's
// useSyncExternalStore sees a stable value between emits.
let current: Run[] = []
let past: Run[] = []

function emit() {
  // The map's insertion order is exactly start order — update() re-sets the
  // same key, which keeps position — so newest-first is a reverse, and two
  // runs born in the same millisecond still order correctly.
  current = [...open.values()].reverse()
  for (const listener of listeners) listener()
}

export function start(run: Omit<Run, 'id' | 'startedAt' | 'endedAt' | 'done'> & { id?: string }): Run {
  const id = run.id ?? `run-${++seq}-${Date.now().toString(36)}`
  const full: Run = { ...run, id, startedAt: Date.now() }
  open.set(id, full)
  emit()
  return full
}

export function update(id: string, patch: Patch): void {
  const run = open.get(id)
  if (!run) return
  open.set(id, { ...run, ...patch })
  emit()
}

// Ends a run, folding in a final patch — phase 'done' or 'error', a thumb —
// and moves it from the live set into the ring. Unknown ids are a no-op so
// a late caller cannot resurrect anything.
export function end(id: string, patch?: Patch): void {
  const run = open.get(id)
  if (!run) return
  open.delete(id)
  past = [{ ...run, ...patch, done: true, endedAt: Date.now() }, ...past].slice(0, KEEP)
  emit()
}

// Every run still going, newest first.
export function live(): Run[] {
  return current
}

// The most recently started run that has not finished, or null — the one
// line PiP and the widget show.
export function active(): Run | null {
  return current[0] ?? null
}

// The last KEEP finished runs, newest first.
export function history(): Run[] {
  return past
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
