import { Text, XStack, YStack } from '@hanzo/gui'
import { useEffect, useRef } from 'react'
import { Animated, Image } from 'react-native'

// One message in a transcript. A note is neither side speaking — a refusal
// or a state change rendered centered and dim, persisted like the rest so
// the transcript stays an honest record of what happened.
export type Message = {
  id: string
  role: 'user' | 'assistant' | 'note'
  text: string
  images?: string[]
  at: number
}

export type Part = { code: boolean; lang?: string; text: string }

// Split fenced code out of a message so code renders mono on its own slab.
// Pure so the unit under test is the grammar, not the view. An unclosed
// fence — the normal state mid-stream — is code to the end of the text.
export function parts(text: string): Part[] {
  const out: Part[] = []
  let rest = text
  while (rest.length) {
    const open = rest.indexOf('```')
    if (open === -1) {
      out.push({ code: false, text: rest })
      break
    }
    if (open > 0) out.push({ code: false, text: rest.slice(0, open) })
    let body = rest.slice(open + 3)
    let lang: string | undefined
    const nl = body.indexOf('\n')
    const head = (nl === -1 ? body : body.slice(0, nl)).trim()
    if (/^[\w.+-]*$/.test(head)) {
      lang = head || undefined
      body = nl === -1 ? '' : body.slice(nl + 1)
    }
    const close = body.indexOf('```')
    if (close === -1) {
      out.push({ code: true, lang, text: body })
      break
    }
    out.push({ code: true, lang, text: body.slice(0, close).replace(/\n$/, '') })
    rest = body.slice(close + 3).replace(/^\n/, '')
  }
  return out
}

// The streaming cursor: a block that breathes while tokens arrive. Plain RN
// Animated — the gui animation presets are one-shot springs, not loops.
function Cursor() {
  const pulse = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.2, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])
  return (
    <Animated.Text style={{ color: '#fafafa', opacity: pulse, fontSize: 15, lineHeight: 22 }}>
      {'▍'}
    </Animated.Text>
  )
}

function Slab({ part }: { part: Part }) {
  return (
    <YStack
      bg="$color2"
      borderWidth={1}
      borderColor="$borderColor"
      rounded="$4"
      p="$3"
      my="$1.5"
      self="stretch"
    >
      {part.lang ? (
        <Text color="$color10" fontSize={11} mb="$1.5" fontFamily="$mono">
          {part.lang}
        </Text>
      ) : null}
      <Text selectable color="$color" fontSize={13} lineHeight={19} fontFamily="$mono">
        {part.text}
      </Text>
    </YStack>
  )
}

function Shots({ uris }: { uris: string[] }) {
  return (
    <XStack gap="$2" mb="$1.5" flexWrap="wrap" justify="flex-end">
      {uris.map((uri, index) => (
        <Image
          key={index}
          source={{ uri }}
          style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: '#141414' }}
        />
      ))}
    </XStack>
  )
}

export function Bubble({ message, streaming }: { message: Message; streaming?: boolean }) {
  if (message.role === 'note') {
    return (
      <XStack justify="center" px="$4" py="$2">
        <Text color="$color10" fontSize={13} lineHeight={18} text="center">
          {message.text}
        </Text>
      </XStack>
    )
  }

  if (message.role === 'user') {
    return (
      <YStack items="flex-end" px="$4" py="$1.5">
        {message.images?.length ? <Shots uris={message.images} /> : null}
        {message.text ? (
          <YStack bg="$color3" rounded="$6" px="$3.5" py="$2.5" maxW="85%">
            <Text selectable color="$color" fontSize={15} lineHeight={22}>
              {message.text}
            </Text>
          </YStack>
        ) : null}
      </YStack>
    )
  }

  const split = parts(message.text)
  return (
    <YStack px="$4" py="$1.5" self="stretch">
      {split.map((part, index) =>
        part.code ? (
          <Slab key={index} part={part} />
        ) : (
          <Text key={index} selectable color="$color" fontSize={15} lineHeight={22}>
            {part.text.replace(/\n+$/, '')}
            {streaming && index === split.length - 1 ? <Cursor /> : null}
          </Text>
        )
      )}
      {streaming && (split.length === 0 || split[split.length - 1]!.code) ? <Cursor /> : null}
    </YStack>
  )
}
