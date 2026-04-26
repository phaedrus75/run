import Foundation
import WatchKit

/// Legacy WatchKit2 extensions need a `WKExtensionDelegate` to be considered
/// fully launched. Without one, lifecycle events (incl. WCSession activation)
/// can race the SwiftUI App entry point. We activate WCSession here so the
/// watch is ready to send/receive immediately on launch.
final class ExtensionDelegate: NSObject, WKExtensionDelegate {
  func applicationDidFinishLaunching() {
    WatchSession.shared.activate()
  }

  func applicationDidBecomeActive() {
    // Re-activate in case the session went inactive while suspended.
    WatchSession.shared.activate()
  }
}
