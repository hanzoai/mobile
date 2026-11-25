import { GuiProvider } from '@hanzo/gui'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useSyncExternalStore } from 'react'
import { Platform } from 'react-native'

import { PipCard } from '@/components/pip/PipCard'
import { gui } from '@/lib/gui'
import * as prefs from '@/lib/prefs'
import { ground } from '@/lib/theme'
import * as widget from '@/lib/widget'

export default function Layout() {
  const currentPrefs = useSyncExternalStore(prefs.subscribe, prefs.snapshot)

  // The home-screen widget follows the run registry for the life of the
  // root; preferences hydrate custom API & local hanzod endpoints once.
  useEffect(() => {
    void prefs.hydrate()
    return widget.follow()
  }, [])

  return (
    <GuiProvider config={gui} defaultTheme="dark" telemetry={false}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: ground },
        }}
      >
        <Stack.Screen name="auth" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
      {Platform.OS === 'android' && currentPrefs.pipEnabled ? <PipCard /> : null}
    </GuiProvider>
  )
}
