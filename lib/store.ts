import * as SecureStore from 'expo-secure-store'

// The one credential slot. Either an IAM session from hanzo.id or a pasted
// sk- API key — both are bearer values against api.hanzo.ai, so one shape
// holds both: token is what a request sends; refresh and exp exist only for
// the iam kind. Secrets live in the platform keychain only — never
// AsyncStorage, never a file.

const slot = 'hanzo.credential'

export type Credential = {
  kind: 'key' | 'iam'
  token: string
  refresh?: string
  exp?: number
}

export async function get(): Promise<Credential | null> {
  const raw = await SecureStore.getItemAsync(slot)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Credential
    if (parsed && typeof parsed.token === 'string' && (parsed.kind === 'key' || parsed.kind === 'iam')) {
      return parsed
    }
  } catch {
    // fall through — an unreadable slot is a cleared slot
  }
  // Never guess at a credential the keychain cannot faithfully return.
  await SecureStore.deleteItemAsync(slot)
  return null
}

export async function set(credential: Credential): Promise<void> {
  await SecureStore.setItemAsync(slot, JSON.stringify(credential))
}

export async function clear(): Promise<void> {
  await SecureStore.deleteItemAsync(slot)
}

// The bearer value a request sends, whichever kind is stored.
export async function token(): Promise<string | null> {
  const credential = await get()
  return credential?.token ?? null
}
