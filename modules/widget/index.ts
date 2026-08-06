import { requireOptionalNativeModule } from 'expo-modules-core'

// Typed binding to the native module. Null wherever it is absent — web,
// Expo Go — so lib/widget.ts can degrade to a silent no-op. Every platform
// registers the ONE name 'Widget'.
export type Native = {
  set(stateJson: string): void
}

export default requireOptionalNativeModule<Native>('Widget')
