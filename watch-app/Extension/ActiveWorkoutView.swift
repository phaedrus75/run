import SwiftUI

struct ActiveWorkoutView: View {
  @EnvironmentObject private var workout: WorkoutViewModel
  @Environment(\.dismiss) private var dismiss
  @State private var showingStopConfirm = false

  var body: some View {
    Group {
      if workout.phase == .finished {
        SummaryView()
      } else {
        activeContent
      }
    }
  }

  private var activeContent: some View {
    VStack(spacing: 10) {
      Text(workout.activity == .walk ? "Walk" : "Run")
        .font(.caption)
        .foregroundStyle(.secondary)

      Text(String(format: "%.2f km", workout.distanceKm))
        .font(.system(size: 36, weight: .bold, design: .rounded))
        .minimumScaleFactor(0.5)

      HStack {
        VStack(alignment: .leading) {
          Text("Time")
            .font(.caption2)
            .foregroundStyle(.secondary)
          Text(formatHms(workout.durationSeconds))
            .font(.title3.monospacedDigit())
        }
        Spacer()
        VStack(alignment: .trailing) {
          Text("Pace")
            .font(.caption2)
            .foregroundStyle(.secondary)
          Text(workout.paceText)
            .font(.title3.monospacedDigit())
        }
      }
      .padding(.horizontal, 4)

      Text("HR: —")
        .font(.caption2)
        .foregroundStyle(.tertiary)

      HStack(spacing: 8) {
        if workout.phase == .paused {
          Button("Resume") {
            workout.resume()
          }
          .buttonStyle(.borderedProminent)
        } else if workout.phase == .active {
          Button("Pause") {
            workout.pause()
          }
          .buttonStyle(.bordered)
        }

        Button("Stop") {
          showingStopConfirm = true
        }
        .buttonStyle(.borderedProminent)
        .tint(.red)
      }
      .padding(.top, 6)

      Spacer(minLength: 0)
    }
    .padding()
    .confirmationDialog("End workout?", isPresented: $showingStopConfirm, titleVisibility: .visible) {
      Button("End & review", role: .destructive) {
        workout.stopToSummary()
      }
      Button("Cancel", role: .cancel) {}
    }
  }

  private func formatHms(_ sec: Double) -> String {
    let s = Int(sec.rounded())
    let h = s / 3600
    let m = (s % 3600) / 60
    let r = s % 60
    if h > 0 {
      return String(format: "%d:%02d:%02d", h, m, r)
    }
    return String(format: "%d:%02d", m, r)
  }
}
