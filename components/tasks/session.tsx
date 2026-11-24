import { Button, Card, Input, Spinner, Text, XStack, YStack } from '@hanzo/gui'
import { ArrowUp, Cloud } from '@hanzogui/lucide-icons-2'
import { useState } from 'react'

import { Chip } from './chip'
import { Refuse } from './note'
import type { Refusal } from '@/lib/api'
import * as gen from '@/lib/gen'
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

export function Session({
  session,
  onSteered,
}: {
  session: sessions.Session
  onSteered?: () => void
}) {
  const steerable =
    session.status === 'running' || session.status === 'paused' || session.id.startsWith('dev_')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [fault, setFault] = useState<Refusal | null>(null)

  async function send() {
    const words = draft.trim()
    if (!words || sending) return
    setSending(true)
    setFault(null)
    try {
      const res = await gen.steer(session.id, words)
      if (res.kind === 'refused') {
        setFault(res.refusal)
        return
      }
      if (res.kind === 'ok') {
        setDraft('')
        setOpen(false)
        onSteered?.()
      }
    } finally {
      setSending(false)
    }
  }

  const ready = !sending && draft.trim().length > 0

  return (
    <Card
      p="$3.5"
      bg="$color2"
      borderWidth={1}
      borderColor="$borderColor"
      rounded="$6"
      onPress={steerable ? () => setOpen((v) => !v) : undefined}
    >
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
            {steerable ? ' · tap to steer' : ''}
          </Text>
        </YStack>
        <Chip word={session.status} />
      </XStack>

      {open ? (
        <YStack mt="$3" gap="$2">
          <XStack items="center" gap="$2">
            <Input
              flex={1}
              value={draft}
              onChangeText={setDraft}
              placeholder="Send follow-up instruction…"
              placeholderTextColor="$color10"
              bg="$background"
              borderColor="$borderColor"
              color="$color"
              rounded="$5"
              returnKeyType="send"
              onSubmitEditing={send}
            />
            <Button
              size="$3"
              circular
              bg={ready ? '$color' : '$color3'}
              disabled={!ready}
              icon={
                sending ? (
                  <Spinner color="$color11" />
                ) : (
                  <ArrowUp size={16} color={ready ? '$background' : '$color10'} />
                )
              }
              onPress={send}
              aria-label="Steer session"
            />
          </XStack>
          {fault ? <Refuse refusal={fault} /> : null}
        </YStack>
      ) : null}
    </Card>
  )
}
