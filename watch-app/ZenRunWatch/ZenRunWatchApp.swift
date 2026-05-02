/**
 * ZenRunWatchApp
 * --------------
 * SwiftUI @main entry point for the modern single-target watchOS app.
 *
 * Architecture (Xcode 14+ / watchOS 9+):
 *   - One target, product type `com.apple.product-type.application`.
 *   - No separate WatchKit Extension target.
 *   - WCSession is owned by `WatchSessionManager` and activated in init() so
 *     the iPhone can see the channel before the first view appears.
 *   - The active workout (if any) is owned by `ActiveWorkoutController`, also
 *     a `@StateObject` injected as an environment object — that way both the
 *     home screen and the active-workout view see the same instance and the
 *     workout doesn't restart when the user navigates back to home.
 */

import SwiftUI

@main
struct ZenRunWatchApp: App {
    @StateObject private var workout = ActiveWorkoutController()

    init() {
        WatchSessionManager.shared.start()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(WatchSessionManager.shared)
                .environmentObject(workout)
        }
    }
}
