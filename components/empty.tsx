import { Card, Text, YStack } from '@hanzo/gui'

// The honest empty state: names what a screen will hold and what exists
// today. Feature agents replace whole screens; nothing here pretends.
// The v5 config is shorthands-only and token-strict, so styling speaks
// tokens — the brand values live in lib/gui.ts.
export function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <YStack flex={1} bg="$background" items="center" justify="center" p="$6">
      <Card
        p="$5"
        width="100%"
        maxW={420}
        bg="$color2"
        borderWidth={1}
        borderColor="$borderColor"
        rounded="$6"
      >
        <Text color="$color" fontSize={17} fontWeight="600">
          {title}
        </Text>
        <Text color="$color11" mt="$2" fontSize={14} lineHeight={20}>
          {detail}
        </Text>
      </Card>
    </YStack>
  )
}
