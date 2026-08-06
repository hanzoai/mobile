import native from '../modules/widget'
import * as runs from './runs'

// Home-screen widget state. The native half (modules/widget) persists
// {snippet, updatedAt} where the platform widget reads it — the App Group on
// iOS, app prefs on Android — and asks for a redraw; wherever the native
// module is absent — web, Expo Go — every call is a silent no-op so callers
// never branch on platform.

export type State = { snippet: string; updatedAt: number }

export async function setState(state: State): Promise<void> {
  if (!native) return
  try {
    native.set(JSON.stringify(state))
  } catch {
    // A stale widget must never surface as an app failure.
  }
}

// The chat screen calls this after each assistant turn. The widget shows two
// or three lines, so only the head of the text matters; whitespace collapses
// because answers are often markdown with hard newlines.
export function setLastMessage(text: string): void {
  const snippet = text.trim().replace(/\s+/g, ' ').slice(0, 200)
  if (!snippet) return
  void setState({ snippet, updatedAt: Date.now() })
}

// While the app is doing long work the widget follows the run registry. The
// registry emits on every patch and WidgetKit reload budgets are real, so
// only a changed line is pushed; a finished run writes nothing, leaving the
// last message in place.
let shown = ''

export function follow(): () => void {
  return runs.subscribe(() => {
    const run = runs.active()
    if (!run) return
    const line = `${run.title} — ${run.phase}`
    if (line === shown) return
    shown = line
    void setState({ snippet: line, updatedAt: Date.now() })
  })
}
