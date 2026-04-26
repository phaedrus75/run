import Foundation
import WatchConnectivity

/// Receives workouts from Apple Watch via WatchConnectivity and forwards to the Expo module.
public final class WatchBridgeSession: NSObject, WCSessionDelegate {
  public static let shared = WatchBridgeSession()

  public weak var eventSink: WatchBridgeModule?

  private override init() {
    super.init()
  }

  public func start() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  public func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

  public func sessionDidBecomeInactive(_ session: WCSession) {}

  public func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }

  public func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    handlePayload(userInfo)
  }

  private func handlePayload(_ userInfo: [String: Any]) {
    let zen: Bool = {
      if let b = userInfo["zenRun"] as? Bool { return b }
      if let n = userInfo["zenRun"] as? NSNumber { return n.boolValue }
      return false
    }()
    guard zen else { return }
    DispatchQueue.main.async { [weak self] in
      self?.eventSink?.emitWorkout(userInfo)
    }
  }
}
