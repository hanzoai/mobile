import { parser, utf8, type Frame } from '@/lib/sse'

// The grammar under test is the pure incremental parser; IO stays out. The
// law that matters for streaming: any split of the same bytes must yield the
// same frames.

function collect(): { frames: Frame[]; feed(chunk: string): void } {
  const frames: Frame[] = []
  const p = parser((frame) => frames.push(frame))
  return { frames, feed: (chunk) => p.feed(chunk) }
}

test('dispatches on the blank line, joins data lines, reads event', () => {
  const c = collect()
  c.feed('event: turn\ndata: one\ndata: two\n\n')
  expect(c.frames).toEqual([{ event: 'turn', data: 'one\ntwo' }])
})

test('accepts \\n, \\r and \\r\\n as line endings', () => {
  for (const end of ['\n', '\r', '\r\n']) {
    const c = collect()
    c.feed(`data: a${end}${end}data: b${end}${end}`)
    expect(c.frames).toEqual([
      { event: undefined, data: 'a' },
      { event: undefined, data: 'b' },
    ])
  }
})

test('strips exactly one space after the colon', () => {
  const c = collect()
  c.feed('data:  padded\n\n')
  expect(c.frames[0]!.data).toBe(' padded')
})

test('ignores comment lines', () => {
  const c = collect()
  c.feed(': keepalive\ndata: real\n\n')
  expect(c.frames).toEqual([{ event: undefined, data: 'real' }])
})

test('drops an unterminated trailing frame, as the spec does', () => {
  const c = collect()
  c.feed('data: lost')
  expect(c.frames).toEqual([])
})

test('hands [DONE] through verbatim as data', () => {
  const c = collect()
  c.feed('data: [DONE]\n\n')
  expect(c.frames).toEqual([{ event: undefined, data: '[DONE]' }])
})

test('a \\r\\n split across two chunks is one line ending, not a dispatch', () => {
  const c = collect()
  c.feed('data: x\r')
  c.feed('\ndata: y\r\n\r\n')
  expect(c.frames).toEqual([{ event: undefined, data: 'x\ny' }])
})

test('every chunk boundary yields the same frames', () => {
  const stream = 'event: turn\ndata: {"a":1}\r\ndata: two\r\n\r\n: ping\ndata: [DONE]\n\n'
  const whole = collect()
  whole.feed(stream)
  for (let at = 1; at < stream.length; at++) {
    const split = collect()
    split.feed(stream.slice(0, at))
    split.feed(stream.slice(at))
    expect(split.frames).toEqual(whole.frames)
  }
  const drip = collect()
  for (const ch of stream) drip.feed(ch)
  expect(drip.frames).toEqual(whole.frames)
})

// The fall-back decoder (no TextDecoder global) must carry a multibyte
// character split across chunks — the case streaming exists to survive. The
// TextDecoder face is exercised by the environment; this pins the hand-rolled
// half by driving utf8() against every split point of a mixed string.
test('utf8 fallback carries split multibyte sequences across chunks', () => {
  const hadTextDecoder = globalThis.TextDecoder
  // Simulate a Hermes build without the global.
  delete (globalThis as { TextDecoder?: unknown }).TextDecoder
  try {
    const text = 'a✓漢🙂z' // 1-, 3-, 3-, 4-byte sequences around ASCII
    const bytes = Buffer.from(text, 'utf8')
    for (let at = 1; at < bytes.length; at++) {
      const d = utf8()
      const out = d.decode(new Uint8Array(bytes.subarray(0, at))) + d.decode(new Uint8Array(bytes.subarray(at))) + d.flush()
      expect(out).toBe(text)
    }
    // A sequence still open at end of stream flushes as U+FFFD, TextDecoder's
    // own non-fatal answer.
    const cut = utf8()
    const partial = cut.decode(new Uint8Array(bytes.subarray(0, 2))) + cut.flush()
    expect(partial).toBe('a�')
  } finally {
    ;(globalThis as { TextDecoder?: unknown }).TextDecoder = hadTextDecoder
  }
})
