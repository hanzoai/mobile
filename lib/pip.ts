import { router } from 'expo-router'
import { useSyncExternalStore } from 'react'

import native from '../modules/pip'
import * as runs from './runs'
import type { Run } from './runs'

// Picture-in-picture, one surface for every platform. Android PiP is
// activity-level: the OS miniaturizes the live React tree, so while inPip
// the layout shows components/pip/PipCard over everything else. iOS draws
// frames into the system video window instead, so status is forwarded to the
// native renderer. Web has no native module and every call is a safe no-op.
// The native contract lives in modules/pip; this facade is what app code
// imports, and its Status is the slice of a Run the card renders.

export type Status = Pick<Run, 'title' | 'phase' | 'detail' | 'progress' | 'thumb' | 'startedAt'>

export const available: boolean = native?.isSupported() ?? false

type Pip = { inPip: boolean; status: Status | null }

let inPip = false
let status: Status | null = null
let auto = false
let snapshot: Pip = { inPip, status }

const watchers = new Set<() => void>()
const restorers = new Set<() => void>()

function emit(): void {
  snapshot = { inPip, status }
  for (const watcher of watchers) watcher()
}

// When on, an active-run app that leaves the foreground miniaturizes by
// itself. Repeated same-value calls stop here so the run registry can call
// this on every change without chattering across the bridge.
export function setAuto(on: boolean): void {
  if (!available || !native || on === auto) return
  auto = on
  void native.setAuto(on)
}

let sentAt = 0
let timer: ReturnType<typeof setTimeout> | null = null

// The JS signal reflects every call, so the Android card is always current.
// The native hop is the iOS frame render, capped at one per second with the
// trailing update kept so the final state always lands.
export function update(next: Status): void {
  status = next
  emit()
  if (!available || !native?.update) return
  const wait = sentAt + 1000 - Date.now()
  if (wait <= 0) {
    sentAt = Date.now()
    void native.update(next)
  } else if (!timer) {
    timer = setTimeout(() => {
      timer = null
      sentAt = Date.now()
      // The import's non-null narrowing does not survive into this closure,
      // so the optional chain restates what the guard above proved.
      if (status) void native?.update?.(status)
    }, wait)
  }
}

export function stop(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (status) {
    status = null
    emit()
  }
  if (available) void native?.stop?.()
}

// Fires when the user expands the miniature window back into the full app.
export function onRestore(listener: () => void): () => void {
  restorers.add(listener)
  return () => {
    restorers.delete(listener)
  }
}

native?.addListener('changed', (event) => {
  inPip = event.inPip
  emit()
})

native?.addListener('restored', () => {
  // Expanding the window is a statement of intent: show me the work. Land
  // on the board that lists it, then let subscribers refine from there.
  router.push('/(tabs)/tasks')
  for (const listener of restorers) listener()
})

// The product rule, stated once: work in flight arms the surface. While a
// run is active, leaving the app miniaturizes it and the card follows the
// run; when nothing runs, leaving the app does nothing.
function follow(): void {
  const run = runs.active()
  if (run) {
    setAuto(true)
    update({
      title: run.title,
      phase: run.phase,
      detail: run.detail,
      progress: run.progress,
      thumb: run.thumb,
      startedAt: run.startedAt,
    })
  } else {
    setAuto(false)
    stop()
  }
}

runs.subscribe(follow)
follow()

function get(): Pip {
  return snapshot
}

function watch(listener: () => void): () => void {
  watchers.add(listener)
  return () => {
    watchers.delete(listener)
  }
}

export function usePip(): Pip {
  return useSyncExternalStore(watch, get, get)
}
