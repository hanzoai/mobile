// expo-modules-core stand-in: a settable registry behind the one function
// the bindings call. A test installs a fake native module BEFORE requiring
// the code under test, since bindings capture the module at import.
const registry = new Map<string, unknown>()

export function requireOptionalNativeModule<T>(name: string): T | null {
  return (registry.get(name) as T | undefined) ?? null
}

export function install(name: string, impl: unknown): void {
  registry.set(name, impl)
}
