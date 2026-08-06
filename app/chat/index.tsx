import { Redirect } from 'expo-router'

// Deep link target hanzo://chat — the widget's main tap. The chat surface
// lives on the home tab; this route only forwards to it.
export default function ChatLink() {
  return <Redirect href="/" />
}
