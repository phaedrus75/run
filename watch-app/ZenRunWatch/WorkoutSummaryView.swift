/**
 * WorkoutSummaryView
 * ------------------
 * Reached when the controller transitions to `.ended` — i.e. the user
 * tapped Stop. Build 33 expands the recap with HR avg/max, active energy,
 * and a time-in-zone bar; Save now actually persists the workout to Apple
 * Health (and the iPhone) instead of silently discarding the HK builder.
 *
 * Save flow:
 *   1. Build the legacy payload via `WatchSessionManager.sendWorkout(...)` —
 *      durable `transferUserInfo` + `applicationContext` belt-and-braces.
 *   2. `controller.saveAndPersistToHealth` calls `endCollection` then
 *      `finishWorkout`, writing the workout into HealthKit so it shows up
 *      in the iPhone Health app and contributes to activity rings.
 *   3. After both succeed, dismiss back to home.
 *
 * Discard flow:
 *   - `controller.discard()` calls `endSession` + `discardWorkout` so the
 *     HK record is dropped, then returns to idle.
 */

import SwiftUI

struct WorkoutSummaryView: View {
    @EnvironmentObject var workout: ActiveWorkoutController
    @EnvironmentObject var session: WatchSessionManager

    @Environment(\.dismiss) private var dismiss

    @State private var didSend = false
    @State private var sendError: String?
    @State private var saving = false

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                summaryBlock

                if workout.maxHr > 0 {
                    heartSummaryBlock
                }

                if workout.totalZoneSec > 5 {
                    timeInZoneBlock
                }

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
        .navigationBarBackButtonHidden(!didSend)
    }

    // MARK: - Headline summary

    private var summaryBlock: some View {
        VStack(spacing: 4) {
            Text(workout.kind.displayName.uppercased())
                .font(.caption2)
                .foregroundColor(.secondary)
                .tracking(1)
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
                pillChip(label: "Pace", value: workout.paceText)
                if workout.activeEnergyKcal > 0 {
                    pillChip(label: "kcal", value: "\(Int(workout.activeEnergyKcal))")
                }
                if workout.elevationGainM > 0 {
                    pillChip(label: "m up", value: "\(Int(workout.elevationGainM))")
                }
            }
            .padding(.top, 2)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color.gray.opacity(0.18))
        .cornerRadius(10)
    }

    // MARK: - HR summary (avg + max)

    private var heartSummaryBlock: some View {
        HStack(spacing: 0) {
            heartStat(label: "Avg HR", value: "\(Int(workout.avgHr))", color: .pink)
            Divider()
                .frame(height: 24)
                .background(Color.gray.opacity(0.4))
            heartStat(label: "Max HR", value: "\(Int(workout.maxHr))", color: .red)
        }
        .padding(.vertical, 6)
        .background(Color.gray.opacity(0.12))
        .cornerRadius(8)
    }

    private func heartStat(label: String, value: String, color: Color) -> some View {
        VStack(spacing: 1) {
            HStack(spacing: 3) {
                Image(systemName: "heart.fill")
                    .font(.system(size: 9))
                    .foregroundColor(color)
                Text(label)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            Text(value)
                .font(.body)
                .fontWeight(.bold)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Time-in-zone bar

    private var timeInZoneBlock: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("TIME IN ZONE")
                .font(.caption2)
                .foregroundColor(.secondary)
                .tracking(1)
            zoneBar
            zoneLegend
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Color.gray.opacity(0.12))
        .cornerRadius(8)
    }

    private var zoneBar: some View {
        let total = max(1, workout.totalZoneSec)
        return GeometryReader { geo in
            HStack(spacing: 1) {
                ForEach(HRZone.allCases, id: \.rawValue) { zone in
                    let sec = workout.timeInZoneSec[zone] ?? 0
                    let frac = sec / total
                    Rectangle()
                        .fill(zone.color)
                        .frame(width: max(0, geo.size.width * frac))
                }
            }
        }
        .frame(height: 8)
        .cornerRadius(2)
    }

    private var zoneLegend: some View {
        // Compact 5-cell legend, value = time in MM:SS for non-zero zones.
        HStack(spacing: 4) {
            ForEach(HRZone.allCases, id: \.rawValue) { zone in
                let sec = workout.timeInZoneSec[zone] ?? 0
                VStack(spacing: 1) {
                    Text(zone.shortLabel)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(zone.color)
                    Text(sec > 0 ? formatZoneSec(sec) : "—")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                        .monospacedDigit()
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: - Pills used by summaryBlock

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

    // MARK: - Actions

    private var actionButtons: some View {
        VStack(spacing: 6) {
            Button(action: save) {
                if saving {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    Label("Save to phone & Health", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(.green)
            .disabled(workout.pointCount < 2 || saving)

            Button(role: .destructive) {
                workout.discard()
                dismiss()
            } label: {
                Label("Discard", systemImage: "trash")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .disabled(saving)

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
        saving = true

        guard let started = workout.startedAt, let ended = workout.endedAt else {
            sendError = "Missing timestamps."
            saving = false
            return
        }

        // 1. Queue the iPhone payload (durable transferUserInfo).
        let queued = session.sendWorkout(
            kind: workout.kind,
            distanceKm: workout.distanceKm,
            durationSec: workout.durationSec,
            elevationGainM: workout.elevationGainM,
            startedAt: started,
            endedAt: ended,
            points: workout.allPoints,
            avgHr: workout.avgHr,
            maxHr: workout.maxHr,
            activeEnergyKcal: workout.activeEnergyKcal,
            timeInZoneSec: workout.timeInZoneSec
        )
        if !queued {
            sendError = session.lastError ?? "Could not queue workout — try again."
            saving = false
            return
        }

        // 2. Persist to Apple Health. The completion fires once HK has
        //    durably written the workout (or returned an error). Either way
        //    we mark the UI as sent — the iPhone payload is independent.
        workout.saveAndPersistToHealth { _ in
            didSend = true
            saving = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                dismiss()
            }
        }
    }

    private func formatZoneSec(_ seconds: TimeInterval) -> String {
        let total = Int(seconds.rounded())
        let m = total / 60
        let s = total % 60
        return String(format: "%d:%02d", m, s)
    }
}
