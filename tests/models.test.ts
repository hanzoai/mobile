import { defaultModel, models } from '@/lib/models'

// The zen naming law under test: zen5* are text models, zen-<noun> ids are
// modality SKUs. The default may only be a text model — unless the catalog
// holds nothing else, in which case the first id wins over inventing one.

test('zen5 wins whenever the catalog carries it', () => {
  expect(defaultModel(['zen-embedding', 'zen-image', 'zen5', 'zen5-mini'])).toBe('zen5')
})

test('without zen5, the first zen text generation wins — never a modality SKU', () => {
  expect(defaultModel(['other-model', 'zen-image', 'zen-vl', 'zen5-mini'])).toBe('zen5-mini')
})

test('with only modality SKUs, the first id wins; no brand preference sneaks in', () => {
  expect(defaultModel(['another-model', 'zen-image', 'zen-vl'])).toBe('another-model')
  // Even a catalog of nothing but modality SKUs answers with its first id
  // rather than null — a real credentialed catalog is never second-guessed.
  expect(defaultModel(['zen-image', 'zen-vl'])).toBe('zen-image')
})

test('an empty catalog is null, never an invented id', () => {
  expect(defaultModel([])).toBeNull()
})

test('models() reads the OpenAI envelope, dedupes and sorts', async () => {
  const real = globalThis.fetch
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ data: [{ id: 'zen5' }, { id: 'zen-image' }, { id: 'zen5' }, { id: '' }, {}] }),
  })) as unknown as typeof fetch
  try {
    await expect(models()).resolves.toEqual(['zen-image', 'zen5'])
  } finally {
    globalThis.fetch = real
  }
})
