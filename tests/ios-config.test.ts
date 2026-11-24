import fs from 'node:fs'
import path from 'node:path'

type ExpoConfigShape = {
  version: string
  ios: {
    bundleIdentifier: string
    appleTeamId?: string
    icon?: string
  }
  plugins: Array<string | [string, Record<string, unknown>]>
  mods?: {
    ios?: {
      entitlements?: (cfg: { modResults: Record<string, unknown> }) => Promise<{
        modResults: Record<string, unknown>
      }>
      infoPlist?: (cfg: { modResults: Record<string, unknown> }) => Promise<{
        modResults: Record<string, unknown>
      }>
    }
  }
}

const appConfig = require('../app.config.js') as {
  (ctx?: { config?: ExpoConfigShape }): ExpoConfigShape
  resolveExpoConfig: (
    ctx?: { config?: ExpoConfigShape },
    env?: Record<string, string | undefined>
  ) => ExpoConfigShape
  BUNDLE_ID_RE: RegExp
}

const widgetIosPlugin = require('../plugins/widget-ios.js') as ((
  config: Record<string, unknown>
) => ExpoConfigShape) & {
  DEFAULT_APP_GROUP: string
  resolveAppGroup: (env?: Record<string, string | undefined>) => string
}

const targetConfigFn = require('../targets/widget/expo-target.config.js') as (
  config?: Partial<ExpoConfigShape>
) => {
  type: string
  name: string
  bundleIdentifier: string
  entitlements: { 'com.apple.security.application-groups': string[] }
}

const ENV_KEYS = [
  'HANZO_IOS_BUNDLE_ID',
  'HANZO_IOS_PERSONAL_TEAM_BUNDLE_ID',
  'HANZO_IOS_PERSONAL_TEAM',
  'HANZO_APP_GROUP',
  'HANZO_APPLE_TEAM_ID',
] as const

function withEnv(overrides: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  return async () => {
    const prev: Record<string, string | undefined> = {}
    for (const k of ENV_KEYS) {
      prev[k] = process.env[k]
      delete process.env[k]
    }
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    try {
      await fn()
    } finally {
      for (const k of ENV_KEYS) {
        if (prev[k] === undefined) delete process.env[k]
        else process.env[k] = prev[k]
      }
    }
  }
}

test('app.json and app.config.js agree on release version and default iOS config', () => {
  const raw = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'app.json'), 'utf8')
  ) as { expo: ExpoConfigShape }
  expect(raw.expo.version).toMatch(/^\d+\.\d+\.\d+$/)
  const resolved = appConfig.resolveExpoConfig({}, {})
  expect(resolved.version).toBe(raw.expo.version)
  expect(resolved.ios.bundleIdentifier).toBe('ai.hanzo.mobile')
  expect(resolved.plugins).toContain('./plugins/widget-ios.js')
})

test('HANZO_IOS_BUNDLE_ID and HANZO_IOS_PERSONAL_TEAM_BUNDLE_ID override ios.bundleIdentifier', () => {
  const fromPrimary = appConfig.resolveExpoConfig(
    {},
    {
      HANZO_IOS_BUNDLE_ID: 'dev.alice.hanzo',
      HANZO_IOS_PERSONAL_TEAM_BUNDLE_ID: 'dev.fallback.hanzo',
    }
  )
  expect(fromPrimary.ios.bundleIdentifier).toBe('dev.alice.hanzo')

  const fromPersonalAlias = appConfig.resolveExpoConfig(
    {},
    { HANZO_IOS_PERSONAL_TEAM_BUNDLE_ID: 'dev.bob-smith.hanzo2' }
  )
  expect(fromPersonalAlias.ios.bundleIdentifier).toBe('dev.bob-smith.hanzo2')
})

test('invalid HANZO_IOS_BUNDLE_ID values are rejected cleanly', () => {
  for (const bad of ['hanzo', '.ai.hanzo', 'ai.hanzo.', 'ai..hanzo', 'ai.hanzo mobile', 'ai/hanzo']) {
    expect(() => appConfig.resolveExpoConfig({}, { HANZO_IOS_BUNDLE_ID: bad })).toThrow(
      /Invalid iOS bundle identifier/
    )
  }
})

test('HANZO_IOS_PERSONAL_TEAM=1 strips ./plugins/widget-ios.js while preserving other plugins', () => {
  const resolved = appConfig.resolveExpoConfig(
    {},
    {
      HANZO_IOS_PERSONAL_TEAM: '1',
      HANZO_IOS_BUNDLE_ID: 'dev.alice.hanzo',
    }
  )
  expect(resolved.ios.bundleIdentifier).toBe('dev.alice.hanzo')
  expect(resolved.plugins).not.toContain('./plugins/widget-ios.js')
  expect(resolved.plugins).toContain('./plugins/pip.js')
  expect(resolved.plugins).toContain('./plugins/widget-android.js')
})

test(
  'plugins/widget-ios.js is a no-op when HANZO_IOS_PERSONAL_TEAM=1',
  withEnv({ HANZO_IOS_PERSONAL_TEAM: '1' }, () => {
    const input = { name: 'Hanzo', slug: 'hanzo', ios: { bundleIdentifier: 'dev.alice.hanzo' } }
    const out = widgetIosPlugin(input)
    expect(out).toBe(input)
    expect(out.mods).toBeUndefined()
  })
)

test(
  'plugins/widget-ios.js wires default group.ai.hanzo.mobile and respects HANZO_APP_GROUP override',
  withEnv({ HANZO_APP_GROUP: 'group.com.acme.hanzo' }, async () => {
    expect(widgetIosPlugin.resolveAppGroup({})).toBe('group.ai.hanzo.mobile')
    expect(widgetIosPlugin.resolveAppGroup({ HANZO_APP_GROUP: 'group.com.acme.hanzo' })).toBe(
      'group.com.acme.hanzo'
    )

    const out = widgetIosPlugin({
      name: 'Hanzo',
      slug: 'hanzo',
      ios: { bundleIdentifier: 'com.acme.hanzo', appleTeamId: 'TEAM123456' },
      _internal: { projectRoot: path.resolve(__dirname, '..') },
    })
    expect(out.mods?.ios?.entitlements).toBeDefined()
    const modded = await out.mods!.ios!.entitlements!({ modResults: {} })
    expect(modded.modResults['com.apple.security.application-groups']).toContain(
      'group.com.acme.hanzo'
    )

    const targetCfg = targetConfigFn({ ios: { bundleIdentifier: 'com.acme.hanzo' } })
    expect(targetCfg.bundleIdentifier).toBe('com.acme.hanzo.widget')
    expect(targetCfg.entitlements['com.apple.security.application-groups']).toEqual([
      'group.com.acme.hanzo',
    ])
  })
)
