import { Refused, refusal } from '@/lib/api'
import * as runs from '@/lib/runs'
import { sse } from '@/lib/sse'

import type { Message } from './message'

// The OpenAI content-parts shape: text, or text with image_url parts when a
// message carries images. Images travel as data: URIs.
type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
type Wire = { role: 'user' | 'assistant'; content: string | Part[] }

function wire(messages: Message[]): Wire[] {
  // Only the LAST user message carries its images as inline parts. An image is
  // a data: URI of the full photo; resending every historical one would grow
  // each request by megabytes for the rest of the transcript (history keeps
  // 200 messages) until the gateway's body limit refused the turn. Older
  // images collapse to a placeholder the model can still anchor on.
  const trailing = [...messages].reverse().find((m) => m.role === 'user')
  const out: Wire[] = []
  for (const message of messages) {
    // Notes are surface state (refusals, clears) — the model never sees them.
    if (message.role === 'note') continue
    if (message.role === 'user' && message.images?.length) {
      if (message === trailing) {
        const content: Part[] = message.images.map((url) => ({ type: 'image_url', image_url: { url } }))
        if (message.text) content.push({ type: 'text', text: message.text })
        out.push({ role: 'user', content })
      } else {
        const note = message.images.length === 1 ? '[image attached earlier]' : `[${message.images.length} images attached earlier]`
        out.push({ role: 'user', content: message.text ? `${note}\n${message.text}` : note })
      }
    } else {
      out.push({ role: message.role, content: message.text })
    }
  }
  return out
}

type Chunk = {
  choices?: { delta?: { content?: string } }[]
  error?: unknown
}

// One streaming chat turn against /v1/chat/completions. Deltas surface
// through onDelta as they arrive; the run registry carries the turn for PiP
// and the widget — started as streaming, detail a rolling tokens-per-second
// with the last line, ended when the stream finishes however it finishes.
export async function turn(options: {
  model: string
  messages: Message[]
  signal?: AbortSignal
  onDelta(text: string): void
}): Promise<void> {
  const run = runs.start({ kind: 'chat', title: options.model, phase: 'streaming' })
  const started = Date.now()
  let count = 0
  let text = ''
  let stamp = 0

  function narrate() {
    const now = Date.now()
    // Every frame would spam a native PiP surface; four a second reads live.
    if (now - stamp < 250) return
    stamp = now
    const rate = Math.round(count / Math.max((now - started) / 1000, 0.001))
    const lines = text.trimEnd().split('\n')
    const last = lines[lines.length - 1]?.slice(0, 80) ?? ''
    runs.update(run.id, { detail: last ? `${rate} tok/s · ${last}` : `${rate} tok/s` })
  }

  try {
    await sse(
      '/chat/completions',
      { body: JSON.stringify({ model: options.model, messages: wire(options.messages), stream: true }) },
      (frame) => {
        if (frame.data === '[DONE]') return
        let chunk: Chunk
        try {
          chunk = JSON.parse(frame.data) as Chunk
        } catch {
          // A malformed frame is dropped, not fatal — the terminator or the
          // reader ending still closes the turn.
          return
        }
        if (chunk.error) {
          // Some gateways refuse mid-stream with an error chunk instead of a
          // status. Surface the server's own sentence when it stated one.
          const said =
            typeof chunk.error === 'object' && typeof (chunk.error as { message?: unknown }).message === 'string'
              ? ((chunk.error as { message: string }).message)
              : ''
          throw new Refused(0, refusal(0, said))
        }
        const delta = chunk.choices?.[0]?.delta?.content
        if (typeof delta === 'string' && delta) {
          count += 1
          text += delta
          options.onDelta(delta)
          narrate()
        }
      },
      options.signal
    )
    // The history ring keeps the phase a run ended in; a bare end would file
    // success, abort and failure all as 'streaming', and a failed turn would
    // read as a quietly finished one on the tasks board. An abort resolves the
    // stream quietly (stopping is a finish, not a failure), so it lands here.
    runs.end(run.id, { phase: options.signal?.aborted ? 'stopped' : 'done' })
  } catch (error) {
    const stopped = options.signal?.aborted === true
    runs.end(run.id, {
      phase: stopped ? 'stopped' : 'error',
      detail: stopped ? undefined : error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
