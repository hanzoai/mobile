import { Button, Card, ScrollView, Separator, Spinner, Text, XStack, YStack } from '@hanzo/gui'
import Constants from 'expo-constants'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { refuse } from '@/lib/api'
import { defaultModel, models } from '@/lib/models'
import * as store from '@/lib/store'

// The IAM access token is a JWT; its payload names the account. Read
// strictly and degrade to null — a token that does not parse still signs
// requests fine, so the card then states the kind and nothing invented.
function claims(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1]
  if (!part || typeof atob !== 'function') return null
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const parsed: unknown = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function said(source: Record<string, unknown> | null, keys: string[]): string | null {
  for (const key of keys) {
    const value = source?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function Label({ children }: { children: string }) {
  return (
    <Text color="$color11" fontSize={12} fontWeight="600" letterSpacing={1.2} mt="$2">
      {children.toUpperCase()}
    </Text>
  )
}

function Row({ name, value }: { name: string; value: string }) {
  return (
    <XStack items="center" justify="space-between" py="$2.5" gap="$3">
      <Text color="$color11" fontSize={14}>
        {name}
      </Text>
      <Text color="$color" fontSize={14} numberOfLines={1} shrink={1}>
        {value}
      </Text>
    </XStack>
  )
}

export default function Settings() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  // undefined is the first read only; null is honestly signed out.
  const [credential, setCredential] = useState<store.Credential | null | undefined>(undefined)
  const [model, setModel] = useState<string | null>(null)
  const [modelNote, setModelNote] = useState<string | null>(null)

  // Re-read on every focus so a sign-in on /auth or a cleared key elsewhere
  // shows here without a restart.
  useFocusEffect(
    useCallback(() => {
      let live = true
      store.get().then((stored) => {
        if (!live) return
        setCredential(stored)
        if (!stored) {
          setModel(null)
          setModelNote(null)
          return
        }
        models()
          .then((ids) => {
            if (!live) return
            setModel(defaultModel(ids))
            setModelNote(ids.length ? null : 'The catalog returned no models.')
          })
          .catch((error) => {
            if (!live) return
            setModel(null)
            setModelNote(refuse(error).message)
          })
      })
      return () => {
        live = false
      }
    }, [])
  )

  async function out() {
    await store.clear()
    setCredential(null)
    setModel(null)
    setModelNote(null)
  }

  const payload = credential?.kind === 'iam' ? claims(credential.token) : null
  const email = said(payload, ['email', 'preferred_username'])
  const org = said(payload, ['org', 'org_name', 'org_id'])
  const version = Constants.expoConfig?.version ?? '0.0.0'

  return (
    <ScrollView flex={1} bg="$background" contentContainerStyle={{ p: 20, pt: insets.top + 16, pb: 32 }}>
      <YStack gap="$3">
        <Text color="$color" fontSize={28} fontWeight="700">
          Settings
        </Text>

        <Label>Account</Label>
        {credential === undefined ? (
          <XStack p="$4" justify="center">
            <Spinner color="$color11" />
          </XStack>
        ) : credential === null ? (
          <Card p="$4" bg="$color2" borderWidth={1} borderColor="$borderColor" rounded="$6">
            <Text color="$color" fontSize={15} fontWeight="600">
              Signed out
            </Text>
            <Text color="$color11" mt="$1.5" fontSize={13} lineHeight={19}>
              Nothing is signed in on this device. Use Hanzo ID or paste an sk- API key.
            </Text>
            <Button mt="$3" self="flex-start" size="$3" bg="$color" color="$background" onPress={() => router.push('/auth')}>
              Sign in
            </Button>
          </Card>
        ) : (
          <Card px="$4" py="$2" bg="$color2" borderWidth={1} borderColor="$borderColor" rounded="$6">
            {credential.kind === 'iam' ? (
              <>
                <Row name="Identity" value="Hanzo ID" />
                {email ? (
                  <>
                    <Separator borderColor="$borderColor" />
                    <Row name="Email" value={email} />
                  </>
                ) : null}
                {org ? (
                  <>
                    <Separator borderColor="$borderColor" />
                    <Row name="Org" value={org} />
                  </>
                ) : null}
              </>
            ) : (
              <Row name="API key" value={`${credential.token.slice(0, 8)}…`} />
            )}
            <Separator borderColor="$borderColor" />
            <Button my="$2.5" self="flex-start" size="$3" bg="$color3" color="$color" onPress={out}>
              {credential.kind === 'iam' ? 'Sign out' : 'Remove key'}
            </Button>
          </Card>
        )}

        <Label>Model</Label>
        <Card px="$4" py="$2" bg="$color2" borderWidth={1} borderColor="$borderColor" rounded="$6">
          {credential ? (
            model ? (
              <Row name="Default chat model" value={model} />
            ) : (
              <Text color="$color11" py="$2.5" fontSize={13} lineHeight={19}>
                {modelNote ?? 'Loading the live catalog.'}
              </Text>
            )
          ) : (
            <Text color="$color11" py="$2.5" fontSize={13} lineHeight={19}>
              The default is picked from the live catalog once a credential exists.
            </Text>
          )}
        </Card>

        <Label>About</Label>
        <Card px="$4" py="$2" bg="$color2" borderWidth={1} borderColor="$borderColor" rounded="$6">
          <Row name="Version" value={version} />
          <Separator borderColor="$borderColor" />
          <Row name="API" value="api.hanzo.ai" />
          <Separator borderColor="$borderColor" />
          <Row name="Identity" value="hanzo.id" />
        </Card>
      </YStack>
    </ScrollView>
  )
}
