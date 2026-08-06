import { GuiProvider } from '@hanzo/gui'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

import { gui } from '@/lib/gui'
import { ground } from '@/lib/theme'

export default function Layout() {
  return (
    <GuiProvider config={gui} defaultTheme="dark">
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: ground },
        }}
      />
    </GuiProvider>
  )
}
