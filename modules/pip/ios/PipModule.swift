import AVKit
import ExpoModulesCore

// What lib/pip.ts sends for the card. thumb is a data URI or raw base64;
// startedAt is epoch milliseconds from the run registry and drives the
// mm:ss clock.
struct Status: Record {
  @Field var title: String = ""
  @Field var phase: String = ""
  @Field var detail: String? = nil
  @Field var progress: Double? = nil
  @Field var thumb: String? = nil
  @Field var startedAt: Double? = nil
}

final class UnsupportedException: Exception {
  override var reason: String {
    "Picture in Picture is not supported on this device"
  }
}

final class WindowException: Exception {
  override var reason: String {
    "no key window to host the Picture in Picture layer"
  }
}

// iOS side of the 'pip' module — the same registered name, functions and
// events as the Android side, so lib/pip.ts speaks to ONE surface. Android
// miniaturizes the live activity; here Pip feeds rendered frames to the
// system video window, so update() and stop() do real work on this platform.
public class PipModule: Module {
  private var pip: Pip?

  public func definition() -> ModuleDefinition {
    Name("pip")

    Events("changed", "restored")

    // False on Simulators and hardware AVKit refuses; JS gates on it.
    Function("isSupported") { () -> Bool in
      AVPictureInPictureController.isPictureInPictureSupported()
    }

    // Arms automatic entry for the moment the user leaves the app
    // (iOS 14.2 behavior riding on the iOS 15 contentSource pipeline; the
    // pod's 15.1 floor keeps every call site safe). The pipeline is built
    // lazily on first use so sessions that never show the card never pay
    // for it.
    AsyncFunction("setAuto") { (on: Bool) in
      if on {
        try self.ensure().auto(true)
      } else {
        self.pip?.auto(false)
      }
    }.runOnQueue(.main)

    // Manual entry. The window takes its aspect from the video frames and
    // the card is 16:9 by design, so the requested aspect is acknowledged
    // but not used on this platform.
    AsyncFunction("enter") { (_: Int, _: Int) -> Bool in
      try self.ensure().enter()
    }.runOnQueue(.main)

    AsyncFunction("update") { (status: Status) in
      try self.ensure().update(
        title: status.title,
        phase: status.phase,
        detail: status.detail,
        progress: status.progress,
        thumb: status.thumb,
        startedAt: status.startedAt
      )
    }.runOnQueue(.main)

    AsyncFunction("stop") {
      self.pip?.stop()
    }.runOnQueue(.main)

    OnDestroy {
      // A JS reload must not leave a zombie window feeding frames.
      let pip = self.pip
      self.pip = nil
      DispatchQueue.main.async { pip?.close() }
    }
  }

  private func ensure() throws -> Pip {
    if let pip { return pip }
    guard AVPictureInPictureController.isPictureInPictureSupported() else {
      throw UnsupportedException()
    }
    guard let window = Pip.window else {
      throw WindowException()
    }
    let made = Pip(window: window)
    made.emit = { [weak self] name, body in self?.sendEvent(name, body) }
    pip = made
    return made
  }
}
