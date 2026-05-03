/**
 * ActiveWorkoutView
 * -----------------
 * Live metrics for an in-progress workout. Build 33 lays this out as a
 * paginated `TabView` (PageTabViewStyle) with two pages:
 *
 *   • Stats page — distance, duration, pace, energy
 *   • Heart page — current BPM, zone color, zone label
 *
 * Both pages have the same Pause/Stop controls at the bottom so the user
 * never has to swipe to access them. PageTabViewStyle automatically renders
 * the page-indicator dots above the tab bar / at the bottom of the screen.
 *
 * Auto-starts the controller on first appear (idempotent), wires the
 * pause/resume/stop buttons, and transitions to `WorkoutSummaryView` once
 * the controller flips to `.ended`.
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
            if workout.state == .idle {
                requestPermissionsIfNeeded()
                workout.start(kind: intendedKind)
            }
        }
        .navigationTitle(workout.kind.displayName)
        .navigationBarTitleDisplayMode(.inline)
    }

    private var liveBody: some View {
        TabView {
            statsPage.tag(0)
            heartPage.tag(1)
        }
        .tabViewStyle(.page(indexDisplayMode: .always))
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

    // MARK: - Stats page (distance · duration · pace · energy)

    private var statsPage: some View {
        ScrollView {
            VStack(spacing: 8) {
                statsBlock

                if workout.state == .paused {
                    pausedBadge
                }

                controlsBlock

                permissionFooter
            }
            .padding(.horizontal, 4)
            .padding(.vertical, 4)
        }
    }

    private var statsBlock: some View {
        VStack(spacing: 4) {
            Text(formatDistanceKm(workout.distanceKm))
                .font(.title)
                .fontWeight(.heavy)
                .monospacedDigit()
                .foregroundColor(workout.kind == .run ? .orange : .blue)
            Text(formatDurationHms(workout.durationSec))
                .font(.callout)
                .foregroundColor(.secondary)
                .monospacedDigit()
            HStack(spacing: 14) {
                metricChip(label: "Pace", value: workout.paceText)
                if workout.activeEnergyKcal > 0 {
                    metricChip(label: "kcal", value: "\(Int(workout.activeEnergyKcal))")
                }
            }
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color.gray.opacity(0.18))
        .cornerRadius(10)
    }

    // MARK: - Heart page (current BPM · zone color · zone label)

    private var heartPage: some View {
        ScrollView {
            VStack(spacing: 8) {
                heartBlock

                if workout.state == .paused {
                    pausedBadge
                }

                controlsBlock
            }
            .padding(.horizontal, 4)
            .padding(.vertical, 4)
        }
    }

    private var heartBlock: some View {
        let zone = workout.currentZone
        let tint = zone?.color ?? Color.gray
        return VStack(spacing: 6) {
            HStack(spacing: 4) {
                Image(systemName: "heart.fill")
                    .font(.caption)
                    .foregroundColor(tint)
                if let zone = zone {
                    Text(zone.label)
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundColor(tint)
                } else {
                    Text("HEART RATE")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .tracking(1)
                }
                Spacer()
                if let zone = zone {
                    Text(zone.shortLabel)
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(tint)
                        .cornerRadius(4)
                }
            }
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(workout.currentHr > 0 ? "\(Int(workout.currentHr))" : "—")
                    .font(.system(size: 44, weight: .heavy, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(tint)
                Text("BPM")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            if workout.maxHr > 0 {
                HStack(spacing: 14) {
                    metricChip(label: "Avg", value: "\(Int(workout.avgHr))")
                    metricChip(label: "Max", value: "\(Int(workout.maxHr))")
                }
                .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(10)
        .background(tint.opacity(0.18))
        .cornerRadius(10)
    }

    // MARK: - Shared chrome (controls, paused badge, permission warnings)

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

    private var pausedBadge: some View {
        Text("Paused")
            .font(.caption2)
            .fontWeight(.semibold)
            .foregroundColor(.orange)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Color.orange.opacity(0.18))
            .cornerRadius(8)
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
        .padding(.top, 4)
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
            if let err = workout.lastError {
                Text(err)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(.top, 4)
    }

    private func requestPermissionsIfNeeded() {
        guard !didRequestPermissions else { return }
        didRequestPermissions = true
        workout.ensureLocationPermission()
        workout.ensureHealthAuthorization()
    }
}
