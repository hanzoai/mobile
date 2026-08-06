import { request } from './api'

// The live catalog, ids only, sorted. /v1/models is OpenAI-shaped:
// { data: [{ id }] }. Nothing here is ever invented — an empty catalog
// returns an empty list and the caller renders that honestly.
export async function models(): Promise<string[]> {
  const catalog = await request<{ data?: { id?: unknown }[] }>('/models')
  const ids = new Set<string>()
  for (const row of catalog.data ?? []) {
    if (typeof row?.id === 'string' && row.id) ids.add(row.id)
  }
  return [...ids].sort()
}

// zen5 when the catalog carries it, else the first zen text generation, else
// the first id at all. The modality trap: zen-<noun> ids (zen-image, zen-vl,
// zen-voice, ...) are modality models, not chat text models, so the fallback
// matches /^zen\d/ and never /^zen-/.
export function defaultModel(ids: string[]): string | null {
  if (ids.includes('zen5')) return 'zen5'
  return ids.find((id) => /^zen\d/.test(id)) ?? ids[0] ?? null
}

// The vision modality: a turn with an image attached is sent here.
export const vision = 'zen-vl'
