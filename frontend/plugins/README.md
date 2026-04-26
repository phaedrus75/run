# Config plugins

- **`withWatchApp.js`** — Embeds the Apple Watch targets during `expo prebuild` (copies `../../watch-app` into `ios/` and patches `project.pbxproj` via `xcode`). Implemented as **JavaScript** because Expo’s config-plugin loader resolves `@expo/config-plugins` reliably from CommonJS here.
