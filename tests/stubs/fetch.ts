// lib/sse imports expo/fetch because only that exposes a streaming body on
// native. Under node the platform fetch does, so it stands in unchanged.
export const fetch = globalThis.fetch
