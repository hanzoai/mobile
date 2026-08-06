import * as SecureStore from 'expo-secure-store'

// The one credential slot. Either an IAM session from hanzo.id or a pasted
// sk- API key — both are bearer values against api.hanzo.ai. Secrets live in
// the platform keychain only: never AsyncStorage, never a file.

const slot = 'hanzo.credential'

export type Credential =
  | { kind: 'iam'; access: string; refresh?: string; expires?: number }
  | { kind: 'key'; key: string }

export async function get(): Promise<Credential | null> {
  const raw = await SecureStore.getItemAsync(slot)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Credential
  } catch {
    // An unreadable slot is a cleared slot — never guess at a credential.
    await SecureStore.deleteItemAsync(slot)
    return null
  }
}

export async function set(credential: Credential): Promise<void> {
  await SecureStore.setItemAsync(slot, JSON.stringify(credential))
}

export async function clear(): Promise<void> {
  await SecureStore.deleteItemAsync(slot)
}

// The bearer value a request actually sends, whichever kind is stored.
export async function token(): Promise<string | null> {
  const credential = await get()
  if (!credential) return null
  return credential.kind === 'key' ? credential.key : credential.access
}
