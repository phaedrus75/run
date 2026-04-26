import Foundation
import WatchConnectivity

final class WatchSession: NSObject, WCSessionDelegate {
  static let shared = WatchSession()

  private override init() {
    super.init()
  }

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  func sendWorkoutToPhone(_ payload: [String: Any]) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    guard session.activationState == .activated else {
      // Queue for later delivery
      session.transferUserInfo(payload)
      return
    }
    session.transferUserInfo(payload)
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {}

  func sessionReachabilityDidChange(_ session: WCSession) {}
}
