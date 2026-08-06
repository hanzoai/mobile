import { Button, Text, TextArea, XStack, YStack } from '@hanzo/gui'
import { ArrowUp, Paperclip, Square, X } from '@hanzogui/lucide-icons-2'
import { useRouter } from 'expo-router'
import { useState, useSyncExternalStore } from 'react'
import { Image, Platform } from 'react-native'

import * as draft from './draft'
import type { Shot } from './draft'

// The composer: text, the attachment draft, send or stop. Enter sends; an
// open IME candidate never does — natively the keyboard commits the
// candidate before submitBehavior fires, and on web the composition flag is
// checked by hand. Attachments arrive through the /send flow and show here
// as removable thumbnails until the send consumes them.
export function Composer(props: {
  streaming: boolean
  onSend(text: string, shots: Shot[]): void
  onStop(): void
}) {
  const router = useRouter()
  const [text, setText] = useState('')
  const shots = useSyncExternalStore(draft.subscribe, draft.list, draft.list)
  const ready = !props.streaming && (text.trim().length > 0 || shots.length > 0)

  function send() {
    if (!ready) return
    const taken = draft.take()
    const clean = text.trim()
    setText('')
    props.onSend(clean, taken)
  }

  function key(event: { nativeEvent: { key: string }; preventDefault?(): void }) {
    if (Platform.OS !== 'web') return
    const raw = event.nativeEvent as {
      key: string
      shiftKey?: boolean
      isComposing?: boolean
      keyCode?: number
    }
    if (raw.key !== 'Enter' || raw.shiftKey) return
    // Mid-composition Enter commits the IME candidate; sending then would
    // eat the word. 229 is the legacy composition keyCode.
    if (raw.isComposing || raw.keyCode === 229) return
    event.preventDefault?.()
    send()
  }

  return (
    <YStack borderTopWidth={1} borderColor="$borderColor" px="$3" pt="$2.5" pb="$2.5" gap="$2">
      {shots.length > 0 ? (
        <XStack gap="$2" flexWrap="wrap">
          {shots.map((shot) => (
            <YStack key={shot.id}>
              <Image
                source={{ uri: shot.uri }}
                style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: '#141414' }}
              />
              <Button
                position="absolute"
                t={-6}
                r={-6}
                size="$1"
                circular
                bg="$color4"
                icon={<X size={10} />}
                onPress={() => draft.remove(shot.id)}
                aria-label="Remove image"
              />
            </YStack>
          ))}
        </XStack>
      ) : null}
      <XStack items="flex-end" gap="$2">
        <Button
          size="$3"
          circular
          chromeless
          icon={<Paperclip size={18} color="$color10" />}
          onPress={() => router.push('/send')}
          aria-label="Attach"
        />
        <TextArea
          flex={1}
          value={text}
          onChangeText={setText}
          placeholder="Message Hanzo"
          placeholderTextColor="$color10"
          bg="$color2"
          borderWidth={1}
          borderColor="$borderColor"
          rounded="$6"
          color="$color"
          fontSize={15}
          lineHeight={20}
          px="$3.5"
          py="$2.5"
          minH={44}
          maxH={132}
          multiline
          returnKeyType="send"
          submitBehavior="submit"
          onSubmitEditing={send}
          onKeyPress={key}
        />
        {props.streaming ? (
          <Button
            size="$3"
            circular
            bg="$color4"
            icon={<Square size={13} color="$color" />}
            onPress={props.onStop}
            aria-label="Stop"
          />
        ) : (
          <Button
            size="$3"
            circular
            bg={ready ? '$color' : '$color3'}
            disabled={!ready}
            icon={<ArrowUp size={18} color={ready ? '$background' : '$color10'} />}
            onPress={send}
            aria-label="Send"
          />
        )}
      </XStack>
    </YStack>
  )
}
