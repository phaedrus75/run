/**
 * ContentView
 * -----------
 * Watch home screen. Two main paths:
 *
 *   - "Walk" / "Run" buttons start a workout and push the live metrics view.
 *     If a workout is already in progress (i.e. the user navigated back to
 *     home without stopping), the buttons collapse into a single "Continue"
 *     row that re-opens the live view without restarting the session.
 *
 *   - A `Diagnostics` link (collapsed by default) preserves the build 30
 *     hello-world buttons so we can ping the channel from the watch even in
 *     a production build. They're not visible on the main screen anymore so
 *     the user doesn't accidentally fire them mid-run.
 *
 * Channel state (activation, reachability, iPhone-app installed) lives at the
 * bottom as a compact line — it shouldn't dominate the screen but should be
 * visible when triaging "did my run sync?" questions.
 */

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var session: WatchSessionManager
    @EnvironmentObject var workout: ActiveWorkoutController

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 8) {
                    if workout.state == .recording || workout.state == .paused {
                        continueBanner
                    } else if workout.state == .ended {
                        // The summary view is reached via the same NavigationLink
                        // that started the workout — see ActiveWorkoutView.
                        continueBanner
                    } else {
                        startButtons
                    }

                    NavigationLink {
                        DiagnosticsView()
                            .environmentObject(session)
                    } label: {
                        Label("Diagnostics", systemImage: "wrench.and.screwdriver")
                            .font(.footnote)
                    }
                    .buttonStyle(.bordered)
                    .padding(.top, 4)

                    statusFooter
                }
                .padding(.horizontal, 6)
                .padding(.vertical, 8)
            }
            .navigationTitle("ZenRun")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private var startButtons: some View {
        VStack(spacing: 8) {
            NavigationLink {
                ActiveWorkoutView(intendedKind: .walk)
            } label: {
                workoutButtonLabel(title: "Walk", systemImage: "figure.walk", color: .blue)
            }
            .buttonStyle(.borderedProminent)
            .tint(.blue)

            NavigationLink {
                ActiveWorkoutView(intendedKind: .run)
            } label: {
                workoutButtonLabel(title: "Run", systemImage: "figure.run", color: .orange)
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
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
        }
        .buttonStyle(.borderedProminent)
        .tint(workout.state == .ended ? .green : .orange)
    }

    private func workoutButtonLabel(title: String, systemImage: String, color: Color) -> some View {
        HStack {
            Image(systemName: systemImage)
            Text(title)
                .fontWeight(.semibold)
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 4)
    }

    private var statusFooter: some View {
        VStack(spacing: 2) {
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
        }
        .padding(.top, 4)
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
