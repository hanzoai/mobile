import { fetch } from 'expo/fetch'

import { Refused, bearer, reason, refusal, v1 } from './api'

// One frame of a server-sent event stream.
export type Frame = { event?: string; data: string }

// Incremental SSE parser, pure so tests can feed chunks split at any byte
// boundary and assert the frames. Grammar per the spec: \r\n, \r and \n all
// end a line, a frame dispatches on the blank line, a leading colon is a
// comment, one space after the field colon is stripped, and multiple data
// lines join with newlines.
export function parser(onFrame: (frame: Frame) => void): { feed(chunk: string): void } {
  let tail = ''
  let cr = false
  let event: string | undefined
  let data: string[] = []

  function line(raw: string) {
    if (raw === '') {
      if (data.length) onFrame({ event, data: data.join('\n') })
      event = undefined
      data = []
      return
    }
    if (raw.startsWith(':')) return
    const colon = raw.indexOf(':')
    const field = colon === -1 ? raw : raw.slice(0, colon)
    let value = colon === -1 ? '' : raw.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'data') data.push(value)
    else if (field === 'event') event = value
  }

  return {
    feed(chunk: string) {
      if (chunk === '') return
      // A \r\n split across two chunks must stay one line ending: the \r
      // already terminated the line, so a leading \n here is its second
      // half, not an empty line — which would dispatch the frame early.
      if (cr && chunk.startsWith('\n')) chunk = chunk.slice(1)
      cr = chunk.endsWith('\r')
      tail += chunk
      const lines = tail.split(/\r\n|\r|\n/)
      tail = lines.pop() ?? ''
      for (const one of lines) line(one)
    },
  }
}

// UTF-8 decode without assuming the TextDecoder global: Hermes gained it
// late, and a missing global must not take streaming down on some device.
// The decoder is stateful — {stream: true} holds the tail of a multibyte
// character split across chunks — so each stream owns its own; a shared one
// would braid concurrent streams together and leak one stream's pending
// bytes into the next.
function decode(bytes: Uint8Array, decoder: TextDecoder | null): string {
  if (decoder) {
    return decoder.decode(bytes, { stream: true })
  }
  let out = ''
  let i = 0
  while (i < bytes.length) {
    const a = bytes[i]!
    if (a < 0x80) {
      out += String.fromCharCode(a)
      i += 1
    } else if (a < 0xe0) {
      out += String.fromCharCode(((a & 0x1f) << 6) | (bytes[i + 1]! & 0x3f))
      i += 2
    } else if (a < 0xf0) {
      out += String.fromCharCode(((a & 0x0f) << 12) | ((bytes[i + 1]! & 0x3f) << 6) | (bytes[i + 2]! & 0x3f))
      i += 3
    } else {
      const point =
        ((a & 0x07) << 18) | ((bytes[i + 1]! & 0x3f) << 12) | ((bytes[i + 2]! & 0x3f) << 6) | (bytes[i + 3]! & 0x3f)
      out += String.fromCodePoint(point)
      i += 4
    }
  }
  return out
}

export type Init = {
  method?: string
  headers?: Record<string, string>
  body?: string
}

// Streams v1(path) and hands each frame to onFrame, resolving when the
// stream ends. expo/fetch exposes response.body on native, which the
// built-in fetch does not. A non-2xx never streams: the whole body is read
// and thrown through the estate refusal mapping. An abort resolves quietly —
// stopping a stream is a finish, not a failure.
export async function sse(
  path: string,
  init: Init,
  onFrame: (frame: Frame) => void,
  signal?: AbortSignal
): Promise<void> {
  let response: Awaited<ReturnType<typeof fetch>>
  try {
    response = await fetch(v1(path), {
      method: init.method ?? 'POST',
      body: init.body,
      headers: { accept: 'text/event-stream', ...(await bearer()), ...init.headers },
      signal,
    })
  } catch (error) {
    if (signal?.aborted) return
    throw new Refused(0, refusal(0, 'Could not reach api.hanzo.ai. Check the connection and try again.'))
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Refused(response.status, refusal(response.status, reason(body)))
  }
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Refused(0, refusal(0, 'The stream arrived without a body.'))
  }
  const feed = parser(onFrame)
  const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) feed.feed(decode(value, decoder))
    }
    // The decoder may still hold the tail of a split character; flush it
    // through the parser. A final lone newline may still be buffered after
    // that; the spec drops an unterminated frame, and so do we.
    const tail = decoder?.decode() ?? ''
    if (tail) feed.feed(tail)
  } catch (error) {
    if (signal?.aborted) return
    throw error
  } finally {
    reader.releaseLock?.()
  }
}
