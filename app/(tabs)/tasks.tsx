import { Button, ScrollView, Spinner, Text, XStack, YStack } from '@hanzo/gui'
import { ImagePlus } from '@hanzogui/lucide-icons-2'
import { router } from 'expo-router'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { RefreshControl } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Note, Refuse } from '@/components/tasks/note'
import { Run } from '@/components/tasks/run'
import { Session } from '@/components/tasks/session'
import * as runs from '@/lib/runs'
import * as sessions from '@/lib/sessions'
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

  const load = useCallback(async () => {
    setCloud(await sessions.load())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load()
    } finally {
      setRefreshing(false)
    }
  }, [load])

  return (
    <ScrollView
      flex={1}
      bg="$background"
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

        <Label>Local runs</Label>
        {live.length === 0 ? (
          <Note
            title="Nothing is running"
            detail="Work this app starts — a chat turn, an image, a voice session — shows here live."
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
            detail="Cloud sessions belong to an account. Add a credential in Settings to see yours."
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
            detail="Agents running in the Hanzo cloud land here. None exist for this account right now."
          />
        ) : (
          cloud.sessions.map((session) => <Session key={session.id} session={session} />)
        )}
      </YStack>
    </ScrollView>
  )
}
