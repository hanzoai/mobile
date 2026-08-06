// The attachment draft: what /send picked and the composer is about to
// send. Module state with a tiny emitter so the two routes share one draft
// without threading a provider through the navigator.

export type Shot = { id: string; uri: string }

let shots: Shot[] = []
const listeners = new Set<() => void>()
let seq = 0

function emit() {
  for (const listener of listeners) listener()
}

export function add(uri: string): void {
  shots = [...shots, { id: `shot-${++seq}`, uri }]
  emit()
}

export function remove(id: string): void {
  shots = shots.filter((shot) => shot.id !== id)
  emit()
}

export function list(): Shot[] {
  return shots
}

// The send consumes the draft: read and clear in one move so a double-tap
// cannot attach the same image twice.
export function take(): Shot[] {
  const taken = shots
  if (taken.length) {
    shots = []
    emit()
  }
  return taken
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
