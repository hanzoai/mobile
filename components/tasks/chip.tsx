import { Text, XStack, YStack, type ColorTokens } from '@hanzo/gui'

// Status hues live here and nowhere else: green is moving, amber is waiting,
// red failed, finished is quiet. A word this map does not know renders
// neutral instead of pretending to be one of the four.
const hue: Record<string, ColorTokens> = {
  running: '$green10',
  paused: '$yellow10',
  done: '$color11',
  error: '$red10',
}

export function Chip({ word }: { word: string }) {
  return (
    <XStack items="center" gap="$1.5" px="$2.5" py="$1" rounded="$10" borderWidth={1} borderColor="$borderColor">
      <YStack width={6} height={6} rounded={3} bg={hue[word] ?? '$color11'} />
      <Text color="$color11" fontSize={12}>
        {word}
      </Text>
    </XStack>
  )
}
