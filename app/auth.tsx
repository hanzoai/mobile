import { Button, Card, Input, Separator, Spinner, Text, XStack, YStack } from '@hanzo/gui'
import { exchangeCodeAsync, makeRedirectUri, useAuthRequest, useAutoDiscovery } from 'expo-auth-session'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg'

import { currentBase, reason, refusal, v1 } from '@/lib/api'
import * as prefs from '@/lib/prefs'
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

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  )
}

function GitHubIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12c0 4.64 3.01 8.57 7.18 9.96.53.1.72-.23.72-.51v-1.8c-2.92.63-3.54-1.41-3.54-1.41-.48-1.21-1.17-1.53-1.17-1.53-.95-.65.07-.64.07-.64 1.05.07 1.61 1.08 1.61 1.08.94 1.6 2.46 1.14 3.06.87.1-.68.37-1.14.67-1.4-2.33-.27-4.78-1.17-4.78-5.19 0-1.15.41-2.08 1.08-2.82-.11-.27-.47-1.34.1-2.79 0 0 .88-.28 2.89 1.08a10.03 10.03 0 0 1 5.26 0c2.01-1.36 2.89-1.08 2.89-1.08.57 1.45.21 2.52.1 2.79.67.74 1.08 1.67 1.08 2.82 0 4.03-2.46 4.92-4.8 5.18.38.33.72.97.72 1.96v2.9c0 .28.19.62.73.51A10.51 10.51 0 0 0 22.5 12C22.5 6.2 17.8 1.5 12 1.5Z"
        fill="#ffffff"
      />
    </Svg>
  )
}

// Sign-in, all paths real: Hanzo IAM over OIDC PKCE against hanzo.id (direct or
// federated via Google / GitHub), a pasted API key proven against GET /v1/models
// before it is kept, and local/offline entry into the app & Settings.
export default function Auth() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const discovery = useAutoDiscovery(store.issuer)
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
        await prefs.update({ guestMode: false })
        router.replace('/')
      })
      .catch((error: unknown) => {
        const said = error instanceof Error ? error.message : String(error)
        setIamNote(`${said} — if the ${store.client} client is not registered yet, paste an API key below instead.`)
      })
      .finally(() => setExchanging(false))
  }, [response]) // eslint-disable-line react-hooks/exhaustive-deps

  function startOidc(provider?: 'google' | 'github') {
    setIamNote(null)
    const targetUrl =
      provider && request?.url
        ? `${request.url}${request.url.includes('?') ? '&' : '?'}provider=${provider}`
        : undefined
    void prompt(targetUrl ? { url: targetUrl } : undefined)
  }

  async function probe() {
    const value = key.trim()
    if (!value || probing) return
    setProbing(true)
    setKeyNote(null)
    try {
      const checked = await fetch(v1('/models'), { headers: { Authorization: `Bearer ${value}` } })
      if (checked.ok) {
        await store.set({ kind: 'key', token: value })
        await prefs.update({ guestMode: false })
        router.replace('/')
        return
      }
      const body = await checked.text().catch(() => '')
      setKeyNote(refusal(checked.status, reason(body)).message)
    } catch {
      const host = currentBase().replace(/^https?:\/\//, '')
      setKeyNote(`Could not reach ${host}. Check the connection or configure a custom gateway in Settings.`)
    } finally {
      setProbing(false)
    }
  }

  async function continueWithoutSigningIn() {
    await prefs.update({ guestMode: true })
    router.replace('/')
  }

  const oauthDisabled = !request || !discovery || exchanging

  return (
    <YStack flex={1} bg="#000000" pt={insets.top} pb={Math.max(insets.bottom, 16)}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingVertical: 20,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <YStack width="100%" maxW={380} self="center" items="center" gap="$4">
            <YStack items="center" gap="$3.5" mb="$1" width="100%">
              <HanzoAppSquircle size={64} />
              <Text
                color="#ffffff"
                fontSize={24}
                fontWeight="600"
                letterSpacing={-0.6}
                text="center"
              >
                Sign in to Hanzo
              </Text>
            </YStack>

            <YStack gap="$2.5" width="100%">
              <Button
                size="$4"
                height={46}
                bg="#0d0d10"
                borderWidth={1}
                borderColor="rgba(255,255,255,0.12)"
                color="#ffffff"
                fontWeight="600"
                fontSize={15}
                rounded={12}
                pressStyle={{ opacity: 0.9, bg: '#16161b' }}
                disabled={oauthDisabled}
                onPress={() => startOidc('google')}
                icon={<GoogleIcon />}
              >
                Continue with Google
              </Button>

              <Button
                size="$4"
                height={46}
                bg="#0d0d10"
                borderWidth={1}
                borderColor="rgba(255,255,255,0.12)"
                color="#ffffff"
                fontWeight="600"
                fontSize={15}
                rounded={12}
                pressStyle={{ opacity: 0.9, bg: '#16161b' }}
                disabled={oauthDisabled}
                onPress={() => startOidc('github')}
                icon={<GitHubIcon />}
              >
                Continue with GitHub
              </Button>

              <Button
                size="$4"
                height={46}
                bg="#ffffff"
                color="#09090b"
                fontWeight="600"
                fontSize={15}
                rounded={12}
                pressStyle={{ opacity: 0.9, bg: '#f4f4f5' }}
                disabled={oauthDisabled}
                onPress={() => startOidc()}
                icon={exchanging ? <Spinner color="#09090b" /> : undefined}
              >
                Continue with Hanzo ID
              </Button>
            </YStack>

            {iamNote ? (
              <Card
                width="100%"
                p="$3.5"
                bg="#0d0d10"
                borderWidth={1}
                borderColor="rgba(255,255,255,0.1)"
                rounded={12}
              >
                <Text color="#e4e4e7" fontSize={13} lineHeight={19}>
                  {iamNote}
                </Text>
              </Card>
            ) : null}

            <XStack width="100%" items="center" gap="$3" py="$0.5">
              <Separator flex={1} borderColor="rgba(255,255,255,0.08)" />
              <Text color="rgba(250,250,250,0.45)" fontSize={12}>
                or
              </Text>
              <Separator flex={1} borderColor="rgba(255,255,255,0.08)" />
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
                bg="#0d0d10"
                borderWidth={1}
                borderColor="rgba(255,255,255,0.1)"
                height={44}
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
                height={44}
                bg="#141419"
                borderWidth={1}
                borderColor="rgba(255,255,255,0.1)"
                color="#ffffff"
                fontWeight="600"
                fontSize={14}
                rounded={12}
                pressStyle={{ opacity: 0.88, bg: '#1c1c22' }}
                disabled={!key.trim() || probing}
                onPress={probe}
                icon={probing ? <Spinner color="#ffffff" /> : undefined}
              >
                Use API key
              </Button>
            </YStack>

            {keyNote ? (
              <Card
                width="100%"
                p="$3.5"
                bg="#0d0d10"
                borderWidth={1}
                borderColor="rgba(255,255,255,0.1)"
                rounded={12}
              >
                <Text color="#e4e4e7" fontSize={13} lineHeight={19}>
                  {keyNote}
                </Text>
              </Card>
            ) : null}

            <Button
              chromeless
              size="$3"
              height={38}
              color="rgba(250,250,250,0.55)"
              fontSize={13}
              onPress={continueWithoutSigningIn}
            >
              Continue without signing in
            </Button>
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
    </YStack>
  )
}
