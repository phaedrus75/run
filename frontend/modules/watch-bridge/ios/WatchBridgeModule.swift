import ExpoModulesCore
import WatchConnectivity

public final class WatchBridgeModule: Module {
  private let onWatchWorkoutReceived = "onWatchWorkoutReceived"
  // Serial queue protecting `pendingPayloads` and `hasJsListener`. WCSession
  // callbacks come on a background queue and Expo's OnStartObserving fires on
  // its own async queue, so we serialize all access here.
  private let stateQueue = DispatchQueue(label: "com.phaedrus75.runzen.WatchBridgeModule.state")
  private var pendingPayloads: [[String: Any]] = []
  private var hasJsListener = false

  public func definition() -> ModuleDefinition {
    Name("WatchBridge")

    Events(onWatchWorkoutReceived)

    OnCreate {
      WatchBridgeSession.shared.eventSink = self
      WatchBridgeSession.shared.start()
    }

    // Diagnostic accessor for the in-app Watch Sync screen.
    AsyncFunction("getDiagnostics") { () -> [String: Any] in
      var snap = WatchBridgeSession.shared.snapshotDiagnostics()
      let buffered: Int = self.stateQueue.sync { self.pendingPayloads.count }
      snap["bufferedPayloads"] = buffered
      snap["hasJsListener"] = self.stateQueue.sync { self.hasJsListener }
      return snap
    }

    // Live ping: asks the watch (via sendMessage) for its WCSession state. Throws if the watch
    // isn't reachable. The reply tells us whether the watch ever successfully sent a workout, and
    // distinguishes "watch is silent" from "iOS is dropping our queued userInfos".
    AsyncFunction("pingWatch") { (promise: Promise) in
      WatchBridgeSession.shared.sendLiveQuery(["kind": "ping"]) { result in
        switch result {
        case .success(let reply):
          promise.resolve(reply)
        case .failure(let error):
          promise.reject("WATCH_UNREACHABLE", error.localizedDescription)
        }
      }
    }

    // Force the watch to re-send the most recent workout it persisted. Bypasses the watch's
    // save-flow UI entirely — useful when a workout was saved on the watch but never arrived on
    // the iPhone.
    AsyncFunction("resendLastWorkout") { (promise: Promise) in
      WatchBridgeSession.shared.sendLiveQuery(["kind": "resend_last"]) { result in
        switch result {
        case .success(let reply):
          promise.resolve(reply)
        case .failure(let error):
          promise.reject("WATCH_UNREACHABLE", error.localizedDescription)
        }
      }
    }

    // WCSession can deliver queued user infos during cold launch before JS
    // finishes booting and attaches a listener. When the first JS listener
    // attaches, flush anything we received in the meantime.
    OnStartObserving {
      let toFlush: [[String: Any]] = self.stateQueue.sync {
        self.hasJsListener = true
        let pending = self.pendingPayloads
        self.pendingPayloads.removeAll()
        return pending
      }
      for payload in toFlush {
        self.sendEvent(self.onWatchWorkoutReceived, ["payload": payload])
      }
    }

    OnStopObserving {
      self.stateQueue.sync {
        self.hasJsListener = false
      }
    }

    OnDestroy {
      if WatchBridgeSession.shared.eventSink === self {
        WatchBridgeSession.shared.eventSink = nil
      }
    }
  }

  func emitWorkout(_ payload: [String: Any]) {
    let shouldEmit: Bool = stateQueue.sync {
      if hasJsListener {
        return true
      }
      pendingPayloads.append(payload)
      return false
    }
    if shouldEmit {
      sendEvent(onWatchWorkoutReceived, ["payload": payload])
    }
  }
}
