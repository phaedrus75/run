/**
 * ActiveWorkoutView
 * -----------------
 * Live metrics for an in-progress workout. Auto-starts the controller on
 * first appear (idempotent), wires the pause/resume/stop buttons, and
 * transitions to `WorkoutSummaryView` once the controller flips to `.ended`.
 *
 * The controller is shared via @EnvironmentObject from the App level so
 * navigating back to the home screen doesn't tear down the session.
 *
 * Hard rules:
 *   - No alert popups during recording — the watch is on the wrist and
 *     dismissable popups are awful UX. Surface errors as inline footer text.
 *   - The Stop button uses a destructive confirmation so it's hard to hit
 *     accidentally. Pause is one tap; Stop is two.
 */

import SwiftUI

struct ActiveWorkoutView: View {
    let intendedKind: WorkoutKind
    @EnvironmentObject var workout: ActiveWorkoutController

    @State private var showStopConfirm = false
    @State private var didRequestPermissions = false

    var body: some View {
        Group {
            if workout.state == .ended {
                WorkoutSummaryView()
            } else {
                liveBody
            }
        }
        .onAppear {
            // Idempotent: only start when truly idle. If the user navigated
            // away and back, the controller still has the in-progress
            // session and we should NOT call start() (it'd reset duration).
            if workout.state == .idle {
                requestPermissionsIfNeeded()
                workout.start(kind: intendedKind)
            }
        }
        .navigationTitle(workout.kind.displayName)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var liveBody: some View {
        ScrollView {
            VStack(spacing: 6) {
                metricsBlock

                if workout.state == .paused {
                    Text("Paused")
                        .font(.caption)
                        .foregroundColor(.orange)
                        .padding(.vertical, 2)
                }

                controlsBlock

                if let err = workout.lastError {
                    Text(err)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.top, 2)
                }

                permissionFooter
            }
            .padding(.horizontal, 4)
            .padding(.vertical, 6)
        }
        .confirmationDialog(
            "Stop \(workout.kind.displayName)?",
            isPresented: $showStopConfirm,
            titleVisibility: .visible
        ) {
            Button("Stop & save", role: .destructive) {
                workout.stop()
            }
            Button("Keep going", role: .cancel) {}
        }
    }

    private var metricsBlock: some View {
        VStack(spacing: 2) {
            Text(formatDistanceKm(workout.distanceKm))
                .font(.title2)
                .fontWeight(.bold)
                .monospacedDigit()
            Text(formatDurationHms(workout.durationSec))
                .font(.callout)
                .foregroundColor(.secondary)
                .monospacedDigit()
            HStack(spacing: 12) {
                metricChip(label: "Pace", value: workout.paceText)
                metricChip(label: "Pts", value: "\(workout.pointCount)")
            }
            .padding(.top, 2)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(Color.gray.opacity(0.18))
        .cornerRadius(8)
    }

    private func metricChip(label: String, value: String) -> some View {
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

    private var controlsBlock: some View {
        VStack(spacing: 6) {
            HStack(spacing: 6) {
                if workout.state == .recording {
                    Button(action: workout.pause) {
                        Label("Pause", systemImage: "pause.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(.yellow)
                } else if workout.state == .paused {
                    Button(action: workout.resume) {
                        Label("Resume", systemImage: "play.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                }
            }

            Button(role: .destructive) {
                showStopConfirm = true
            } label: {
                Label("Stop", systemImage: "stop.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(.red)
        }
    }

    private var permissionFooter: some View {
        VStack(spacing: 2) {
            if workout.locationAuthorization == .denied || workout.locationAuthorization == .restricted {
                Text("Location access denied — open the iPhone Watch app to grant.")
                    .font(.caption2)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
            }
            if !workout.healthAuthorizationOk {
                Text("HealthKit not granted — keep wrist raised.")
                    .font(.caption2)
                    .foregroundColor(.orange)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.top, 2)
    }

    private func requestPermissionsIfNeeded() {
        guard !didRequestPermissions else { return }
        didRequestPermissions = true
        workout.ensureLocationPermission()
        workout.ensureHealthAuthorization()
    }
}
