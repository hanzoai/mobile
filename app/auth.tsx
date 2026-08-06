import { Button, Card, Input, Separator, Spinner, Text, XStack, YStack } from '@hanzo/gui'
import { exchangeCodeAsync, makeRedirectUri, useAuthRequest, useAutoDiscovery } from 'expo-auth-session'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { reason, refusal, v1 } from '@/lib/api'
import * as store from '@/lib/store'

// Closes the auth browser tab when the redirect lands back on hanzo://auth.
WebBrowser.maybeCompleteAuthSession()

const issuer = 'https://hanzo.id'
const client = 'hanzo-mobile'

// Sign-in, both paths real: Hanzo IAM over OIDC PKCE against hanzo.id —
// never a custom flow — and a pasted API key proven against GET /v1/models
// before it is kept. Whatever the server refuses with is shown verbatim;
// invented sentences are how users end up debugging the wrong thing.
export default function Auth() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const discovery = useAutoDiscovery(issuer)
  const redirect = makeRedirectUri({ scheme: 'hanzo', path: 'auth' })
  const [request, response, prompt] = useAuthRequest(
    {
      clientId: client,
      redirectUri: redirect,
      scopes: ['openid', 'profile', 'email', 'offline_access'],
    },
    discovery
  )

  const [iamNote, setIamNote] = useState<string | null>(null)
  const [exchanging, setExchanging] = useState(false)
  const [key, setKey] = useState('')
  const [keyNote, setKeyNote] = useState<string | null>(null)
  const [probing, setProbing] = useState(false)

  useEffect(() => {
    if (!response) return
    if (response.type === 'error') {
      const error = response.error
      const said = [error?.code, error?.description ?? error?.message].filter(Boolean).join(': ')
      setIamNote(
        `${said || 'Hanzo ID refused the sign-in.'} — if the ${client} client is not registered yet, paste an API key below instead.`
      )
      return
    }
    if (response.type !== 'success' || !discovery) return
    setExchanging(true)
    setIamNote(null)
    exchangeCodeAsync(
      {
        clientId: client,
        code: response.params.code ?? '',
        redirectUri: redirect,
        extraParams: request?.codeVerifier ? { code_verifier: request.codeVerifier } : {},
      },
      discovery
    )
      .then(async (granted) => {
        await store.set({
          kind: 'iam',
          token: granted.accessToken,
          refresh: granted.refreshToken,
          exp: granted.expiresIn ? (granted.issuedAt + granted.expiresIn) * 1000 : undefined,
        })
        router.replace('/')
      })
      .catch((error: unknown) => {
        const said = error instanceof Error ? error.message : String(error)
        setIamNote(`${said} — if the ${client} client is not registered yet, paste an API key below instead.`)
      })
      .finally(() => setExchanging(false))
    // The response object is the whole story; request and discovery are
    // stable for a given response.
  }, [response]) // eslint-disable-line react-hooks/exhaustive-deps

  // The pasted key is proven before it is kept: 200 from /v1/models keeps
  // it, anything else shows the estate refusal with the server's sentence.
  async function probe() {
    const value = key.trim()
    if (!value || probing) return
    setProbing(true)
    setKeyNote(null)
    try {
      const checked = await fetch(v1('/models'), { headers: { Authorization: `Bearer ${value}` } })
      if (checked.ok) {
        await store.set({ kind: 'key', token: value })
        router.replace('/')
        return
      }
      const body = await checked.text().catch(() => '')
      setKeyNote(refusal(checked.status, reason(body)).message)
    } catch {
      setKeyNote('Could not reach api.hanzo.ai. Check the connection and try again.')
    } finally {
      setProbing(false)
    }
  }

  return (
    <YStack flex={1} bg="$background" pt={insets.top} pb={insets.bottom} px="$5" justify="center">
      <YStack items="center" mb="$6">
        <Text color="$color" fontSize={28} fontWeight="700" letterSpacing={-0.5}>
          Hanzo
        </Text>
        <Text color="$color10" fontSize={14} mt="$2">
          Sign in to start building
        </Text>
      </YStack>

      <YStack gap="$4" width="100%" maxW={420} self="center">
        <Button
          size="$4"
          bg="$color"
          color="$background"
          rounded="$6"
          disabled={!request || !discovery || exchanging}
          onPress={() => {
            setIamNote(null)
            void prompt()
          }}
          icon={exchanging ? <Spinner color="$background" /> : undefined}
        >
          Continue with Hanzo ID
        </Button>

        {iamNote ? (
          <Card p="$3.5" bg="$color2" borderWidth={1} borderColor="$borderColor" rounded="$4">
            <Text color="$color11" fontSize={13} lineHeight={19}>
              {iamNote}
            </Text>
          </Card>
        ) : null}

        <XStack items="center" gap="$3">
          <Separator borderColor="$borderColor" />
          <Text color="$color10" fontSize={12}>
            or
          </Text>
          <Separator borderColor="$borderColor" />
        </XStack>

        <YStack gap="$2.5">
          <Input
            value={key}
            onChangeText={(value: string) => {
              setKey(value)
              setKeyNote(null)
            }}
            placeholder="sk-..."
            placeholderTextColor="$color10"
            bg="$color2"
            borderWidth={1}
            borderColor="$borderColor"
            rounded="$6"
            color="$color"
            fontSize={15}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={probe}
            returnKeyType="go"
          />
          <Button
            size="$4"
            bg="$color3"
            color="$color"
            rounded="$6"
            disabled={!key.trim() || probing}
            onPress={probe}
            icon={probing ? <Spinner color="$color" /> : undefined}
          >
            Use API key
          </Button>
          <Text color="$color10" fontSize={12} lineHeight={17}>
            Keys are checked against api.hanzo.ai and kept in the device keychain.
          </Text>
        </YStack>

        {keyNote ? (
          <Card p="$3.5" bg="$color2" borderWidth={1} borderColor="$borderColor" rounded="$4">
            <Text color="$color11" fontSize={13} lineHeight={19}>
              {keyNote}
            </Text>
          </Card>
        ) : null}
      </YStack>
    </YStack>
  )
}
