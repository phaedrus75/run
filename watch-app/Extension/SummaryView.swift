import SwiftUI

struct SummaryView: View {
  @EnvironmentObject private var workout: WorkoutViewModel
  @Environment(\.dismiss) private var dismiss
  @State private var sending = false
  @State private var sent = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 12) {
        Text("Summary")
          .font(.headline)

        row("Distance", String(format: "%.2f km", workout.distanceKm))
        row("Time", formatHms(workout.durationSeconds))
        row("Avg pace", workout.paceText)

        if sending {
          ProgressView("Sending…")
            .padding(.top, 8)
        } else if sent {
          Text("Sent to iPhone")
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(.top, 4)
        }

        HStack(spacing: 8) {
          Button("Discard", role: .destructive) {
            workout.discard()
            dismiss()
          }
          .buttonStyle(.bordered)

          Button("Save") {
            save()
          }
          .buttonStyle(.borderedProminent)
          .disabled(sending || sent)
        }
        .padding(.top, 12)
      }
      .padding()
    }
  }

  private func row(_ title: String, _ value: String) -> some View {
    HStack {
      Text(title)
        .foregroundStyle(.secondary)
      Spacer()
      Text(value)
        .fontWeight(.semibold)
    }
  }

  private func formatHms(_ sec: Double) -> String {
    let s = Int(sec.rounded())
    let h = s / 3600
    let m = (s % 3600) / 60
    let r = s % 60
    if h > 0 { return String(format: "%d:%02d:%02d", h, m, r) }
    return String(format: "%d:%02d", m, r)
  }

  private func save() {
    sending = true
    let payload = workout.buildSavePayload()
    WatchSession.shared.sendWorkoutToPhone(payload)
    sending = false
    sent = true
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
      workout.discard()
      dismiss()
    }
  }
}
