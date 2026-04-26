import SwiftUI

struct HomeView: View {
  @EnvironmentObject private var workout: WorkoutViewModel

  var body: some View {
    NavigationStack {
      VStack(spacing: 12) {
        Text("ZenRun")
          .font(.headline)
          .padding(.bottom, 4)

        NavigationLink {
          ActiveWorkoutView()
            .onAppear {
              if workout.phase == .idle {
                workout.begin(.walk)
              }
            }
            .onDisappear {
              if workout.phase != .finished {
                workout.discard()
              }
            }
        } label: {
          Label("Walk", systemImage: "figure.walk")
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
        }
        .buttonStyle(.borderedProminent)
        .tint(.green)

        NavigationLink {
          ActiveWorkoutView()
            .onAppear {
              if workout.phase == .idle {
                workout.begin(.run)
              }
            }
            .onDisappear {
              if workout.phase != .finished {
                workout.discard()
              }
            }
        } label: {
          Label("Run", systemImage: "figure.run")
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
        }
        .buttonStyle(.borderedProminent)
        .tint(.orange)

        Spacer(minLength: 0)
      }
      .padding()
      .navigationBarTitleDisplayMode(.inline)
      .onAppear {
        WatchSession.shared.activate()
      }
    }
  }
}
