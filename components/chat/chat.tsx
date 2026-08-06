import { Button, Card, Spinner, Text, XStack, YStack } from '@hanzo/gui'
import { ChevronDown, Ghost, Trash2, X } from '@hanzogui/lucide-icons-2'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { refuse, type Refusal } from '@/lib/api'
import { defaultModel, models, vision } from '@/lib/models'
import { token } from '@/lib/store'

import { Composer } from './composer'
import type { Shot } from './draft'
import * as history from './history'
import { Bubble } from './message'
import type { Message } from './message'
import { Picker } from './picker'
import { turn } from './turn'

let seq = 0
function id(): string {
  return `m-${Date.now().toString(36)}-${++seq}`
}

function note(text: string): Message {
  return { id: id(), role: 'note', text, at: Date.now() }
}

// The one chat surface, mounted twice: the tab, and /chat/private with
// ephemeral set — same components, same turn, no second implementation. The
// ephemeral mount persists nothing and starts empty every time.
export function Chat({ ephemeral }: { ephemeral?: boolean }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const list = useRef<FlatList<Message>>(null)
  const abort = useRef<AbortController | null>(null)

  const [signed, setSigned] = useState<boolean | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loaded, setLoaded] = useState(ephemeral === true)
  const [streaming, setStreaming] = useState(false)
  const [model, setModel] = useState<string | null>(null)
  const [ids, setIds] = useState<string[] | null>(null)
  const [catalogNote, setCatalogNote] = useState<Refusal | null>(null)
  const [picking, setPicking] = useState(false)

  // Re-check the credential on every focus so returning from /auth or from a
  // sign-out in Settings flips the surface without a restart.
  useFocusEffect(
    useCallback(() => {
      let live = true
      token().then((value) => {
        if (live) setSigned(value !== null)
      })
      return () => {
        live = false
      }
    }, [])
  )

  const catalog = useCallback(() => {
    setCatalogNote(null)
    models()
      .then((loaded) => {
        setIds(loaded)
        setModel((current) => current ?? defaultModel(loaded))
      })
      .catch((error) => {
        setIds(null)
        setCatalogNote(refuse(error))
      })
  }, [])

  useEffect(() => {
    if (signed) catalog()
  }, [signed, catalog])

  useEffect(() => {
    if (ephemeral || !signed || loaded) return
    history.load().then((stored) => {
      setMessages((current) => (current.length ? current : stored))
      setLoaded(true)
    })
  }, [ephemeral, signed, loaded])

  useEffect(() => {
    if (!ephemeral && loaded) void history.save(messages)
  }, [ephemeral, loaded, messages])

  // The unmount must not leave a stream running into dead state.
  useEffect(() => () => abort.current?.abort(), [])

  function send(text: string, shots: Shot[]) {
    if (streaming) return
    // An attached image sends the turn to the vision modality model.
    const used = shots.length ? vision : model
    if (!used) {
      setMessages((current) => [
        ...current,
        note(catalogNote ? `The model catalog has not loaded. ${catalogNote.message}` : 'The model catalog is still loading.'),
      ])
      return
    }
    const user: Message = {
      id: id(),
      role: 'user',
      text,
      images: shots.length ? shots.map((shot) => shot.uri) : undefined,
      at: Date.now(),
    }
    const reply: Message = { id: id(), role: 'assistant', text: '', at: Date.now() }
    const sent = [...messages, user]
    setMessages([...sent, reply])
    setStreaming(true)
    const control = new AbortController()
    abort.current = control
    turn({
      model: used,
      messages: sent,
      signal: control.signal,
      onDelta: (delta) =>
        setMessages((current) =>
          current.map((message) => (message.id === reply.id ? { ...message, text: message.text + delta } : message))
        ),
    })
      .catch((error) => {
        const said = refuse(error)
        setMessages((current) => [
          // A reply that never received a token is removed rather than left
          // as a blank bubble pretending something was said.
          ...current.filter((message) => message.id !== reply.id || message.text !== ''),
          note(said.message),
        ])
      })
      .finally(() => {
        abort.current = null
        setStreaming(false)
      })
  }

  function stop() {
    abort.current?.abort()
  }

  function clear() {
    abort.current?.abort()
    setMessages([])
    if (!ephemeral) void history.clear()
  }

  const last = messages[messages.length - 1]

  if (signed === null) {
    return (
      <YStack flex={1} bg="$background" items="center" justify="center">
        <Spinner color="$color10" />
      </YStack>
    )
  }

  if (!signed) {
    return (
      <YStack flex={1} bg="$background" items="center" justify="center" p="$6">
        <Card p="$5" width="100%" maxW={420} bg="$color2" borderWidth={1} borderColor="$borderColor" rounded="$6">
          <Text color="$color" fontSize={17} fontWeight="600">
            {ephemeral ? 'Private chat' : 'Chat'}
          </Text>
          <Text color="$color11" mt="$2" fontSize={14} lineHeight={20}>
            Nothing is signed in on this device. Sign in with Hanzo ID or paste an API key to talk to Hanzo.
          </Text>
          <Button mt="$4" bg="$color" color="$background" onPress={() => router.push('/auth')}>
            Sign in
          </Button>
        </Card>
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg="$background">
      <XStack
        pt={insets.top + 8}
        px="$3"
        pb="$2.5"
        items="center"
        justify="space-between"
        borderBottomWidth={1}
        borderColor="$borderColor"
      >
        <XStack items="center" gap="$2" flex={1}>
          {ephemeral ? (
            <Button
              size="$2.5"
              circular
              chromeless
              icon={<X size={18} color="$color10" />}
              onPress={() => router.back()}
              aria-label="Close"
            />
          ) : null}
          <YStack>
            <Text color="$color" fontSize={16} fontWeight="600">
              {ephemeral ? 'Private' : 'Chat'}
            </Text>
            {ephemeral ? (
              <Text color="$color10" fontSize={11}>
                Nothing is kept
              </Text>
            ) : null}
          </YStack>
        </XStack>
        <XStack items="center" gap="$2">
          <Button
            size="$2.5"
            bg="$color2"
            borderWidth={1}
            borderColor="$borderColor"
            rounded="$10"
            px="$3"
            onPress={() => setPicking(true)}
            iconAfter={<ChevronDown size={14} color="$color10" />}
            aria-label="Pick model"
          >
            <Text color="$color11" fontSize={13}>
              {model ?? 'model'}
            </Text>
          </Button>
          {ephemeral ? (
            <Button
              size="$2.5"
              circular
              chromeless
              icon={<Trash2 size={18} color="$color10" />}
              onPress={clear}
              aria-label="Clear"
            />
          ) : (
            <Button
              size="$2.5"
              circular
              chromeless
              icon={<Ghost size={18} color="$color10" />}
              onPress={() => router.push('/chat/private')}
              aria-label="Private chat"
            />
          )}
        </XStack>
      </XStack>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <YStack flex={1} items="center" justify="center" p="$6" gap="$2">
            <Text color="$color" fontSize={18} fontWeight="600">
              {ephemeral ? 'Private' : 'Hanzo'}
            </Text>
            <Text color="$color10" fontSize={14} text="center" lineHeight={20}>
              {ephemeral
                ? 'This conversation is never stored and clears when you leave.'
                : model
                  ? `Ask anything — ${model} answers.`
                  : catalogNote
                    ? catalogNote.message
                    : 'Loading the model catalog.'}
            </Text>
          </YStack>
        ) : (
          <FlatList
            ref={list}
            data={messages}
            keyExtractor={(message) => message.id}
            renderItem={({ item }) => (
              <Bubble
                message={item}
                streaming={streaming && item.role === 'assistant' && item.id === last?.id}
              />
            )}
            contentContainerStyle={{ paddingVertical: 12 }}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
            keyboardDismissMode="interactive"
          />
        )}
        <Composer streaming={streaming} onSend={send} onStop={stop} />
      </KeyboardAvoidingView>

      <Picker
        open={picking}
        onClose={() => setPicking(false)}
        model={model}
        ids={ids}
        note={catalogNote}
        onPick={setModel}
        onReload={catalog}
      />
    </YStack>
  )
}
