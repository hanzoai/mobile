import { Button, Card, Input, ScrollView, Spinner, Text, TextArea, XStack, YStack } from '@hanzo/gui'
import { ImagePlus, Terminal } from '@hanzogui/lucide-icons-2'
import { router } from 'expo-router'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { RefreshControl } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Note, Refuse } from '@/components/tasks/note'
import { Run } from '@/components/tasks/run'
import { Session } from '@/components/tasks/session'
import type { Refusal } from '@/lib/api'
import * as gen from '@/lib/gen'
import * as runs from '@/lib/runs'
import type * as sessions from '@/lib/sessions'
import { dim, fg } from '@/lib/theme'

function Label({ children }: { children: string }) {
  return (
    <Text color="$color11" fontSize={12} fontWeight="600" letterSpacing={1.2} mt="$2">
      {children.toUpperCase()}
    </Text>
  )
}

export default function Tasks() {
  const insets = useSafeAreaInsets()
  const live = useSyncExternalStore(runs.subscribe, runs.live)
  const history = useSyncExternalStore(runs.subscribe, runs.history)

  // null is the first load only; afterwards the last answer stays visible
  // while a pull refreshes it.
  const [cloud, setCloud] = useState<sessions.Load | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Unified `gen` coding task launcher state.
  const [prompt, setPrompt] = useState('')
  const [repo, setRepo] = useState('')
  const [launching, setLaunching] = useState(false)
  const [launchFault, setLaunchFault] = useState<Refusal | null>(null)

  const load = useCallback(async () => {
    await runs.hydrate()
    setCloud(await gen.sync())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const hasLiveTask = live.some((run) => run.kind === 'task')
  useEffect(() => {
    if (!hasLiveTask) return
    const timer = setInterval(() => {
      void load()
    }, 5000)
    return () => clearInterval(timer)
  }, [hasLiveTask, load])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }, [load])

  async function launch() {
    const asked = prompt.trim()
    if (!asked || launching) return
    setLaunching(true)
    setLaunchFault(null)
    try {
      const out = await gen.start({ prompt: asked, repo })
      if (out.kind === 'anon') {
        setCloud({ kind: 'anon' })
        return
      }
      if (out.kind === 'refused') {
        setLaunchFault(out.refusal)
        return
      }
      setPrompt('')
      await load()
    } finally {
      setLaunching(false)
    }
  }

  const readyToLaunch = !launching && prompt.trim().length > 0

  return (
    <ScrollView
      flex={1}
      bg="$background"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={dim} colors={[fg]} />
      }
      contentContainerStyle={{ p: 20, pt: insets.top + 16, pb: 32 }}
    >
      <YStack gap="$3">
        <XStack items="center" justify="space-between">
          <Text color="$color" fontSize={28} fontWeight="700">
            Tasks
          </Text>
          <Button
            chromeless
            circular
            icon={<ImagePlus size={20} color="$color11" />}
            onPress={() => router.push('/image')}
            aria-label="Generate an image"
          />
        </XStack>

        {cloud !== null && cloud.kind !== 'anon' ? (
          <>
            <Label>Gen agent</Label>
            <Card p="$3.5" bg="$color2" borderWidth={1} borderColor="$borderColor" rounded="$6" gap="$2.5">
              <TextArea
                value={prompt}
                onChangeText={setPrompt}
                placeholder="Describe what Gen should build or fix…"
                placeholderTextColor="$color10"
                color="$color"
                bg="$background"
                borderColor="$borderColor"
                rounded="$5"
                minH={72}
              />
              <XStack items="center" gap="$2">
                <Input
                  flex={1}
                  value={repo}
                  onChangeText={setRepo}
                  placeholder="owner/repo (optional)"
                  placeholderTextColor="$color10"
                  color="$color"
                  bg="$background"
                  borderColor="$borderColor"
                  rounded="$5"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Button
                  size="$3"
                  bg={readyToLaunch ? '$color' : '$color3'}
                  color={readyToLaunch ? '$background' : '$color10'}
                  disabled={!readyToLaunch}
                  icon={launching ? <Spinner color="$color11" /> : <Terminal size={15} />}
                  onPress={launch}
                >
                  {launching ? 'Starting…' : 'Start Gen'}
                </Button>
              </XStack>
              {launchFault ? <Refuse refusal={launchFault} /> : null}
            </Card>
          </>
        ) : null}

        <Label>Local runs</Label>
        {live.length === 0 ? (
          <Note
            title="Nothing is running"
            detail="Work this app starts — a Gen coding task, a chat turn, an image, a voice session — shows here live."
          />
        ) : (
          live.map((run) => <Run key={run.id} run={run} />)
        )}
        {history.length > 0 ? (
          <>
            <Label>Recent</Label>
            {history.map((run) => (
              <Run key={run.id} run={run} />
            ))}
          </>
        ) : null}

        <Label>Cloud sessions</Label>
        {cloud === null ? (
          <XStack p="$4" justify="center">
            <Spinner color="$color11" />
          </XStack>
        ) : cloud.kind === 'anon' ? (
          <Note
            title="Signed out"
            detail="Cloud sessions belong to an account. Add a credential in Settings to start Gen tasks and see yours."
          >
            <Button mt="$3" self="flex-start" size="$3" onPress={() => router.push('/(tabs)/settings')}>
              Open Settings
            </Button>
          </Note>
        ) : cloud.kind === 'refused' ? (
          <Refuse refusal={cloud.refusal} />
        ) : cloud.sessions.length === 0 ? (
          <Note
            title="No cloud sessions"
            detail="Agents running in the Hanzo cloud land here. Start a Gen task above to launch one."
          />
        ) : (
          cloud.sessions.map((session) => (
            <Session key={session.id} session={session} onSteered={load} />
          ))
        )}
      </YStack>
    </ScrollView>
  )
}
