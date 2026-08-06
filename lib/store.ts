import { refreshAsync } from 'expo-auth-session'
import * as SecureStore from 'expo-secure-store'

// The one credential slot. Either an IAM session from hanzo.id or a pasted
// sk- API key — both are bearer values against api.hanzo.ai, so one shape
// holds both: token is what a request sends; refresh and exp exist only for
// the iam kind. Secrets live in the platform keychain only — never
// AsyncStorage, never a file.

// The identity constants live with the credential they mint: auth.tsx signs
// in with them, token() below renews with them.
export const issuer = 'https://hanzo.id'
export const client = 'hanzo-mobile'

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

// A session is renewed a minute before exp so a token never leaves this
// device already dead or dies in flight.
const margin = 60_000

let renewing: Promise<Credential | null> | null = null

// Spends the refresh token against hanzo.id — the same native IAM grant the
// sign-in used, never a custom flow — and keeps the rotated pair. Concurrent
// callers share one exchange, because IAM refresh tokens can be single-use
// and a stampede would revoke the session it was trying to save. Failure
// resolves null and changes nothing: the stored token goes out as-is, and
// the server's own 401 becomes the estate's credential refusal.
function renew(credential: Credential): Promise<Credential | null> {
  renewing ??= refreshAsync(
    { clientId: client, refreshToken: credential.refresh },
    { tokenEndpoint: `${issuer}/v1/iam/oauth/token` }
  )
    .then(async (granted) => {
      const next: Credential = {
        kind: 'iam',
        token: granted.accessToken,
        // IAM may rotate the refresh token or keep it; hold the newest one.
        refresh: granted.refreshToken ?? credential.refresh,
        exp: granted.expiresIn ? (granted.issuedAt + granted.expiresIn) * 1000 : undefined,
      }
      await set(next)
      return next
    })
    .catch(() => null)
    .finally(() => {
      renewing = null
    })
  return renewing
}

// The bearer value a request sends, whichever kind is stored. An aging IAM
// session renews itself through its refresh token first; a pasted key
// passes straight through.
export async function token(): Promise<string | null> {
  const credential = await get()
  if (!credential) return null
  if (credential.kind === 'iam' && credential.refresh && credential.exp && credential.exp - Date.now() < margin) {
    const renewed = await renew(credential)
    if (renewed) return renewed.token
  }
  return credential.token
}
