Pod::Spec.new do |s|
  s.name           = 'Pip'
  s.version        = '0.1.0'
  s.summary        = 'Status card in the system Picture in Picture window'
  s.description    = 'Feeds rendered status frames to AVKit so Hanzo work stays visible after the user leaves the app.'
  s.author         = 'Hanzo AI'
  s.homepage       = 'https://hanzo.ai'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
