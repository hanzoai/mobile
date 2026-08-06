import { GuiProvider } from '@hanzo/gui'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { Platform } from 'react-native'

import { PipCard } from '@/components/pip/PipCard'
import { gui } from '@/lib/gui'
import { ground } from '@/lib/theme'
import * as widget from '@/lib/widget'

export default function Layout() {
  // The home-screen widget follows the run registry for the life of the
  // root; the subscription dies with it, so a remount cannot stack copies.
  useEffect(() => widget.follow(), [])

  return (
    <GuiProvider config={gui} defaultTheme="dark">
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: ground },
        }}
      />
      {Platform.OS === 'android' ? <PipCard /> : null}
    </GuiProvider>
  )
}
