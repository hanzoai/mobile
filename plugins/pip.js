const { withAndroidManifest, withInfoPlist, AndroidConfig } = require('expo/config-plugins')

// Everything picture-in-picture needs from prebuild, in one plugin.
//
// Android: two manifest facts on the main activity — the capability flag,
// and configChanges entries so entering or resizing PiP does not tear the
// activity down and recreate it mid-run.
//
// iOS: the audio background mode. The sample-buffer window keeps drawing
// after the app leaves the foreground, and without this mode the process
// suspends and the card freezes mid-run.
const changes = ['screenSize', 'smallestScreenSize', 'screenLayout', 'orientation']

module.exports = function pip(config) {
  config = withAndroidManifest(config, (config) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults)
    activity.$['android:supportsPictureInPicture'] = 'true'
    const have = (activity.$['android:configChanges'] || '').split('|').filter(Boolean)
    for (const change of changes) {
      if (!have.includes(change)) have.push(change)
    }
    activity.$['android:configChanges'] = have.join('|')
    return config
  })
  return withInfoPlist(config, (config) => {
    const modes = config.modResults.UIBackgroundModes ?? []
    if (!modes.includes('audio')) modes.push('audio')
    config.modResults.UIBackgroundModes = modes
    return config
  })
}
