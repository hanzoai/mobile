import { Button, Card, Text, XStack, YStack } from '@hanzo/gui'
import { FileText, Image as Frame, X } from '@hanzogui/lucide-icons-2'
import * as documents from 'expo-document-picker'
import * as photos from 'expo-image-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import * as draft from '@/components/chat/draft'

// The attach flow: what goes with the next message. Images land in the
// draft as data: URIs and ride the OpenAI content-parts shape; anything
// else is told the truth — not supported yet. Content shared into Hanzo
// from other apps will land here too.
export default function Send() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { type } = useLocalSearchParams<{ type?: string }>()
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // The widget states its intent in the URL — hanzo://send?type=image opens
  // the library, type=file the document picker. Landing on a chooser that
  // ignored the tap would make the shortcut a lie. Once only: coming back
  // from the picker must not reopen it.
  const acted = useRef(false)
  useEffect(() => {
    if (acted.current) return
    acted.current = true
    if (type === 'image') void photo()
    else if (type === 'file') void file()
    // photo and file are stable for the life of the mount.
  }, [type]) // eslint-disable-line react-hooks/exhaustive-deps

  async function photo() {
    setNotice(null)
    setBusy(true)
    try {
      const picked = await photos.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.7,
      })
      const asset = picked.assets?.[0]
      if (picked.canceled || !asset) return
      if (!asset.base64) {
        setNotice('That image could not be read.')
        return
      }
      draft.add(`data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`)
      router.back()
    } finally {
      setBusy(false)
    }
  }

  async function file() {
    setNotice(null)
    setBusy(true)
    try {
      const picked = await documents.getDocumentAsync({ copyToCacheDirectory: false })
      const asset = picked.assets?.[0]
      if (picked.canceled || !asset) return
      setNotice(`"${asset.name}" is not supported yet — only images attach for now.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <YStack flex={1} bg="$background" pt={insets.top + 8} pb={insets.bottom + 16} px="$4">
      <XStack items="center" justify="space-between" pb="$3">
        <Text color="$color" fontSize={16} fontWeight="600">
          Attach
        </Text>
        <Button
          size="$2.5"
          circular
          chromeless
          icon={<X size={18} color="$color10" />}
          onPress={() => router.back()}
          aria-label="Close"
        />
      </XStack>

      <YStack gap="$3" mt="$2">
        <Card
          p="$4"
          bg="$color2"
          borderWidth={1}
          borderColor="$borderColor"
          rounded="$6"
          pressStyle={{ bg: '$color3' }}
          onPress={busy ? undefined : photo}
        >
          <XStack items="center" gap="$3">
            <Frame size={20} color="$color" />
            <YStack flex={1}>
              <Text color="$color" fontSize={15} fontWeight="600">
                Photo
              </Text>
              <Text color="$color10" fontSize={13} mt="$1">
                Attach an image from the library. The turn switches to zen-vl.
              </Text>
            </YStack>
          </XStack>
        </Card>

        <Card
          p="$4"
          bg="$color2"
          borderWidth={1}
          borderColor="$borderColor"
          rounded="$6"
          pressStyle={{ bg: '$color3' }}
          onPress={busy ? undefined : file}
        >
          <XStack items="center" gap="$3">
            <FileText size={20} color="$color" />
            <YStack flex={1}>
              <Text color="$color" fontSize={15} fontWeight="600">
                File
              </Text>
              <Text color="$color10" fontSize={13} mt="$1">
                Documents are not supported yet.
              </Text>
            </YStack>
          </XStack>
        </Card>

        {notice ? (
          <Card p="$3.5" bg="$color2" borderWidth={1} borderColor="$borderColor" rounded="$4">
            <Text color="$color11" fontSize={13} lineHeight={19}>
              {notice}
            </Text>
          </Card>
        ) : null}
      </YStack>
    </YStack>
  )
}
