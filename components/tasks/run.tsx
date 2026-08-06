import { Card, Text, XStack, YStack } from '@hanzo/gui'
import { Image as Picture, ListChecks, MessageCircle, Mic } from '@hanzogui/lucide-icons-2'
import { Image } from 'expo-image'
import { useEffect, useState } from 'react'

import type * as runs from '@/lib/runs'

const icons: Record<runs.Kind, typeof Mic> = {
  chat: MessageCircle,
  image: Picture,
  voice: Mic,
  task: ListChecks,
}

// m:ss under an hour, h:mm:ss over it.
function elapsed(from: number, to: number): string {
  const s = Math.max(0, Math.floor((to - from) / 1000))
  const ss = String(s % 60).padStart(2, '0')
  const m = Math.floor(s / 60) % 60
  const h = Math.floor(s / 3600)
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

export function Run({ run }: { run: runs.Run }) {
  const Icon = icons[run.kind]
  const failed = run.phase === 'error'
  const [now, setNow] = useState(() => Date.now())

  // A live card ticks its own clock; a finished one holds its final time, so
  // nothing re-renders for work that is over.
  useEffect(() => {
    if (run.done) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [run.done])

  const fraction =
    typeof run.progress === 'number' && !run.done
      ? Math.min(1, Math.max(0, run.progress))
      : null

  return (
    <Card
      p="$3.5"
      bg="$color2"
      borderWidth={1}
      borderColor="$borderColor"
      rounded="$6"
      opacity={run.done && !failed ? 0.6 : 1}
    >
      <XStack items="center" gap="$3">
        {run.thumb ? (
          <Image
            source={{ uri: run.thumb }}
            style={{ width: 40, height: 40, borderRadius: 8 }}
            contentFit="cover"
          />
        ) : (
          <YStack width={40} height={40} rounded={8} bg="$color4" items="center" justify="center">
            <Icon size={18} color="$color11" />
          </YStack>
        )}
        <YStack flex={1} gap="$1">
          <Text color="$color" fontSize={15} fontWeight="600" numberOfLines={1}>
            {run.title}
          </Text>
          <XStack items="center" gap="$2">
            <Text color={failed ? '$red10' : '$color11'} fontSize={12} numberOfLines={1} shrink={1}>
              {run.phase}
            </Text>
            <Text color="$color11" fontSize={12}>
              {elapsed(run.startedAt, run.endedAt ?? now)}
            </Text>
          </XStack>
        </YStack>
      </XStack>
      {fraction !== null ? (
        <XStack mt="$3" height={3} rounded={2} bg="$color4" overflow="hidden">
          <YStack grow={fraction} bg="$color" rounded={2} />
          <YStack grow={1 - fraction} />
        </XStack>
      ) : null}
      {run.detail ? (
        <Text color={failed ? '$red10' : '$color11'} mt="$2" fontSize={12} lineHeight={17}>
          {run.detail}
        </Text>
      ) : null}
    </Card>
  )
}
