import AsyncStorage from '@react-native-async-storage/async-storage'

import type { Message } from './message'

// The persisted transcript. Transcripts are not secrets, so AsyncStorage is
// the right shelf; the credential never comes near this file. One
// conversation for now — the tab chat. The private surface never calls this.

const slot = 'hanzo.chat'

// Data-URI images make transcripts heavy, so the persisted tail is short.
const keep = 200

export async function load(): Promise<Message[]> {
  try {
    const raw = await AsyncStorage.getItem(slot)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Message[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (m) => m && typeof m.id === 'string' && typeof m.text === 'string' &&
        (m.role === 'user' || m.role === 'assistant' || m.role === 'note')
    )
  } catch {
    // An unreadable transcript is an empty one — never crash the surface
    // over history.
    return []
  }
}

export async function save(messages: Message[]): Promise<void> {
  try {
    await AsyncStorage.setItem(slot, JSON.stringify(messages.slice(-keep)))
  } catch {
    // Persistence is best-effort; the live transcript on screen is the truth.
  }
}

export async function clear(): Promise<void> {
  try {
    await AsyncStorage.removeItem(slot)
  } catch {
    // Nothing to do — the next save overwrites whatever survived.
  }
}
