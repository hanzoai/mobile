// The run registry: every long piece of work the app is doing, one shape in
// one place, plus optional durable persistence across app restarts. PiP, the
// widget and the tasks screen subscribe here rather than to each feature.

export type Kind = 'chat' | 'image' | 'voice' | 'task' | 'research'

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

export type StoreAdapter = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

const STORAGE_KEY = 'hanzo.runs.v1'

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
let adapter: StoreAdapter | null = null

function resolveAdapter(): StoreAdapter | null {
  if (adapter) return adapter
  try {
    // Lazy require keeps pure-TS unit tests independent of native modules.
    const mod = require('@react-native-async-storage/async-storage')
    const resolved = (mod?.default ?? mod) as StoreAdapter | undefined
    if (resolved && typeof resolved.getItem === 'function' && typeof resolved.setItem === 'function') {
      adapter = resolved
    }
  } catch {
    adapter = null
  }
  return adapter
}

export function configureStorage(custom: StoreAdapter | null): void {
  adapter = custom
}

function persist(): void {
  const st = resolveAdapter()
  if (!st) return
  const payload = JSON.stringify({
    live: [...open.values()],
    history: past,
  })
  void st.setItem(STORAGE_KEY, payload).catch(() => {})
}

export async function hydrate(): Promise<void> {
  const st = resolveAdapter()
  if (!st) return
  try {
    const raw = await st.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as { live?: Run[]; history?: Run[] }
    if (Array.isArray(parsed.history) && past.length === 0) {
      past = parsed.history.slice(0, KEEP)
    }
    if (Array.isArray(parsed.live) && open.size === 0) {
      for (const item of parsed.live) {
        if (item?.id) open.set(item.id, item)
      }
    }
    emit(false)
  } catch {
    // Corrupted local cache degrades cleanly to empty.
  }
}

function emit(writeStorage = true) {
  // The map's insertion order is exactly start order — update() re-sets the
  // same key, which keeps position — so newest-first is a reverse, and two
  // runs born in the same millisecond still order correctly.
  current = [...open.values()].reverse()
  if (writeStorage) persist()
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
