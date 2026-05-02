/**
 * WorkoutSummaryView
 * ------------------
 * Reached when the controller transitions to `.ended` — i.e. the user
 * tapped Stop. Shows a one-screen recap and offers Save (handoff to iPhone)
 * or Discard (drop in-memory state, return to home).
 *
 * Save semantics:
 *   - Build the legacy payload via `WatchSessionManager.sendWorkout(...)`,
 *     which queues `transferUserInfo` (durable across reachability gaps)
 *     plus `updateApplicationContext` (last-state, persists across launches).
 *   - The iPhone-side bridge dedupes by `_seq`, so the belt-and-braces
 *     dual delivery is safe.
 *   - Reset the controller back to `.idle` only after a successful queue —
 *     if the watch is mid-reboot when the user taps Save, we keep the
 *     summary visible so they can retry.
 */

import SwiftUI

struct WorkoutSummaryView: View {
    @EnvironmentObject var workout: ActiveWorkoutController
    @EnvironmentObject var session: WatchSessionManager

    @Environment(\.dismiss) private var dismiss

    @State private var didSend = false
    @State private var sendError: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                summaryBlock

                if didSend {
                    Text("Saved → iPhone will sync shortly.")
                        .font(.caption2)
                        .foregroundColor(.green)
                        .multilineTextAlignment(.center)
                        .padding(.top, 2)
                } else {
                    actionButtons
                }

                if let err = sendError {
                    Text(err)
                        .font(.caption2)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                        .padding(.top, 2)
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 8)
        }
        .navigationTitle("Summary")
        .navigationBarTitleDisplayMode(.inline)
        // Lock the user into an explicit decision (Save / Discard) by hiding
        // the back-arrow until they pick. Without this, swiping back from
        // the summary view leaves the controller in `.ended` forever and
        // the home screen shows the "Continue" banner indefinitely.
        .navigationBarBackButtonHidden(!didSend)
    }

    private var summaryBlock: some View {
        VStack(spacing: 4) {
            Text(workout.kind.displayName.uppercased())
                .font(.caption2)
                .foregroundColor(.secondary)
                .tracking(1)
            Text(formatDistanceKm(workout.distanceKm))
                .font(.title2)
                .fontWeight(.bold)
                .monospacedDigit()
            Text(formatDurationHms(workout.durationSec))
                .font(.callout)
                .foregroundColor(.secondary)
                .monospacedDigit()
            HStack(spacing: 12) {
                pillChip(label: "Pace", value: workout.paceText)
                pillChip(label: "Pts", value: "\(workout.pointCount)")
            }
            .padding(.top, 2)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color.gray.opacity(0.18))
        .cornerRadius(8)
    }

    private func pillChip(label: String, value: String) -> some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.caption)
                .fontWeight(.semibold)
                .monospacedDigit()
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }

    private var actionButtons: some View {
        VStack(spacing: 6) {
            Button(action: save) {
                Label("Save to phone", systemImage: "square.and.arrow.up")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .disabled(workout.pointCount < 2)

            Button(role: .destructive) {
                workout.reset()
                dismiss()
            } label: {
                Label("Discard", systemImage: "trash")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)

            if workout.pointCount < 2 {
                Text("Not enough GPS points to save.")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private func save() {
        sendError = nil
        guard let started = workout.startedAt, let ended = workout.endedAt else {
            sendError = "Missing timestamps."
            return
        }
        let ok = session.sendWorkout(
            kind: workout.kind,
            distanceKm: workout.distanceKm,
            durationSec: workout.durationSec,
            elevationGainM: workout.elevationGainM,
            startedAt: started,
            endedAt: ended,
            points: workout.allPoints
        )
        if ok {
            didSend = true
            // Only reset once the payload has been queued AND we've shown
            // the user the success state for a moment. Auto-pop to home
            // after a brief delay so they don't have to fish for the back
            // arrow on a small screen.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                workout.reset()
                dismiss()
            }
        } else {
            sendError = session.lastError ?? "Could not queue workout — try again."
        }
    }
}
