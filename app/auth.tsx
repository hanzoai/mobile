import { Button, Card, Input, Separator, Spinner, Text, XStack, YStack } from '@hanzo/gui'
import { exchangeCodeAsync, makeRedirectUri, useAuthRequest, useAutoDiscovery } from 'expo-auth-session'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg'

import { reason, refusal, v1 } from '@/lib/api'
import * as store from '@/lib/store'

// Closes the auth browser tab when the redirect lands back on the deep link.
WebBrowser.maybeCompleteAuthSession()

const SHELL_PATH =
  'M 248.00,24.00 L 776.00,24.00 C 905.92,24.00 1000.00,118.08 1000.00,248.00 L 1000.00,776.00 C 1000.00,905.92 905.92,1000.00 776.00,1000.00 L 248.00,1000.00 C 118.08,1000.00 24.00,905.92 24.00,776.00 L 24.00,248.00 C 24.00,118.08 118.08,24.00 248.00,24.00 Z'

const RIM_PATH =
  'M 249.00,31.00 L 775.00,31.00 C 901.44,31.00 993.00,122.56 993.00,249.00 L 993.00,775.00 C 993.00,901.44 901.44,993.00 775.00,993.00 L 249.00,993.00 C 122.56,993.00 31.00,901.44 31.00,775.00 L 31.00,249.00 C 31.00,122.56 122.56,31.00 249.00,31.00 Z'

// Canonical @hanzo/logo@1.0.29 Uniform Obsidian Glass Squircle (`hanzo-app.svg`).
function HanzoAppSquircle({ size = 64 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="Hanzo App">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#19191b" />
          <Stop offset="28%" stopColor="#09090a" />
          <Stop offset="100%" stopColor="#000000" />
        </LinearGradient>
        <RadialGradient id="topGlow" cx="50%" cy="6%" r="65%">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
          <Stop offset="45%" stopColor="#ffffff" stopOpacity="0.03" />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="rimGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
          <Stop offset="22%" stopColor="#ffffff" stopOpacity="0.12" />
          <Stop offset="75%" stopColor="#ffffff" stopOpacity="0.05" />
          <Stop offset="100%" stopColor="#ffffff" stopOpacity="0.10" />
        </LinearGradient>
        <LinearGradient id="glyphWhite" gradientUnits="userSpaceOnUse" x1="0" y1="220" x2="0" y2="800">
          <Stop offset="0%" stopColor="#ffffff" />
          <Stop offset="75%" stopColor="#f4f4f7" />
          <Stop offset="100%" stopColor="#d8d8e0" />
        </LinearGradient>
        <ClipPath id="shellClip">
          <Path d={SHELL_PATH} />
        </ClipPath>
      </Defs>
      <Path d={SHELL_PATH} fill="url(#bg)" />
      <Path d={SHELL_PATH} fill="url(#topGlow)" />
      <Path d={RIM_PATH} fill="none" stroke="url(#rimGrad)" strokeWidth="10" />
      <G clipPath="url(#shellClip)">
        <Rect x="224" y="224" width="192" height="192" fill="url(#glyphWhite)" />
        <Rect x="608" y="224" width="192" height="192" fill="url(#glyphWhite)" />
        <Rect x="224" y="608" width="192" height="192" fill="url(#glyphWhite)" />
        <Rect x="608" y="608" width="192" height="192" fill="url(#glyphWhite)" />
        <Polygon points="416,416 800,416 608,608 224,608" fill="url(#glyphWhite)" />
        <Polygon points="416,416 416,392 392,416" fill="#000000" fillOpacity="0.16" />
        <Polygon points="608,416 800,416 608,394" fill="#000000" fillOpacity="0.14" />
        <Polygon points="224,608 416,608 416,630" fill="#000000" fillOpacity="0.14" />
        <Polygon points="608,608 632,608 608,632" fill="#000000" fillOpacity="0.16" />
      </G>
    </Svg>
  )
}

function HanzoFooterMark({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 67 67" accessibilityLabel="Hanzo">
      <Path d="M22.21 67V44.6369H0V67H22.21Z" fill="#ffffff" />
      <Path d="M0 44.6369L22.21 46.8285V44.6369H0Z" fill="#DDDDDD" />
      <Path d="M66.7038 22.3184H22.2534L0.0878906 44.6367H44.4634L66.7038 22.3184Z" fill="#ffffff" />
      <Path d="M22.21 0H0V22.3184H22.21V0Z" fill="#ffffff" />
      <Path d="M66.7198 0H44.5098V22.3184H66.7198V0Z" fill="#ffffff" />
      <Path d="M66.6753 22.3185L44.5098 20.0822V22.3185H66.6753Z" fill="#DDDDDD" />
      <Path d="M66.7198 67V44.6369H44.5098V67H66.7198Z" fill="#ffffff" />
    </Svg>
  )
}

