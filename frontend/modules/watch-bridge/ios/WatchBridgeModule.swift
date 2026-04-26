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
