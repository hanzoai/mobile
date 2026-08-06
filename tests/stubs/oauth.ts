// expo-auth-session stand-in: lib/store imports refreshAsync to renew IAM
// sessions. No unit test drives that path, so reaching this is a test bug —
// throwing is more honest than faking a grant.
export async function refreshAsync(): Promise<never> {
  throw new Error('refreshAsync has no stub; the test must install behavior')
}
