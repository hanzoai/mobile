import { Text, XStack, YStack } from '@hanzo/gui'
import { useEffect, useState } from 'react'

import { usePip, type Status } from '@/lib/pip'

// The face of the miniature window on Android. The OS shrinks the whole
// activity into the PiP frame, so this card lays over the app and becomes
// the only thing the tiny window shows. iOS draws the equivalent frame
// natively; the two must read identical — wordmark, phase, detail,
// progress, elapsed — so the product has one PiP face.
//
// Mount once near the root, after the navigator; it renders nothing until
// the window actually miniaturizes.
export function PipCard() {
  const { inPip, status } = usePip()
  if (!inPip) return null
  return <Face status={status} />
}

function Face({ status }: { status: Status | null }) {
  const line = status ? [status.phase, status.detail].filter(Boolean).join(' — ') : ''
  return (
    <YStack t={0} l={0} r={0} b={0} z={1000} position="absolute" bg="$background" p="$3" justify="space-between">
      <XStack items="center" justify="space-between">
        <Text color="$color" fontSize={11} fontWeight="700" letterSpacing={0.5}>
          Hanzo
        </Text>
        <Elapsed since={status?.startedAt} />
      </XStack>
      <YStack gap="$1">
        <Text color="$color" fontSize={13} fontWeight="600" numberOfLines={1}>
          {status?.title ?? 'Nothing running'}
        </Text>
        <Text color="$color11" fontSize={11} numberOfLines={1}>
          {line}
        </Text>
      </YStack>
      <Track value={status?.progress} />
    </YStack>
  )
}

function Elapsed({ since }: { since?: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  if (!since) return null
  const total = Math.max(0, Math.floor((now - since) / 1000))
  const seconds = String(total % 60).padStart(2, '0')
  return (
    <Text color="$color11" fontSize={11}>
      {Math.floor(total / 60)}:{seconds}
    </Text>
  )
}

function Track({ value }: { value?: number }) {
  // No number means no fill. The phase line already says work is happening;
  // a fabricated fill would be a lie.
  const share = typeof value === 'number' ? Math.min(100, Math.max(0, value * 100)) : 0
  return (
    <YStack height={3} rounded={9999} bg="$color4" overflow="hidden">
      <YStack height="100%" width={`${share}%`} rounded={9999} bg="$color" />
    </YStack>
  )
}
