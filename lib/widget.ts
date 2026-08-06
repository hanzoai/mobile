// Home-screen widget state. The widget agent lands the native write in
// modules/widget; until then this is a safe no-op with the signature fixed.

export type State = { snippet: string; updatedAt: number }

export async function setState(state: State): Promise<void> {}
