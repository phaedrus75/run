# ZenRun Apple Watch

SwiftUI WatchKit extension + watch app container. Sources are copied into `frontend/ios/` during `expo prebuild` by the `withWatchApp` config plugin (`frontend/plugins/withWatchApp.js`).

## Behaviour

- **Walk** / **Run** with independent GPS (CoreLocation), same accuracy / distance / speed filters as the iPhone tracker.
- **Save** sends a property-list–safe payload via `WCSession.transferUserInfo` to the iPhone; `WatchBridge` receives it and `watchBridge.ts` uploads with `walkApi.create` / `runApi.create`.

## Local E2E

1. `cd frontend && npx expo prebuild --platform ios`
2. Open `ios/ZenRun.xcworkspace` in Xcode, select an **iPhone + Watch** run destination, build & run.
3. Start a walk on the Watch, **Save** — confirm the alert on iPhone and the new entry under Walks / Runs.

## Simulator

Pair Watch simulator with iPhone simulator in Xcode’s **Window → Devices and Simulators**, then run both targets.
