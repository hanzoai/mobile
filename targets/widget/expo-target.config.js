/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => {
  const bundleBase =
    config?.ios?.bundleIdentifier ||
    process.env.HANZO_IOS_BUNDLE_ID?.trim() ||
    process.env.HANZO_IOS_PERSONAL_TEAM_BUNDLE_ID?.trim() ||
    'ai.hanzo.mobile'
  const appGroup = process.env.HANZO_APP_GROUP?.trim() || 'group.ai.hanzo.mobile'

  return {
    type: 'widget',
    name: 'HanzoWidget',
    bundleIdentifier: `${bundleBase}.widget`,
    // containerBackground(for: .widget) — the one honest way to paint the card
    // under StandBy and smart stacks — exists from 17.0.
    deploymentTarget: '17.0',
    entitlements: {
      'com.apple.security.application-groups': [appGroup],
    },
  }
}
