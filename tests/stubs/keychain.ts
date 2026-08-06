// In-memory expo-secure-store: exactly the three calls lib/store makes.
const held = new Map<string, string>()

export async function getItemAsync(key: string): Promise<string | null> {
  return held.get(key) ?? null
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  held.set(key, value)
}

export async function deleteItemAsync(key: string): Promise<void> {
  held.delete(key)
}
