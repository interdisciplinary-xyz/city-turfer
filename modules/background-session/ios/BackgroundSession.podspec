Pod::Spec.new do |s|
  s.name           = 'BackgroundSession'
  s.version        = '1.0.0'
  s.summary        = 'Holds a CLBackgroundActivitySession while CityTurfer records'
  s.author         = 'CityTurfer'
  s.homepage       = 'https://github.com/interdisciplinary-xyz/city-turfer'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.swift'
end
