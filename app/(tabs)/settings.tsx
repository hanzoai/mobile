import { Button, Input, ScrollView, Spinner, Text, XStack, YStack } from '@hanzo/gui'
import {
  Check,
  Cpu,
  ExternalLink,
  Eye,
  Globe,
  Info,
  Key,
  Layers,
  LogIn,
  LogOut,
  Palette,
  Server,
  Shield,
  Smartphone,
  Sparkles,
  Terminal,
  User,
  Wifi,
} from '@hanzogui/lucide-icons-2'
import Constants from 'expo-constants'
import * as Linking from 'expo-linking'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  SETTINGS_CARD_BG,
  SETTINGS_CARD_BORDER,
  SettingsItemRow,
  SettingsPillToggle,
  SettingsSearchInput,
  SettingsSectionCard,
} from '@/components/settings/primitives'
import { base, refuse } from '@/lib/api'
import { defaultModel, models } from '@/lib/models'
import * as prefs from '@/lib/prefs'
import * as store from '@/lib/store'

import type { ReactNode } from 'react'

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

type RenderedRow = prefs.SettingsRowMeta & {
  icon: ReactNode
  trailing?: ReactNode
  showChevron?: boolean
  onPress?: () => void
}

export default function Settings() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const currentPrefs = useSyncExternalStore(prefs.subscribe, prefs.snapshot)

  const [credential, setCredential] = useState<store.Credential | null | undefined>(undefined)
  const [model, setModel] = useState<string | null>(null)
  const [modelNote, setModelNote] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editingGateway, setEditingGateway] = useState(false)
  const [gatewayDraft, setGatewayDraft] = useState(currentPrefs.apiBase)
  const [editingNode, setEditingNode] = useState(false)
  const [nodeDraft, setNodeDraft] = useState(currentPrefs.localNodeUrl)
  const [nodeStatus, setNodeStatus] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      let live = true
      void prefs.hydrate().then((loaded) => {
        if (!live) return
        setGatewayDraft(loaded.apiBase)
        setNodeDraft(loaded.localNodeUrl)
      })
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
            setModelNote(ids.length ? null : 'Catalog empty')
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
    await prefs.update({ guestMode: false })
    setCredential(null)
    setModel(null)
    setModelNote(null)
    router.replace('/auth')
  }

  async function saveGateway() {
    const next = gatewayDraft.trim() || base
    await prefs.update({ apiBase: next })
    setGatewayDraft(next)
    setEditingGateway(false)
  }

  async function saveNode() {
    const next = nodeDraft.trim() || prefs.DEFAULT_LOCAL_NODE
    await prefs.update({ localNodeUrl: next, localNodeEnabled: true })
    setNodeDraft(next)
    setEditingNode(false)
    setNodeStatus('Checking…')
    try {
      const res = await fetch(`${next.replace(/\/+$/, '')}/v1/models`)
      setNodeStatus(res.ok ? 'Reachable' : `HTTP ${res.status}`)
    } catch {
      setNodeStatus('Offline')
    }
  }

  const payload = credential?.kind === 'iam' ? claims(credential.token) : null
  const email = said(payload, ['email', 'preferred_username'])
  const org = said(payload, ['org', 'org_name', 'org_id'])
  const version = Constants.expoConfig?.version ?? '2.3.5'

  const accountSubtitle =
    credential === undefined
      ? 'Checking device keychain…'
      : credential === null
        ? currentPrefs.guestMode
          ? 'Local / guest session · tap to sign in'
          : 'Not signed in on this device'
        : credential.kind === 'iam'
          ? [email ?? 'Hanzo ID SSO', org].filter(Boolean).join(' · ')
          : `API key ${credential.token.slice(0, 8)}…`

  const groups = useMemo<prefs.SettingsGroupMeta<RenderedRow>[]>(
    () => [
      {
        title: 'Account',
        rows: [
          {
            id: 'account-status',
            label: credential ? 'Hanzo Account' : 'Sign in to Hanzo',
            subtitle: accountSubtitle,
            value: credential ? (credential.kind === 'iam' ? 'Hanzo ID' : 'API Key') : 'Sign in',
            icon: credential ? <User size={16} color="#fafafa" /> : <LogIn size={16} color="#fafafa" />,
            trailing:
              credential === undefined ? (
                <Spinner size="small" color="$color10" />
              ) : credential === null ? (
                <Button
                  size="$2.5"
                  bg="#ffffff"
                  color="#09090b"
                  fontWeight="600"
                  fontSize={12}
                  rounded={9999}
                  px="$3"
                  onPress={() => router.push('/auth')}
                >
                  Sign in
                </Button>
              ) : (
                <Button
                  size="$2.5"
                  bg="#18181d"
                  borderWidth={1}
                  borderColor="rgba(255,255,255,0.1)"
                  color="#fafafa"
                  fontSize={12}
                  rounded={9999}
                  px="$3"
                  icon={<LogOut size={13} color="#fafafa" />}
                  onPress={out}
                >
                  {credential.kind === 'iam' ? 'Sign out' : 'Remove'}
                </Button>
              ),
            onPress: credential === null ? () => router.push('/auth') : undefined,
          },
          {
            id: 'account-issuer',
            label: 'Identity Provider',
            subtitle: 'OIDC PKCE · Google, GitHub & Email',
            value: 'hanzo.id',
            icon: <Shield size={16} color="#a1a1aa" />,
          },
          {
            id: 'account-keychain',
            label: 'Credential Storage',
            subtitle: 'Hardware-backed platform SecureStore',
            value: credential ? 'Active' : 'Empty',
            icon: <Key size={16} color="#a1a1aa" />,
          },
        ],
      },
      {
        title: 'Appearance',
        rows: [
          {
            id: 'appearance-theme',
            label: 'Theme',
            subtitle: 'True-black OLED canvas across all surfaces',
            value: 'Pure Black',
            icon: <Palette size={16} color="#a1a1aa" />,
          },
          {
            id: 'appearance-brand',
            label: 'UI Design System',
            subtitle: 'Shared Hanzo Dev & Desktop tokens',
            value: '@hanzo/gui',
            icon: <Sparkles size={16} color="#a1a1aa" />,
          },
          {
            id: 'appearance-pip',
            label: 'Live Run Picture-in-Picture',
            subtitle: 'Keep active agent & voice runs visible',
            value: currentPrefs.pipEnabled ? 'On' : 'Off',
            icon: <Layers size={16} color="#a1a1aa" />,
            trailing: (
              <SettingsPillToggle
                enabled={currentPrefs.pipEnabled}
                onToggle={() => void prefs.update({ pipEnabled: !currentPrefs.pipEnabled })}
              />
            ),
          },
        ],
      },
      {
        title: 'Models & API',
        rows: [
          {
            id: 'models-chat',
            label: 'Default Chat Model',
            subtitle: modelNote ?? 'Auto-selected from live /v1/models catalog',
            value: model ?? 'zen5',
            icon: <Cpu size={16} color="#a1a1aa" />,
          },
          {
            id: 'models-gen',
            label: 'Gen Coding Harness',
            subtitle: 'Cloud & local hanzod agentic sessions',
            value: 'enso-auto',
            icon: <Terminal size={16} color="#a1a1aa" />,
          },
          {
            id: 'models-vision',
            label: 'Multimodal Vision',
            subtitle: 'Used automatically when images are attached',
            value: 'zen-vl',
            icon: <Eye size={16} color="#a1a1aa" />,
          },
          {
            id: 'models-gateway',
            label: 'API Gateway',
            subtitle: currentPrefs.apiBase,
            value: editingGateway ? 'Editing' : 'Edit',
            icon: <Globe size={16} color="#a1a1aa" />,
            showChevron: !editingGateway,
            onPress: () => setEditingGateway((v) => !v),
          },
        ],
      },
      {
        title: 'Local Node',
        rows: [
          {
            id: 'local-enabled',
            label: 'Use Local hanzod Node',
            subtitle: 'Route Gen coding sessions to LAN or localhost node',
            value: currentPrefs.localNodeEnabled ? 'Enabled' : 'Off',
            icon: <Server size={16} color="#a1a1aa" />,
            trailing: (
              <SettingsPillToggle
                enabled={currentPrefs.localNodeEnabled}
                onToggle={() =>
                  void prefs.update({ localNodeEnabled: !currentPrefs.localNodeEnabled })
                }
              />
            ),
          },
          {
            id: 'local-endpoint',
            label: 'Node Endpoint',
            subtitle: currentPrefs.localNodeUrl,
            value: nodeStatus ?? (editingNode ? 'Editing' : 'Configure'),
            icon: <Wifi size={16} color="#a1a1aa" />,
            showChevron: !editingNode,
            onPress: () => setEditingNode((v) => !v),
          },
        ],
      },
      {
        title: 'About',
        rows: [
          {
            id: 'about-version',
            label: 'Version',
            subtitle: 'Hanzo Mobile Release',
            value: `v${version}`,
            icon: <Info size={16} color="#a1a1aa" />,
          },
          {
            id: 'about-package',
            label: 'Bundle Identifier',
            subtitle: 'Android & iOS Universal Binary',
            value: 'ai.hanzo.mobile',
            icon: <Smartphone size={16} color="#a1a1aa" />,
          },
          {
            id: 'about-privacy',
            label: 'Privacy & Terms',
            subtitle: 'hanzo.ai/privacy',
            value: 'Open',
            icon: <ExternalLink size={16} color="#a1a1aa" />,
            showChevron: true,
            onPress: () => void Linking.openURL('https://hanzo.ai/privacy'),
          },
        ],
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [credential, accountSubtitle, currentPrefs, model, modelNote, editingGateway, editingNode, nodeStatus, version]
  )

  const filtered = useMemo(() => prefs.filterSettingsGroups(groups, query), [groups, query])

  return (
    <ScrollView
      flex={1}
      bg="#000000"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        px: 18,
        pt: insets.top + 14,
        pb: Math.max(insets.bottom, 24) + 20,
      }}
    >
      <YStack gap="$4" width="100%" maxW={560} self="center">
        <YStack gap="$3">
          <Text color="#ffffff" fontSize={28} fontWeight="700" letterSpacing={-0.6}>
            Settings
          </Text>
          <SettingsSearchInput value={query} onChangeText={setQuery} />
        </YStack>

        {editingGateway ? (
          <YStack
            p="$3.5"
            bg={SETTINGS_CARD_BG}
            borderWidth={1}
            borderColor={SETTINGS_CARD_BORDER}
            rounded="$4"
            gap="$2.5"
          >
            <Text color="#fafafa" fontSize={13} fontWeight="600">
              API Gateway URL
            </Text>
            <XStack gap="$2" items="center">
              <Input
                flex={1}
                value={gatewayDraft}
                onChangeText={setGatewayDraft}
                placeholder="https://api.hanzo.ai"
                placeholderTextColor="$color10"
                bg="#000000"
                borderWidth={1}
                borderColor="rgba(255,255,255,0.12)"
                rounded="$3"
                height={40}
                color="#fafafa"
                fontSize={13}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button
                size="$3"
                height={40}
                bg="#ffffff"
                color="#09090b"
                fontWeight="600"
                rounded="$3"
                icon={<Check size={14} color="#09090b" />}
                onPress={saveGateway}
              >
                Save
              </Button>
            </XStack>
          </YStack>
        ) : null}

        {editingNode ? (
          <YStack
            p="$3.5"
            bg={SETTINGS_CARD_BG}
            borderWidth={1}
            borderColor={SETTINGS_CARD_BORDER}
            rounded="$4"
            gap="$2.5"
          >
            <Text color="#fafafa" fontSize={13} fontWeight="600">
              Local hanzod Endpoint
            </Text>
            <XStack gap="$2" items="center">
              <Input
                flex={1}
                value={nodeDraft}
                onChangeText={setNodeDraft}
                placeholder="http://127.0.0.1:3690"
                placeholderTextColor="$color10"
                bg="#000000"
                borderWidth={1}
                borderColor="rgba(255,255,255,0.12)"
                rounded="$3"
                height={40}
                color="#fafafa"
                fontSize={13}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button
                size="$3"
                height={40}
                bg="#ffffff"
                color="#09090b"
                fontWeight="600"
                rounded="$3"
                icon={<Check size={14} color="#09090b" />}
                onPress={saveNode}
              >
                Save
              </Button>
            </XStack>
          </YStack>
        ) : null}

        {filtered.length === 0 ? (
          <YStack
            p="$6"
            bg={SETTINGS_CARD_BG}
            borderWidth={1}
            borderColor={SETTINGS_CARD_BORDER}
            rounded="$4"
            items="center"
            gap="$1.5"
          >
            <Text color="#fafafa" fontSize={15} fontWeight="600">
              No results
            </Text>
            <Text color="rgba(250,250,250,0.5)" fontSize={13} text="center">
              No settings match “{query.trim()}”.
            </Text>
          </YStack>
        ) : (
          filtered.map((group) => (
            <SettingsSectionCard key={group.title} title={group.title}>
              {group.rows.map((row, idx) => (
                <SettingsItemRow
                  key={row.id}
                  icon={row.icon}
                  label={row.label}
                  subtitle={row.subtitle}
                  value={row.value}
                  trailing={row.trailing}
                  showChevron={row.showChevron}
                  isLast={idx === group.rows.length - 1}
                  onPress={row.onPress}
                />
              ))}
            </SettingsSectionCard>
          ))
        )}
      </YStack>
    </ScrollView>
  )
}
