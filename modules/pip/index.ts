import { requireOptionalNativeModule } from 'expo-modules-core'

// What the native card renders. Mirrors the Run fields lib/pip.ts forwards;
// startedAt is epoch milliseconds and drives the mm:ss clock on iOS. thumb
// is a data URI or raw base64 — network URLs are ignored natively because
// drawing must never block on a fetch.
export type Status = {
  title: string
  phase: string
  detail?: string
  progress?: number
  thumb?: string
  startedAt?: number
}

// Every platform registers the ONE name 'pip' and emits the same events:
// changed fires with the window's presence, restored fires when the user
// expands the window back into the app.
export type Events = {
  changed: (event: { inPip: boolean }) => void
  restored: () => void
}

// The raw native surface. Android miniaturizes the live activity, so only
// enter and setAuto matter there; iOS feeds rendered frames to the system
// video window, so update and stop do the work — hence both are optional.
// The cross-platform facade over this is lib/pip.ts; app code imports that,
// never this. Null wherever no native module exists — web, Expo Go — so
// callers degrade to a silent no-op instead of crashing at import.
//
// Stated in full rather than extending expo-modules-core's NativeModule:
// that export is typed as the class constructor, not the instance, so the
// instance shape the facade touches is declared as the contract itself.
export type Native = {
  isSupported(): boolean
  enter(w: number, h: number): Promise<boolean>
  setAuto(on: boolean): Promise<void>
  update?(status: Status): Promise<void>
  stop?(): Promise<void>
  addListener<Name extends keyof Events>(name: Name, listener: Events[Name]): { remove(): void }
}

export default requireOptionalNativeModule<Native>('pip')
