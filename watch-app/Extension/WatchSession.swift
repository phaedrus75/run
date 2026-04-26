import Foundation
import WatchConnectivity

/// Singleton WCSession delegate on the watch side.
///
/// Sends workouts via `transferUserInfo` (queued, FIFO, durable) AND mirrors a
/// heartbeat into `updateApplicationContext` (latest-only, persisted by the OS,
/// always replayed to the iPhone on next activation). The duplicate channel is
/// deliberate: if `transferUserInfo` silently fails for any reason, the
/// applicationContext lets the iPhone detect the watch had something to send.
final class WatchSession: NSObject, WCSessionDelegate {
  static let shared = WatchSession()

  private(set) var lastActivationState: WCSessionActivationState = .notActivated
  private(set) var lastActivationError: String?
  private(set) var lastSendAt: Date?
  private(set) var lastSendOk: Bool?
  private(set) var lastSendError: String?
  private var pendingWorkoutContext: [String: Any]?

  private override init() {
    super.init()
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  /// Sends the workout via the queued channel and pushes a copy onto the
  /// applicationContext fallback. If the session isn't activated yet, defers
  /// both calls until `activationDidComplete` fires.
  func sendWorkoutToPhone(_ payload: [String: Any]) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default

    if session.activationState != .activated {
      pendingWorkoutContext = payload
      return
    }

    deliverPayload(payload, on: session)
  }

  private func deliverPayload(_ payload: [String: Any], on session: WCSession) {
    lastSendAt = Date()
    do {
      var ctx = payload
      ctx["_seq"] = Int(Date().timeIntervalSince1970 * 1000)
      try session.updateApplicationContext(ctx)
    } catch {
      lastSendError = "ctx: \(error.localizedDescription)"
    }
    session.transferUserInfo(payload)
    if lastSendError == nil {
      lastSendOk = true
    }
  }

  // MARK: - WCSessionDelegate

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    lastActivationState = activationState
    lastActivationError = error?.localizedDescription
    if let pending = pendingWorkoutContext, activationState == .activated {
      pendingWorkoutContext = nil
      deliverPayload(pending, on: session)
    }
  }

  func sessionReachabilityDidChange(_ session: WCSession) {}
}
