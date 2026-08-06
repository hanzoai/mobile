const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins')

// Android picture-in-picture needs two manifest facts on the main activity:
// the capability flag, and configChanges entries so entering or resizing PiP
// does not tear the activity down and recreate it mid-run.
const changes = ['screenSize', 'smallestScreenSize', 'screenLayout', 'orientation']

module.exports = function pip(config) {
  return withAndroidManifest(config, (config) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults)
    activity.$['android:supportsPictureInPicture'] = 'true'
    const have = (activity.$['android:configChanges'] || '').split('|').filter(Boolean)
    for (const change of changes) {
      if (!have.includes(change)) have.push(change)
    }
    activity.$['android:configChanges'] = have.join('|')
    return config
  })
}
