import Foundation
import WatchConnectivity

/// Receives workouts from Apple Watch via WatchConnectivity and forwards to the Expo module.
/// Also tracks comprehensive state so the iPhone UI can show what's actually happening on the
/// channel (activation result, last received times, reachability, etc.).
public final class WatchBridgeSession: NSObject, WCSessionDelegate {
  public static let shared = WatchBridgeSession()

  public weak var eventSink: WatchBridgeModule?

  // MARK: - Diagnostic state

  private let stateQueue = DispatchQueue(label: "com.phaedrus75.runzen.WatchBridgeSession.state")
  private var _activationState: WCSessionActivationState = .notActivated
  private var _activationError: String?
  private var _lastUserInfoAt: Date?
  private var _lastAppContextAt: Date?
  private var _userInfoCount: Int = 0
  private var _appContextCount: Int = 0
  private var _zenPayloadCount: Int = 0
  private var _seenSeqs: Set<Int> = []

  private override init() {
    super.init()
  }

  public func start() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  /// Snapshot of channel state for the in-app diagnostics screen.
  public func snapshotDiagnostics() -> [String: Any] {
    let session = WCSession.isSupported() ? WCSession.default : nil
    return stateQueue.sync {
      var out: [String: Any] = [
        "supported": WCSession.isSupported(),
        "activationState": activationStateName(_activationState),
        "userInfoReceivedCount": _userInfoCount,
        "appContextReceivedCount": _appContextCount,
        "zenPayloadCount": _zenPayloadCount,
      ]
      if let err = _activationError { out["activationError"] = err }
      if let t = _lastUserInfoAt { out["lastUserInfoAt"] = isoString(t) }
      if let t = _lastAppContextAt { out["lastAppContextAt"] = isoString(t) }
      if let session = session {
        out["isPaired"] = session.isPaired
        out["isWatchAppInstalled"] = session.isWatchAppInstalled
        out["isReachable"] = session.isReachable
        out["isComplicationEnabled"] = session.isComplicationEnabled
        out["outstandingUserInfoTransfers"] = session.outstandingUserInfoTransfers.count
        out["hasContentPending"] = session.hasContentPending
      }
      return out
    }
  }

  // MARK: - WCSessionDelegate

  public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    stateQueue.sync {
      _activationState = activationState
      _activationError = error?.localizedDescription
    }
  }

  public func sessionDidBecomeInactive(_ session: WCSession) {}

  public func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  public func sessionReachabilityDidChange(_ session: WCSession) {}

  public func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    stateQueue.sync {
      _userInfoCount += 1
      _lastUserInfoAt = Date()
    }
    handlePayload(userInfo)
  }

  public func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    stateQueue.sync {
      _appContextCount += 1
      _lastAppContextAt = Date()
    }
    handlePayload(applicationContext)
  }

  // MARK: - Payload routing

  private func handlePayload(_ userInfo: [String: Any]) {
    let zen: Bool = {
      if let b = userInfo["zenRun"] as? Bool { return b }
      if let n = userInfo["zenRun"] as? NSNumber { return n.boolValue }
      return false
    }()
    guard zen else { return }

    // Deduplicate when the same workout arrives via both transferUserInfo and
    // applicationContext channels. Sequence number is set by the watch.
    if let seq = (userInfo["_seq"] as? Int) ?? ((userInfo["_seq"] as? NSNumber)?.intValue) {
      let alreadySeen: Bool = stateQueue.sync {
        if _seenSeqs.contains(seq) { return true }
        _seenSeqs.insert(seq)
        if _seenSeqs.count > 100 {
          // Bound memory; we only need to dedupe across recent messages.
          _seenSeqs = Set(_seenSeqs.suffix(50))
        }
        return false
      }
      if alreadySeen { return }
    }

    stateQueue.sync { _zenPayloadCount += 1 }

    DispatchQueue.main.async { [weak self] in
      self?.eventSink?.emitWorkout(userInfo)
    }
  }
}

private func activationStateName(_ state: WCSessionActivationState) -> String {
  switch state {
  case .notActivated: return "notActivated"
  case .inactive: return "inactive"
  case .activated: return "activated"
  @unknown default: return "unknown"
  }
}

private func isoString(_ date: Date) -> String {
  let f = ISO8601DateFormatter()
  f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  return f.string(from: date)
}
