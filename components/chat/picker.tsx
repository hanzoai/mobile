import { Button, ScrollView, Sheet, Spinner, Text, XStack, YStack } from '@hanzo/gui'
import { Check } from '@hanzogui/lucide-icons-2'

// The model picker: the live catalog in a sheet, nothing invented. The
// three states are all honest — loading, the exact refusal sentence with a
// retry only because loading a list is a service concern, or the list.
export function Picker(props: {
  open: boolean
  onClose(): void
  model: string | null
  ids: string[] | null
  note: string | null
  onPick(id: string): void
  onReload(): void
}) {
  return (
    <Sheet
      modal
      open={props.open}
      onOpenChange={(open: boolean) => {
        if (!open) props.onClose()
      }}
      snapPointsMode="percent"
      snapPoints={[70]}
      dismissOnSnapToBottom
    >
      <Sheet.Overlay bg="rgba(0,0,0,0.6)" />
      <Sheet.Frame bg="$background" borderTopWidth={1} borderColor="$borderColor" rounded="$6">
        <Sheet.Handle bg="$color4" />
        <YStack px="$4" pt="$2" pb="$3" borderBottomWidth={1} borderColor="$borderColor">
          <Text color="$color" fontSize={16} fontWeight="600">
            Model
          </Text>
          <Text color="$color10" fontSize={12} mt="$1">
            Live from api.hanzo.ai
          </Text>
        </YStack>
        {props.ids === null && !props.note ? (
          <YStack flex={1} items="center" justify="center" gap="$3">
            <Spinner color="$color10" />
            <Text color="$color10" fontSize={13}>
              Loading the catalog
            </Text>
          </YStack>
        ) : props.note ? (
          <YStack flex={1} items="center" justify="center" p="$5" gap="$3">
            <Text color="$color" fontSize={14} text="center" lineHeight={20}>
              {props.note}
            </Text>
            <Button size="$3" bg="$color3" color="$color" onPress={props.onReload}>
              Reload
            </Button>
          </YStack>
        ) : props.ids && props.ids.length === 0 ? (
          <YStack flex={1} items="center" justify="center" p="$5">
            <Text color="$color10" fontSize={14} text="center">
              The catalog returned no models.
            </Text>
          </YStack>
        ) : (
          <ScrollView flex={1}>
            <YStack py="$2">
              {(props.ids ?? []).map((id) => (
                <XStack
                  key={id}
                  px="$4"
                  py="$3"
                  items="center"
                  justify="space-between"
                  pressStyle={{ bg: '$color2' }}
                  onPress={() => {
                    props.onPick(id)
                    props.onClose()
                  }}
                >
                  <Text color={id === props.model ? '$color' : '$color11'} fontSize={15}>
                    {id}
                  </Text>
                  {id === props.model ? <Check size={16} color="$color" /> : null}
                </XStack>
              ))}
            </YStack>
          </ScrollView>
        )}
      </Sheet.Frame>
    </Sheet>
  )
}
