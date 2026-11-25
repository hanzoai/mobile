import { Button, Input, Separator, Text, XStack, YStack } from '@hanzo/gui'
import { ChevronRight, Search, X } from '@hanzogui/lucide-icons-2'
import type { ReactNode } from 'react'

// Shared Hanzo Dev-style @hanzo/gui grouped settings primitives:
// Pure #000000 screen ground + #0d0d10 rounded $4 1px rgba(255,255,255,0.08) cards.
export const SETTINGS_CARD_BG = '#0d0d10'
export const SETTINGS_CARD_BORDER = 'rgba(255,255,255,0.08)'
export const SETTINGS_ROW_DIVIDER = 'rgba(255,255,255,0.06)'
export const SETTINGS_ICON_BG = '#16161c'

export function SettingsSearchInput({
  value,
  onChangeText,
  placeholder = 'Search settings…',
}: {
  value: string
  onChangeText: (next: string) => void
  placeholder?: string
}) {
  return (
    <XStack
      bg={SETTINGS_CARD_BG}
      borderWidth={1}
      borderColor={SETTINGS_CARD_BORDER}
      rounded="$4"
      px="$3"
      height={42}
      items="center"
      gap="$2"
    >
      <Search size={16} color="$color10" />
      <Input
        flex={1}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="$color10"
        bg="transparent"
        borderWidth={0}
        px={0}
        height={40}
        color="#fafafa"
        fontSize={14}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 ? (
        <Button
          size="$2"
          circular
          chromeless
          icon={<X size={15} color="$color10" />}
          onPress={() => onChangeText('')}
          aria-label="Clear search"
        />
      ) : null}
    </XStack>
  )
}

export function SettingsSectionCard({
  title,
  footer,
  children,
}: {
  title: string
  footer?: string
  children: ReactNode
}) {
  return (
    <YStack gap="$1.5">
      <Text
        color="rgba(250,250,250,0.48)"
        fontSize={11}
        fontWeight="600"
        letterSpacing={1.1}
        px="$1"
      >
        {title.toUpperCase()}
      </Text>
      <YStack
        bg={SETTINGS_CARD_BG}
        borderWidth={1}
        borderColor={SETTINGS_CARD_BORDER}
        rounded="$4"
        overflow="hidden"
      >
        {children}
      </YStack>
      {footer ? (
        <Text color="rgba(250,250,250,0.42)" fontSize={12} lineHeight={17} px="$1">
          {footer}
        </Text>
      ) : null}
    </YStack>
  )
}

export function SettingsItemRow({
  icon,
  label,
  subtitle,
  value,
  trailing,
  showChevron,
  isLast,
  onPress,
}: {
  icon: ReactNode
  label: string
  subtitle?: string
  value?: string
  trailing?: ReactNode
  showChevron?: boolean
  isLast?: boolean
  onPress?: () => void
}) {
  return (
    <YStack>
      <XStack
        px="$3.5"
        py="$3"
        items="center"
        justify="space-between"
        gap="$3"
        pressStyle={onPress ? { bg: 'rgba(255,255,255,0.04)' } : undefined}
        onPress={onPress}
      >
        <XStack items="center" gap="$3" flex={1}>
          <YStack
            width={30}
            height={30}
            rounded={8}
            bg={SETTINGS_ICON_BG}
            borderWidth={1}
            borderColor="rgba(255,255,255,0.06)"
            items="center"
            justify="center"
          >
            {icon}
          </YStack>
          <YStack flex={1} gap={2}>
            <Text color="#fafafa" fontSize={14} fontWeight="500" numberOfLines={1}>
              {label}
            </Text>
            {subtitle ? (
              <Text color="rgba(250,250,250,0.48)" fontSize={12} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </YStack>
        </XStack>
        <XStack items="center" gap="$1.5" shrink={1}>
          {trailing ?? (
            value ? (
              <Text color="rgba(250,250,250,0.58)" fontSize={13} numberOfLines={1}>
                {value}
              </Text>
            ) : null
          )}
          {showChevron ? <ChevronRight size={15} color="$color10" /> : null}
        </XStack>
      </XStack>
      {!isLast ? <Separator borderColor={SETTINGS_ROW_DIVIDER} /> : null}
    </YStack>
  )
}

export function SettingsPillToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <XStack
      width={44}
      height={26}
      rounded={9999}
      p={2}
      bg={enabled ? '#ffffff' : '#222228'}
      borderWidth={1}
      borderColor={enabled ? '#ffffff' : 'rgba(255,255,255,0.12)'}
      items="center"
      justify={enabled ? 'flex-end' : 'flex-start'}
      onPress={onToggle}
      aria-label={enabled ? 'Enabled' : 'Disabled'}
    >
      <YStack
        width={20}
        height={20}
        rounded={9999}
        bg={enabled ? '#09090b' : 'rgba(250,250,250,0.65)'}
      />
    </XStack>
  )
}
