require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# Without this podspec the expo-modules autolinker silently skips this folder
# (it scans top-level dirs for *.podspec). The result is the Swift native module
# never compiles into the app and `requireNativeModule('WatchBridge')` throws at
# runtime, breaking watch → iPhone delivery entirely.
Pod::Spec.new do |s|
  s.name           = 'WatchBridge'
  s.version        = package['version']
  s.summary        = 'Apple Watch <-> iPhone WatchConnectivity bridge for ZenRun'
  s.description    = 'Local Expo module that exposes WCSession workout payloads to React Native.'
  s.license        = package['license']
  s.author         = ''
  s.homepage       = 'https://example.com'
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,swift}'
end
