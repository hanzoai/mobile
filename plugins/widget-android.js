const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

// The widget needs two things the module itself cannot carry: a receiver in
// the APP manifest (launchers discover providers there, not in libraries),
// and its RemoteViews resources in the APP res tree — WidgetProvider lives in
// a library and inflates them through the app package at runtime. Both the
// manifest and android/ are prebuild products, so a config plugin lands them.

const provider = 'ai.hanzo.mobile.widget.WidgetProvider'

function receiver(app) {
  // Re-running prebuild must not stack duplicates: replace, never append twice.
  app.receiver = (app.receiver || []).filter((r) => r.$['android:name'] !== provider)
  app.receiver.push({
    $: { 'android:name': provider, 'android:exported': 'false' },
    'intent-filter': [
      { action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] },
    ],
    'meta-data': [
      { $: { 'android:name': 'android.appwidget.provider', 'android:resource': '@xml/widget_info' } },
    ],
  })
}

function copy(from, to) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name)
    const dst = path.join(to, entry.name)
    if (entry.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true })
      copy(src, dst)
    } else {
      fs.copyFileSync(src, dst)
    }
  }
}

module.exports = function widget(config) {
  config = withAndroidManifest(config, (config) => {
    receiver(AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults))
    return config
  })
  return withDangerousMod(config, [
    'android',
    (config) => {
      const from = path.join(config.modRequest.projectRoot, 'android-widget-res')
      const to = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res')
      copy(from, to)
      return config
    },
  ])
}
