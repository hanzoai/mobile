import { Button, ScrollView, Spinner, Text, TextArea, XStack, YStack } from '@hanzo/gui'
import { ArrowLeft, Share2, Sparkles } from '@hanzogui/lucide-icons-2'
import { File, Paths } from 'expo-file-system'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useState } from 'react'
import { Platform, Share } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Note, Refuse } from '@/components/tasks/note'
import { bearer, reason, refusal, v1, type Refusal } from '@/lib/api'
import * as runs from '@/lib/runs'

export default function Generate() {
  const insets = useSafeAreaInsets()
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [anon, setAnon] = useState(false)
  const [fault, setFault] = useState<Refusal | null>(null)
  const [shot, setShot] = useState<string | null>(null)

  async function generate() {
    const asked = prompt.trim()
    if (!asked || busy) return
    setFault(null)
    setAnon(false)

    const auth = await bearer()
    if (!auth.Authorization) {
      setAnon(true)
      return
    }

    setBusy(true)
    // The run exists before the request leaves, so PiP, the widget and the
    // tasks screen all see this work the moment it starts.
    const run = runs.start({
      kind: 'image',
      title: asked.length > 64 ? `${asked.slice(0, 64)}…` : asked,
      phase: 'generating',
    })
    try {
      const res = await fetch(v1('/images/generations'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...auth },
        body: JSON.stringify({ model: 'zen-image', prompt: asked, n: 1 }),
      })
      if (!res.ok) {
        // The server's own words, verbatim — the gateway answers things like
        // 'Insufficient balance', and paraphrasing them cost the estate real
        // debugging time.
        const said = refusal(res.status, reason(await res.text().catch(() => '')))
        setFault(said)
        runs.end(run.id, { phase: 'error', detail: said.message })
        return
      }
      const body = await res.json().catch(() => null)
      const first = body?.data?.[0]
      const uri: string | null =
        typeof first?.b64_json === 'string' && first.b64_json
          ? `data:image/png;base64,${first.b64_json}`
          : typeof first?.url === 'string' && first.url
            ? first.url
            : null
      if (!uri) {
        const said = refusal(0, 'The service answered without an image.')
        setFault(said)
        runs.end(run.id, { phase: 'error', detail: said.message })
        return
      }
      setShot(uri)
      // The registry ring keeps 20 runs for the tasks board and the widget; a
      // base64 data URI would pin the full multi-megabyte PNG in the JS heap
      // per slot. Park the bytes in a cache file (voice already does exactly
      // this for speech) and hand the run a file:// URI instead.
      let thumb = uri
      if (uri.startsWith('data:')) {
        try {
          const file = new File(Paths.cache, `image-${run.id}.png`)
          file.write(Uint8Array.from(atob(uri.slice(uri.indexOf(',') + 1)), (c) => c.charCodeAt(0)))
          thumb = file.uri
        } catch {
          // The board just loses its thumbnail; the image on screen stands.
          thumb = ''
        }
      }
      runs.end(run.id, { phase: 'done', ...(thumb ? { thumb } : {}) })
    } catch {
      const said = refusal(0, 'No connection. Check the network and try again.')
      setFault(said)
      runs.end(run.id, { phase: 'error', detail: said.message })
    } finally {
      setBusy(false)
    }
  }

  // iOS's sheet takes the image as a URL — data URI included — and offers
  // Save Image, so saving needs no extra native module there. Android's
  // sheet needs a content URI nothing installed can mint yet, so Android
  // states that instead of showing a button that cannot deliver.
  async function share() {
    if (!shot) return
    try {
      await Share.share({ url: shot })
    } catch {
      // The user closed the sheet; nothing to add.
    }
  }

  const ready = !busy && prompt.trim().length > 0

  return (
    <ScrollView
      flex={1}
      bg="$background"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ p: 20, pt: insets.top + 8, pb: 40 }}
    >
      <YStack gap="$3">
        <XStack items="center" gap="$2">
          <Button
            chromeless
            circular
            icon={<ArrowLeft size={20} color="$color11" />}
            onPress={() => router.back()}
            aria-label="Back"
          />
          <Text color="$color" fontSize={22} fontWeight="700">
            Image
          </Text>
        </XStack>

        <TextArea
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Describe the image…"
          color="$color"
          bg="$color2"
          borderColor="$borderColor"
          rounded="$6"
          minH={96}
        />

        <Button
          disabled={!ready}
          opacity={ready ? 1 : 0.5}
          onPress={generate}
          icon={busy ? <Spinner color="$color11" /> : <Sparkles size={16} />}
        >
          {busy ? 'Generating…' : 'Generate'}
        </Button>

        {anon ? (
          <Note
            title="Signed out"
            detail="Image generation needs a credential. Add one in Settings, then come back."
          />
        ) : null}
        {fault ? <Refuse refusal={fault} /> : null}

        {shot ? (
          <YStack gap="$3">
            <Image
              source={{ uri: shot }}
              style={{ width: '100%', aspectRatio: 1, borderRadius: 16 }}
              contentFit="cover"
              transition={200}
            />
            {Platform.OS === 'ios' ? (
              <Button self="flex-start" size="$3" icon={<Share2 size={16} />} onPress={share}>
                Share or save
              </Button>
            ) : (
              <Text color="$color11" fontSize={12}>
                Saving on Android arrives with the native media module. Screenshot in the meantime.
              </Text>
            )}
          </YStack>
        ) : null}
      </YStack>
    </ScrollView>
  )
}
