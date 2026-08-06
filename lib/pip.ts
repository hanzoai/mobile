import type { Run } from './runs'

// Cross-platform picture-in-picture surface. The real implementations live
// in modules/pip per platform; until an agent lands one, every call is a
// safe no-op and available stays false so callers render honest state.

export type Status = Pick<Run, 'title' | 'phase' | 'detail' | 'progress'>

export const available = false

// When on, the app enters PiP by itself whenever a run is active and the
// app leaves the foreground.
export function setAuto(on: boolean): void {}

export function update(status: Status): void {}

export function stop(): void {}

export function addListener(listener: (event: { active: boolean }) => void): () => void {
  return () => {}
}
