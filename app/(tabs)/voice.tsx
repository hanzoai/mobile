import { ScrollView, Text, YStack } from '@hanzo/gui'
import { Mic } from '@hanzogui/lucide-icons-2'
import {
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio'
import { File, Paths } from 'expo-file-system'
import { useRef, useState } from 'react'
import type { ScrollView as Scroller } from 'react-native'

import { bearer, reason, refusal, v1 } from '@/lib/api'
import * as runs from '@/lib/runs'

// Push-to-talk voice chat. Hold the button to record; release to send the
// audio through three real stages — transcription, chat, speech — each of
// which updates the ONE voice run so PiP and the tasks board follow along.
// A stage that is not bound on this deployment says so inline and leaves
// every earlier stage's output standing.

type Turn = { role: 'user' | 'assistant'; text: string }
type Stage = 'idle' | 'listening' | 'thinking' | 'speaking'

export default function Voice() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const [turns, setTurns] = useState<Turn[]>([])
  const [stage, setStage] = useState<Stage>('idle')
  const [note, setNote] = useState<string | null>(null)
  const pressed = useRef(false)
  const heldAt = useRef(0)
  const run = useRef<string | null>(null)
  const scroller = useRef<Scroller>(null)

  const busy = stage === 'thinking' || stage === 'speaking'

  function settle(message?: string) {
    if (message) setNote(message)
    if (run.current) {
      runs.end(run.current)
      run.current = null
    }
    setStage('idle')
  }

  function unbound(path: string) {
    settle(`POST ${path} is not bound on this deployment. Earlier output above still stands.`)
  }

  // The estate's refusal law: 401 is the credential (never a login loop),
  // 402 credits, 403 permission with no retry bait, anything else service.
  async function refuse(res: Response) {
    const body = await res.text().catch(() => '')
    settle(refusal(res.status, reason(body)).message)
  }

  async function begin() {
    if (busy || pressed.current) return
    pressed.current = true
    heldAt.current = Date.now()
    setNote(null)

    const auth = await bearer()
    if (!auth.Authorization) {
      pressed.current = false
      setNote('No credential. Sign in or paste an sk- key in Settings first.')
      return
    }
    const permission = await requestRecordingPermissionsAsync()
    if (!permission.granted) {
      pressed.current = false
      setNote('Microphone access is denied. Allow it in system settings to talk.')
      return
    }
    // The user may have let go while the prompts above were up.
    if (!pressed.current) return
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await recorder.prepareToRecordAsync()
      if (!pressed.current) return
      recorder.record()
    } catch {
      pressed.current = false
      setNote('Recording could not start on this device.')
      return
    }
    run.current = runs.start({ kind: 'voice', title: 'Voice chat', phase: 'listening' }).id
    setStage('listening')
  }

  async function finish() {
    const held = Date.now() - heldAt.current
    pressed.current = false
    if (!recorder.isRecording) return
    try {
      await recorder.stop()
    } catch {
      // A recorder that cannot stop has nothing to send.
    }
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
    const uri = recorder.uri
    if (held < 400 || !uri) {
      settle(held < 400 ? 'Hold the button while you speak, release to send.' : undefined)
      return
    }
    setStage('thinking')
    if (run.current) runs.update(run.current, { phase: 'thinking', detail: 'transcribing' })
    await converse(uri)
  }

  async function converse(uri: string) {
    const auth = await bearer()

    // Stage one: audio to text.
    let heard = ''
    try {
      const form = new FormData()
      // React Native multipart takes the file by uri; the cast is the RN
      // FormData file shape, which the DOM lib types do not know.
      form.append('file', { uri, name: 'voice.m4a', type: 'audio/m4a' } as unknown as Blob)
      form.append('model', 'zen-voice')
      const res = await fetch(v1('/audio/transcriptions'), { method: 'POST', headers: auth, body: form })
      if (res.status === 404 || res.status === 501) return unbound('/v1/audio/transcriptions')
      if (!res.ok) return refuse(res)
      const body = await res.json()
      heard = typeof body?.text === 'string' ? body.text.trim() : ''
    } catch {
      return settle('Transcription failed in transit. Try again.')
    }
    if (!heard) return settle('Nothing heard. Hold the button and speak.')
    setTurns((prior) => [...prior, { role: 'user', text: heard }])
    if (run.current) runs.update(run.current, { phase: 'thinking', detail: heard.slice(0, 80) })

    // Stage two: text through the model. History rides along so the
    // conversation has memory; the reply is spoken, so it is asked short.
    let reply = ''
    try {
      const res = await fetch(v1('/chat/completions'), {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'zen5',
          messages: [
            { role: 'system', content: 'You are Hanzo. The reply is read aloud; answer in a sentence or two.' },
            ...turns.slice(-12).map((turn) => ({ role: turn.role, content: turn.text })),
            { role: 'user', content: heard },
          ],
        }),
      })
      if (res.status === 404 || res.status === 501) return unbound('/v1/chat/completions')
      if (!res.ok) return refuse(res)
      const body = await res.json()
      const content = body?.choices?.[0]?.message?.content
      reply = typeof content === 'string' ? content.trim() : ''
    } catch {
      return settle('The chat call failed in transit. Try again.')
    }
    if (!reply) return settle('The model returned an empty reply.')
    setTurns((prior) => [...prior, { role: 'assistant', text: reply }])

    // Stage three: text to speech, played from a cache file.
    setStage('speaking')
    if (run.current) runs.update(run.current, { phase: 'speaking', detail: reply.slice(0, 80) })
    try {
      const res = await fetch(v1('/audio/speech'), {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'zen-voice', input: reply, voice: 'alloy' }),
      })
      if (res.status === 404 || res.status === 501) return unbound('/v1/audio/speech')
      if (!res.ok) return refuse(res)
      const file = new File(Paths.cache, `speech-${Date.now()}.mp3`)
      file.write(new Uint8Array(await res.arrayBuffer()))
      await speak(file.uri)
    } catch {
      return settle('Speech synthesis failed. The reply above still stands.')
    }
    settle()
  }

  function speak(uri: string): Promise<void> {
    return new Promise((resolve) => {
      const player = createAudioPlayer({ uri })
      let over = false
      const done = () => {
        if (over) return
        over = true
        clearTimeout(cap)
        sub.remove()
        player.remove()
        resolve()
      }
      // A player that never reports finishing would hold the mic hostage;
      // spoken replies are seconds long, so a hard cap is the honest exit.
      const cap = setTimeout(done, 90_000)
      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish || status.error) done()
      })
      player.play()
    })
  }

  return (
    <YStack flex={1} bg="$background" pt="$8" px="$5" pb="$4">
      <Text color="$color" fontSize={22} fontWeight="700" mb="$3">
        Voice
      </Text>
      <ScrollView
        flex={1}
        ref={scroller}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      >
        {turns.length === 0 ? (
          <Text color="$color11" fontSize={14} lineHeight={20} mt="$2">
            Nothing said yet. Hold the mic, speak, release to send. Hanzo answers out loud.
          </Text>
        ) : (
          turns.map((turn, at) => (
            <YStack key={at} mb="$3" gap="$1">
              <Text color="$color11" fontSize={11}>
                {turn.role === 'user' ? 'You' : 'Hanzo'}
              </Text>
              <Text color="$color" fontSize={15} lineHeight={22}>
                {turn.text}
              </Text>
            </YStack>
          ))
        )}
      </ScrollView>
      {note ? (
        <YStack bg="$color2" borderWidth={1} borderColor="$borderColor" rounded="$4" p="$3" mb="$3">
          <Text color="$color11" fontSize={13} lineHeight={18}>
            {note}
          </Text>
        </YStack>
      ) : null}
      <YStack items="center" gap="$3" pb="$2">
        <YStack
          width={88}
          height={88}
          rounded={9999}
          items="center"
          justify="center"
          bg={stage === 'listening' ? '$color' : '$color2'}
          borderWidth={1}
          borderColor={stage === 'listening' ? '$color' : '$borderColor'}
          opacity={busy ? 0.4 : 1}
          disabled={busy}
          onPressIn={begin}
          onPressOut={finish}
          pressStyle={{ scale: 0.96 }}
        >
          <Mic size={30} color={stage === 'listening' ? '$background' : '$color'} />
        </YStack>
        <Text color="$color11" fontSize={12}>
          {stage === 'idle' && 'Hold to talk'}
          {stage === 'listening' && 'Listening — release to send'}
          {stage === 'thinking' && 'Thinking'}
          {stage === 'speaking' && 'Speaking'}
        </Text>
      </YStack>
    </YStack>
  )
}
