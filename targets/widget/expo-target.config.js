/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'HanzoWidget',
  bundleIdentifier: 'ai.hanzo.mobile.widget',
  // containerBackground(for: .widget) — the one honest way to paint the card
  // under StandBy and smart stacks — exists from 17.0.
  deploymentTarget: '17.0',
  entitlements: {
    'com.apple.security.application-groups': ['group.ai.hanzo.mobile'],
  },
}