// Sign-in, both paths real: Hanzo IAM over OIDC PKCE against hanzo.id —
// never a custom flow — and a pasted API key proven against GET /v1/models
// before it is kept. The issuer and client id live in lib/store beside the
// credential they mint. Whatever the server refuses with is shown verbatim;
// invented sentences are how users end up debugging the wrong thing.
export default function Auth() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const discovery = useAutoDiscovery(store.issuer)
  // hanzo://oauth/mobile — the URI IAM's provisioning DERIVES for a desktop/mobile
  // client (<scheme>://oauth/<app>), so the registration and the app cannot
  // drift: neither side declares anything the convention does not already say.
  const redirect = makeRedirectUri({ scheme: 'hanzo', path: 'oauth/mobile' })
  const [request, response, prompt] = useAuthRequest(
    {
      clientId: store.client,
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
        `${said || 'Hanzo ID refused the sign-in.'} — if the ${store.client} client is not registered yet, paste an API key below instead.`
      )
      return
    }
    if (response.type !== 'success' || !discovery) return
    setExchanging(true)
    setIamNote(null)
    exchangeCodeAsync(
      {
        clientId: store.client,
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
        setIamNote(`${said} — if the ${store.client} client is not registered yet, paste an API key below instead.`)
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
    <YStack flex={1} bg="#000000">
      {/* Canonical flush top-left hanzo wordmark header matching hanzo.ai @ 28px */}
      <YStack
        width="100%"
        pt={insets.top}
        height={60 + insets.top}
        px={24}
        justify="center"
      >
        <Text
          color="#ffffff"
          fontSize={28}
          fontWeight="700"
          letterSpacing={-1.1}
          lineHeight={32}
          self="flex-start"
          selectable={false}
        >
          hanzo
        </Text>
      </YStack>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingVertical: 16,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <YStack width="100%" maxW={400} self="center" items="center" gap="$4">
            <YStack items="center" gap="$3.5" mb="$1" width="100%">
              <HanzoAppSquircle size={64} />
              <Text
                color="#ffffff"
                fontSize={24}
                fontWeight="600"
                letterSpacing={-0.6}
                text="center"
              >
                Sign in or Create Account
              </Text>
            </YStack>

            <YStack gap="$2.5" width="100%">
              <Button
                size="$4"
                height={48}
                bg="#ffffff"
                color="#09090b"
                fontWeight="600"
                fontSize={15}
                rounded={9999}
                pressStyle={{ opacity: 0.9, bg: '#f4f4f5' }}
                disabled={!request || !discovery || exchanging}
                onPress={() => {
                  setIamNote(null)
                  void prompt()
                }}
                icon={exchanging ? <Spinner color="#09090b" /> : undefined}
              >
                Continue with Hanzo ID
              </Button>
              <Text color="rgba(250,250,250,0.55)" fontSize={13} text="center">
                Google, GitHub, or Email via Hanzo ID
              </Text>
            </YStack>

            {iamNote ? (
              <Card
                width="100%"
                p="$3.5"
                bg="#09090b"
                borderWidth={1}
                borderColor="rgba(255,255,255,0.12)"
                rounded={12}
              >
                <Text color="#e4e4e7" fontSize={13} lineHeight={19}>
                  {iamNote}
                </Text>
              </Card>
            ) : null}

            <XStack width="100%" items="center" gap="$3" py="$1">
              <Separator flex={1} borderColor="rgba(255,255,255,0.1)" />
              <Text color="rgba(250,250,250,0.45)" fontSize={12}>
                or
              </Text>
              <Separator flex={1} borderColor="rgba(255,255,255,0.1)" />
            </XStack>

            <YStack gap="$2.5" width="100%">
              <Input
                value={key}
                onChangeText={(value: string) => {
                  setKey(value)
                  setKeyNote(null)
                }}
                placeholder="sk-..."
                placeholderTextColor="$color10"
                bg="#09090b"
                borderWidth={1}
                borderColor="rgba(255,255,255,0.12)"
                height={46}
                px={14}
                rounded={12}
                color="#ffffff"
                fontSize={15}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={probe}
                returnKeyType="go"
              />
              <Button
                size="$4"
                height={46}
                bg="#141417"
                borderWidth={1}
                borderColor="rgba(255,255,255,0.12)"
                color="#ffffff"
                fontWeight="600"
                fontSize={15}
                rounded={12}
                pressStyle={{ opacity: 0.88, bg: '#1c1c20' }}
                disabled={!key.trim() || probing}
                onPress={probe}
                icon={probing ? <Spinner color="#ffffff" /> : undefined}
              >
                Use API key
              </Button>
              <Text color="rgba(250,250,250,0.45)" fontSize={12} lineHeight={17} text="center">
                Keys are checked against api.hanzo.ai and kept in the device keychain.
              </Text>
            </YStack>

            {keyNote ? (
              <Card
                width="100%"
                p="$3.5"
                bg="#09090b"
                borderWidth={1}
                borderColor="rgba(255,255,255,0.12)"
                rounded={12}
              >
                <Text color="#e4e4e7" fontSize={13} lineHeight={19}>
                  {keyNote}
                </Text>
              </Card>
            ) : null}
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>

      <YStack
        width="100%"
        items="center"
        justify="center"
        gap="$2"
        pt="$2"
        pb={Math.max(insets.bottom, 16)}
      >
        <HanzoFooterMark size={20} />
        <Text color="rgba(250,250,250,0.45)" fontSize={12}>
          © {new Date().getFullYear()} Hanzo AI
        </Text>
      </YStack>
    </YStack>
  )
}
