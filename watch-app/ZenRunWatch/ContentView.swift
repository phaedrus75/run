/**
 * ContentView
 * -----------
 * Hello-world UI for build 30. Two send buttons and live channel state.
 * The whole point of this screen is to let the user prove the WCSession
 * channel works end-to-end without any GPS / HealthKit / workout code in
 * the way.
 *
 * Acceptance criteria (Phase 1 — must all pass before we re-add features):
 *   1. Activation row reads `activated` shortly after launch.
 *   2. Reachable row reads `yes` when the iPhone's ZenRun app is foregrounded.
 *   3. Tap "Send Hello" → iPhone diagnostics screen's
 *      `transferUserInfo received` counter ticks up.
 *   4. Tap "Send Context" → iPhone's `applicationContext received` ticks up.
 *   5. Tap "Ping watch (live)" on the phone → reply alert shows `pong: true`.
 */

import SwiftUI
import WatchConnectivity

struct ContentView: View {
    @EnvironmentObject var session: WatchSessionManager

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                Text("ZenRun")
                    .font(.title3)
                    .fontWeight(.bold)
                    .frame(maxWidth: .infinity, alignment: .center)

                statusBlock

                buttonBlock

                if let at = session.lastSendAt {
                    Text("\(session.lastSendStatus) · \(timeOnly(at))")
                        .font(.footnote)
                        .foregroundColor(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 4)
                }

                if let err = session.lastError {
                    Text(err)
                        .font(.caption2)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 8)
        }
    }

    private var statusBlock: some View {
        VStack(spacing: 4) {
            statusRow("Activation", value: activationLabel, ok: session.activationState == .activated)
            statusRow("Reachable", value: session.isReachable ? "yes" : "no", ok: session.isReachable)
            statusRow("iPhone app", value: session.isCompanionAppInstalled ? "installed" : "missing",
                      ok: session.isCompanionAppInstalled)
            statusRow("Sent", value: "\(session.sendCount)", ok: nil)
        }
        .padding(8)
        .background(Color.gray.opacity(0.18))
        .cornerRadius(8)
    }

    private var buttonBlock: some View {
        VStack(spacing: 8) {
            Button(action: session.sendHello) {
                Text("Send Hello")
                    .font(.body)
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(.orange)

            Button(action: session.sendContext) {
                Text("Send Context")
                    .font(.body)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        }
    }

    private var activationLabel: String {
        switch session.activationState {
        case .notActivated: return "not activated"
        case .inactive:     return "inactive"
        case .activated:    return "activated"
        @unknown default:   return "unknown"
        }
    }

    private func statusRow(_ label: String, value: String, ok: Bool?) -> some View {
        HStack {
            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(ok == true ? .green : (ok == false ? .red : .primary))
        }
    }

    private func timeOnly(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss"
        return f.string(from: date)
    }
}
