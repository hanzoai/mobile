import { ListChecks, MessageCircle, Mic, Settings } from '@hanzogui/lucide-icons-2'
import { Tabs } from 'expo-router'

import { dim, fg, ground, hairline } from '@/lib/theme'

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: fg,
        tabBarInactiveTintColor: dim,
        tabBarStyle: {
          backgroundColor: ground,
          borderTopColor: hairline,
        },
        sceneStyle: { backgroundColor: ground },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused, size }) => (
            <MessageCircle color={focused ? '$color' : '$color11'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ focused, size }) => (
            <ListChecks color={focused ? '$color' : '$color11'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="voice"
        options={{
          title: 'Voice',
          tabBarIcon: ({ focused, size }) => (
            <Mic color={focused ? '$color' : '$color11'} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused, size }) => (
            <Settings color={focused ? '$color' : '$color11'} size={size} />
          ),
        }}
      />
    </Tabs>
  )
}
