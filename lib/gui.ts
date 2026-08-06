import { createGui } from '@hanzo/gui'
import { animations } from '@hanzogui/config'
import { defaultConfig } from '@hanzogui/config/v5'

import { fg, ground, hairline } from './theme'

// One gui config for the whole app. The v5 default resolves to system fonts
// on native, so nothing must load before first paint, and the animation
// driver is the react-native one from the config package — zero extra moving
// parts for the scaffold.
//
// The brand lands here and only here: the dark theme's ground, foreground
// and hairline are overridden once, and every surface speaks in tokens
// ($background, $color, $borderColor) rather than raw values.
export const gui = createGui({
  ...defaultConfig,
  animations,
  themes: {
    ...defaultConfig.themes,
    dark: {
      ...defaultConfig.themes.dark,
      background: ground,
      color: fg,
      borderColor: hairline,
    },
  },
})

export type Gui = typeof gui

declare module '@hanzo/gui' {
  interface GuiCustomConfig extends Gui {}
}
