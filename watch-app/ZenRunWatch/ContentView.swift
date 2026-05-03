/**
 * ContentView
 * -----------
 * Watch home screen. Three vertical zones:
 *
 *   1. Action area  — Walk / Run buttons, OR a "Continue" banner when a
 *                     workout is in progress.
 *   2. Status line  — VO₂ Max headline (latest reading from HealthKit) when
 *                     available — the most "fitness-app-y" stat we can glance
 *                     without starting a workout.
 *   3. Footer       — channel state + Diagnostics tucked in a NavigationLink.
 *
 * The VO₂ Max read is refreshed lazily on appear; HealthKit auth may not be
 * granted yet on first launch, in which case the line stays hidden.
 */

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var session: WatchSessionManager
    @EnvironmentObject var workout: ActiveWorkoutController

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 10) {
                    if workout.state == .recording || workout.state == .paused {
                        continueBanner
                    } else if workout.state == .ended {
                        // The summary view is reached via the same NavigationLink
                        // that started the workout — see ActiveWorkoutView.
                        continueBanner
                    } else {
                        startButtons
                    }

                    if let vo2 = workout.latestVO2Max {
                        vo2MaxLine(vo2)
                    }

                    statusFooter
                }
                .padding(.horizontal, 6)
                .padding(.vertical, 8)
            }
            .navigationTitle("ZenRun")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear { workout.refreshVO2Max() }
        }
    }

    // MARK: - Sections

    private var startButtons: some View {
        VStack(spacing: 8) {
            NavigationLink {
                ActiveWorkoutView(intendedKind: .walk)
            } label: {
                workoutButtonLabel(title: "Walk", systemImage: "figure.walk")
            }
            .buttonStyle(.borderedProminent)
            .tint(.blue)

            NavigationLink {
                ActiveWorkoutView(intendedKind: .run)
            } label: {
                workoutButtonLabel(title: "Run", systemImage: "figure.run")
            }
            .buttonStyle(.borderedProminent)
            .tint(.orange)
        }
    }

    private var continueBanner: some View {
        NavigationLink {
            ActiveWorkoutView(intendedKind: workout.kind)
        } label: {
            VStack(spacing: 4) {
                Text(workout.state == .ended ? "Workout ready to save" : "Workout in progress")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                Text("\(workout.kind.displayName) · \(formatDistanceKm(workout.distanceKm))")
                    .font(.body)
                    .fontWeight(.semibold)
                    .monospacedDigit()
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
        }
        .buttonStyle(.borderedProminent)
        .tint(workout.state == .ended ? .green : .orange)
    }

    private func workoutButtonLabel(title: String, systemImage: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .font(.body)
            Text(title)
                .fontWeight(.semibold)
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
    }

    private func vo2MaxLine(_ vo2: Double) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "lungs.fill")
                .font(.caption2)
                .foregroundColor(.cyan)
            Text("VO₂ Max")
                .font(.caption2)
                .foregroundColor(.secondary)
            Spacer()
            Text(String(format: "%.1f", vo2))
                .font(.caption)
                .fontWeight(.semibold)
                .monospacedDigit()
            Text("ml/kg·min")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color.gray.opacity(0.15))
        .cornerRadius(6)
    }

    private var statusFooter: some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Circle()
                    .fill(session.activationState == .activated ? Color.green : Color.gray)
                    .frame(width: 6, height: 6)
                Text(channelLabel)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            if !session.isCompanionAppInstalled {
                Text("Install the iPhone app first")
                    .font(.caption2)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
            }
            NavigationLink {
                DiagnosticsView()
                    .environmentObject(session)
            } label: {
                Text("Diagnostics")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
        }
        .padding(.top, 6)
    }

    private var channelLabel: String {
        switch session.activationState {
        case .activated:
            return session.isReachable ? "Phone connected" : "Phone reachable when awake"
        case .inactive:
            return "Channel inactive"
        case .notActivated:
            return "Channel not activated"
        @unknown default:
            return "Channel unknown"
        }
    }
}
