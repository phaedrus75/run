# ZenRun Apple Watch

Modern single-target SwiftUI watchOS app. Sources are copied into
`frontend/ios/ZenRunWatch/` during `expo prebuild` by the `withWatchApp`
config plugin (`frontend/plugins/withWatchApp.js`).

## Architecture

- **One target.** ProductType `com.apple.product-type.application` (NOT the
  deprecated `application.watchapp2`). Apple removed the legacy two-target
  WatchKit Extension structure in Xcode 14.
- **SwiftUI lifecycle.** `@main struct ZenRunWatchApp: App` activates the
  WCSession through `WatchSessionManager.shared` on `init()`.
- **Companion linkage.** `Info.plist`'s `WKApplication = YES` and
  `WKCompanionAppBundleIdentifier = com.phaedrus75.runzen` pair the watch
  app with the iPhone app for WCSession.

## Phase 1 (build 30+) — hello-world channel proof

This build deliberately ships only:

- A two-button UI: "Send Hello" (`transferUserInfo`) and "Send Context"
  (`updateApplicationContext`).
- Live status display (activation state, reachability, send count).
- Replies to `ping` / `resend_last` messages from the iPhone-side
  `WatchBridgeSession`.

GPS, HealthKit, active-workout UI, and the full save flow will be re-added
in subsequent builds once the channel is verified end-to-end on TestFlight.

### Acceptance criteria

Confirm via the iPhone app's `Beta → Apple Watch Sync` diagnostic screen:

1. Activation reads `activated`.
2. Reachable reads `yes` while the watch app is foregrounded.
3. Tapping "Send Hello" on the watch increments `transferUserInfo received`
   on the phone.
4. Tapping "Send Context" on the watch increments `applicationContext
   received`.
5. Tapping "Ping watch (live)" on the phone returns `pong: true`.

If any of these fail, debugging is now isolated to ~210 lines of Swift
across three files instead of 568 lines spread across nine.

## Local E2E

1. `cd frontend && npx expo prebuild --platform ios`
2. `cd frontend/ios && pod install`
3. Open `frontend/ios/ZenRun.xcworkspace` in Xcode, choose an "iPhone +
   Watch" run destination, build & run.
4. On the watch, tap "Send Hello"; confirm the iPhone diagnostics screen
   counter increments.

## File layout

```
watch-app/
├── README.md                       (this file)
└── ZenRunWatch/
    ├── Info.plist                  WKApplication, version sync placeholders
    ├── ZenRunWatchApp.swift        @main App, activates WatchSessionManager
    ├── ContentView.swift           Two-button UI + status block
    ├── WatchSessionManager.swift   ObservableObject WCSessionDelegate
    └── Assets.xcassets/
        ├── Contents.json
        └── AppIcon.appiconset/
            └── Contents.json       (AppIcon.png is copied from
                                     frontend/assets/icon.png at prebuild)
```
