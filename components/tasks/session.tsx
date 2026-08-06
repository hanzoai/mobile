import { Card, Text, XStack, YStack } from '@hanzo/gui'
import { Cloud } from '@hanzogui/lucide-icons-2'

import { Chip } from './chip'
import type * as sessions from '@/lib/sessions'

// 'just now' under a minute, then the biggest whole unit; '—' when the
// server never said.
function ago(at: number | undefined, now: number): string {
  if (!at) return '—'
  const s = Math.max(0, Math.floor((now - at) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function Session({ session }: { session: sessions.Session }) {
  return (
    <Card p="$3.5" bg="$color2" borderWidth={1} borderColor="$borderColor" rounded="$6">
      <XStack items="center" gap="$3">
        <YStack width={40} height={40} rounded={8} bg="$color4" items="center" justify="center">
          <Cloud size={18} color="$color11" />
        </YStack>
        <YStack flex={1} gap="$1">
          <Text color="$color" fontSize={15} fontWeight="600" numberOfLines={1}>
            {session.title}
          </Text>
          <Text color="$color11" fontSize={12}>
            {ago(session.at, Date.now())}
          </Text>
        </YStack>
        <Chip word={session.status} />
      </XStack>
    </Card>
  )
}
