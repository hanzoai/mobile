const appJson = require('./app.json')

// Valid Apple reverse-DNS bundle identifier (at least two dot-separated segments
// of ASCII letters, digits, or hyphens, e.g. ai.hanzo.mobile or dev.alice.hanzo).
const BUNDLE_ID_RE = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/
const WIDGET_IOS_PLUGIN = './plugins/widget-ios.js'

function isWidgetIosPlugin(entry) {
  if (entry === WIDGET_IOS_PLUGIN || entry === 'plugins/widget-ios.js') return true
  if (Array.isArray(entry)) {
    return entry[0] === WIDGET_IOS_PLUGIN || entry[0] === 'plugins/widget-ios.js'
  }
  return false
}

function resolveExpoConfig(context = {}, env = process.env) {
  const source = context && context.config ? context.config : appJson.expo
  // Object spread preserves @expo/config's NON_STANDARD_SYMBOL marker on
  // request.config while avoiding mutating cached app.json objects in place.
  const config = {
    ...source,
    ios: { ...(source.ios || {}) },
    plugins: Array.isArray(source.plugins) ? [...source.plugins] : source.plugins,
  }

  const rawBundleId =
    env.HANZO_IOS_BUNDLE_ID?.trim() ||
    env.HANZO_IOS_PERSONAL_TEAM_BUNDLE_ID?.trim() ||
    ''

  if (rawBundleId) {
    if (!BUNDLE_ID_RE.test(rawBundleId)) {
      throw new Error(
        `Invalid iOS bundle identifier "${rawBundleId}". ` +
          'Expected reverse-DNS segments matching /^[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)+$/ (e.g. dev.alice.hanzo).'
      )
    }
    config.ios.bundleIdentifier = rawBundleId
  }

  const teamId = env.HANZO_APPLE_TEAM_ID?.trim() || ''
  if (teamId) {
    config.ios.appleTeamId = teamId
  }

  if (env.HANZO_IOS_PERSONAL_TEAM === '1' && Array.isArray(config.plugins)) {
    config.plugins = config.plugins.filter((plugin) => !isWidgetIosPlugin(plugin))
  }

  return config
}

module.exports = (context) => resolveExpoConfig(context, process.env)
module.exports.resolveExpoConfig = resolveExpoConfig
module.exports.BUNDLE_ID_RE = BUNDLE_ID_RE
