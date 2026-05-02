/**
 * DiagnosticsView
 * ---------------
 * Holds the build 30 hello-world buttons (Send Hello / Send Context) plus
 * the live channel snapshot. Pulled out of the home screen so the user
 * doesn't fire diagnostics mid-run.
 *
 * If the iPhone-side diagnostic counters drift from what the watch reports
 * here, that's the first place to look when triaging a sync issue.
 */

import SwiftUI
import WatchConnectivity

struct DiagnosticsView: View {
    @EnvironmentObject var session: WatchSessionManager

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
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
        .navigationTitle("Diagnostics")
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
