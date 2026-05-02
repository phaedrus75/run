/**
 * ZenRunWatchApp
 * --------------
 * SwiftUI @main entry point for the modern single-target watchOS app.
 *
 * Architecture (Xcode 14+ / watchOS 9+):
 *   - One target, product type `com.apple.product-type.application`.
 *   - No separate WatchKit Extension target (the legacy
 *     `application.watchapp2` / `watchkit2-extension` split is deprecated).
 *   - WCSession is owned by `WatchSessionManager` (an ObservableObject) which
 *     activates exactly once on app launch and is shared via @StateObject.
 *
 * Build 30 ships this as a hello-world that proves the WCSession channel
 * end-to-end (transferUserInfo, applicationContext, sendMessage reply).
 * GPS / HealthKit / workout features are deliberately NOT included here —
 * they will be re-added in subsequent builds once the channel is proven.
 */

import SwiftUI

@main
struct ZenRunWatchApp: App {
    init() {
        // Activate WCSession as early as possible so we don't miss reachability
        // changes the iPhone may broadcast before our first view appears.
        // SwiftUI subscribes to the @Published properties via the
        // .environmentObject below.
        WatchSessionManager.shared.start()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(WatchSessionManager.shared)
        }
    }
}
