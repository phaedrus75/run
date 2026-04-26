import ExpoModulesCore
import WatchConnectivity

public final class WatchBridgeModule: Module {
  private let onWatchWorkoutReceived = "onWatchWorkoutReceived"

  public func definition() -> ModuleDefinition {
    Name("WatchBridge")

    Events(onWatchWorkoutReceived)

    OnCreate {
      WatchBridgeSession.shared.eventSink = self
      WatchBridgeSession.shared.start()
    }

    OnDestroy {
      if WatchBridgeSession.shared.eventSink === self {
        WatchBridgeSession.shared.eventSink = nil
      }
    }
  }

  func emitWorkout(_ payload: [String: Any]) {
    sendEvent(onWatchWorkoutReceived, ["payload": payload])
  }
}
