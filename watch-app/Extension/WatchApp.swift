import SwiftUI

@main
struct ZenRunWatchApp: App {
  @StateObject private var workout = WorkoutViewModel()

  var body: some Scene {
    WindowGroup {
      HomeView()
        .environmentObject(workout)
    }
  }
}
