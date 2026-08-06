Pod::Spec.new do |s|
  s.name           = 'WidgetModule'
  s.version        = '0.1.0'
  s.summary        = 'App Group state for the Hanzo home-screen widget'
  s.description    = 'Writes shared widget state and reloads WidgetKit timelines.'
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
