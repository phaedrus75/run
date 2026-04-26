import SwiftUI

@main
struct ZenRunWatchApp: App {
  // WatchKit2 extension lifecycle adapter. Without this, a SwiftUI `App`
  // running inside a legacy WatchKit2 extension never gets the proper
  // `applicationDidFinishLaunching` callback and WCSession can race startup.
  @WKExtensionDelegateAdaptor(ExtensionDelegate.self) private var extDelegate

  @StateObject private var workout = WorkoutViewModel()

  var body: some Scene {
    WindowGroup {
      HomeView()
        .environmentObject(workout)
    }
  }
}
