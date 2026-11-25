import { base, setBase } from './api'
import * as gen from './gen'

export type Prefs = {
  guestMode: boolean
  apiBase: string
  localNodeEnabled: boolean
  localNodeUrl: string
  pipEnabled: boolean
}

export type SettingsRowMeta = {
  id: string
  label: string
  subtitle?: string
  value?: string
}

export type SettingsGroupMeta<R extends SettingsRowMeta = SettingsRowMeta> = {
  title: string
  rows: R[]
}

const STORAGE_KEY = 'hanzo.prefs.v1'
export const DEFAULT_LOCAL_NODE = 'http://127.0.0.1:3690'

const defaults: Prefs = {
  guestMode: false,
  apiBase: base,
  localNodeEnabled: false,
  localNodeUrl: DEFAULT_LOCAL_NODE,
  pipEnabled: true,
}

type StorageLike = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

let state: Prefs = { ...defaults }
let hydrated = false
let adapter: StorageLike | null = null
const listeners = new Set<() => void>()

function resolveStorage(): StorageLike | null {
  if (adapter) return adapter
  try {
    const mod = require('@react-native-async-storage/async-storage')
    const resolved = (mod?.default ?? mod) as StorageLike | undefined
    if (resolved && typeof resolved.getItem === 'function' && typeof resolved.setItem === 'function') {
      adapter = resolved
    }
  } catch {
    adapter = null
  }
  return adapter
}

function applyRuntime(next: Prefs): void {
  setBase(next.apiBase)
  gen.setEndpoint(next.localNodeEnabled ? next.localNodeUrl : null)
}

function emit(): void {
  for (const listener of listeners) listener()
}

export function snapshot(): Prefs {
  return state
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export async function hydrate(): Promise<Prefs> {
  if (hydrated) return state
  const storage = resolveStorage()
  if (storage) {
    try {
      const raw = await storage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Prefs>
        state = {
          guestMode: Boolean(parsed.guestMode),
          apiBase: typeof parsed.apiBase === 'string' && parsed.apiBase.trim() ? parsed.apiBase.trim() : base,
          localNodeEnabled: Boolean(parsed.localNodeEnabled),
          localNodeUrl:
            typeof parsed.localNodeUrl === 'string' && parsed.localNodeUrl.trim()
              ? parsed.localNodeUrl.trim()
              : DEFAULT_LOCAL_NODE,
          pipEnabled: parsed.pipEnabled !== false,
        }
      }
    } catch {
      state = { ...defaults }
    }
  }
  hydrated = true
  applyRuntime(state)
  emit()
  return state
}

export async function update(patch: Partial<Prefs>): Promise<Prefs> {
  state = { ...state, ...patch }
  hydrated = true
  applyRuntime(state)
  emit()
  const storage = resolveStorage()
  if (storage) {
    await storage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {})
  }
  return state
}

export function resetForTests(): void {
  state = { ...defaults }
  hydrated = false
  applyRuntime(state)
  emit()
}

export function filterSettingsGroups<R extends SettingsRowMeta>(
  groups: SettingsGroupMeta<R>[],
  query: string
): SettingsGroupMeta<R>[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return groups
  const filtered: SettingsGroupMeta<R>[] = []
  for (const group of groups) {
    const titleMatches = group.title.toLowerCase().includes(needle)
    const rows = titleMatches
      ? group.rows
      : group.rows.filter((row) => {
          const hay = [row.label, row.subtitle, row.value].filter(Boolean).join(' ').toLowerCase()
          return hay.includes(needle)
        })
    if (rows.length > 0) {
      filtered.push({ ...group, rows })
    }
  }
  return filtered
}
