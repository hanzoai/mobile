import AVFoundation
import AVKit
import CoreMedia
import UIKit

// iOS half of the 'pip' module. AVKit projects only video layers into the
// system Picture in Picture window, so unlike Android — where the OS
// miniaturizes the live activity — the card here is rasterized by Card into
// pixel buffers and fed to an AVSampleBufferDisplayLayer as if it were
// video. A 1pt host view keeps that layer inside the visible hierarchy,
// because AVKit refuses detached or hidden layers, and a once-per-second
// tick keeps the mm:ss clock moving. UIKit and AVKit stay on the main
// thread; drawing and enqueueing stay on `queue`.
//
// App Review treats non-video PiP variably; this app ships through internal
// alpha distribution (the same posture as bot/apps/ios), so the trade is
// deliberate.
final class Pip: NSObject {
  var emit: ((String, [String: Any]) -> Void)?

  private let host: UIView
  private let layer = AVSampleBufferDisplayLayer()
  private var controller: AVPictureInPictureController!
  private let card = Card()
  private let queue = DispatchQueue(label: "ai.hanzo.pip")
  private var timer: DispatchSourceTimer?
  private var state = State()   // touched only on queue
  private var began: Date?      // touched only on queue
  private var active = false    // audio session; main thread only
  private var waiting: NSKeyValueObservation?  // a manual entry parked on isPictureInPicturePossible; main thread only
  private var expiry: DispatchWorkItem?        // the bound on that wait; main thread only

  // The caller supplies the window (and refuses politely when there is
  // none); a throwing init() cannot exist on an NSObject subclass.
  init(window: UIWindow) {
    // 1pt and fully opaque rather than hidden or zero-alpha: AVKit declines
    // layers it considers invisible, and one black pixel over this app's
    // dark chrome cannot be seen.
    host = UIView(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
    super.init()

    host.isUserInteractionEnabled = false
    host.isAccessibilityElement = false
    layer.frame = host.bounds
    layer.videoGravity = .resizeAspect
    host.layer.addSublayer(layer)
    window.addSubview(host)

    let made = AVPictureInPictureController(contentSource: .init(
      sampleBufferDisplayLayer: layer,
      playbackDelegate: self
    ))
    made.delegate = self
    // Linear playback hides seek chrome the card could never honor.
    made.requiresLinearPlayback = true
    controller = made

    // iOS ends the audio session for calls and Siri without asking. The
    // `active` flag must follow, or the guard in session() would swallow
    // every re-arm and one interruption would disarm PiP for the whole run.
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(interrupted(_:)),
      name: AVAudioSession.interruptionNotification,
      object: AVAudioSession.sharedInstance()
    )
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    timer?.cancel()
    expiry?.cancel()
  }

  // Arms or disarms automatic entry at the moment the user leaves the app.
  // While armed the feed idles at one frame per second so the layer always
  // holds a current frame when backgrounding happens.
  func auto(_ on: Bool) {
    controller.canStartPictureInPictureAutomaticallyFromInline = on
    if on {
      session(true)
      run()
    } else if !controller.isPictureInPictureActive {
      idle()
    }
  }

  // Manual entry. One fresh frame lands first so AVKit has content to
  // project the moment the window opens. True means the request was
  // submitted, the same promise Android's enterPictureInPictureMode makes;
  // a refusal comes back through the failure delegate — or the bounded wait
  // in start() — as changed(false).
  func enter() -> Bool {
    guard !controller.isPictureInPictureActive else { return true }
    session(true)
    run()
    queue.async { [weak self] in
      self?.render()
      DispatchQueue.main.async { self?.start() }
    }
    return true
  }

  // AVKit flips isPictureInPicturePossible asynchronously once the layer is
  // attached and holds a frame, and startPictureInPicture is a documented
  // no-op until then — one the failure delegate never reports. On a cold
  // pipeline the first tap would be silently eaten, so an impossible start
  // parks on that property and fires when it flips, bounded so a real
  // refusal still settles as changed(false) instead of a tap that looks
  // dead. Main thread only, like every other controller touch.
  private func start() {
    waiting?.invalidate()
    waiting = nil
    expiry?.cancel()
    expiry = nil
    if controller.isPictureInPicturePossible {
      controller.startPictureInPicture()
      return
    }
    waiting = controller.observe(\.isPictureInPicturePossible, options: [.new]) { [weak self] _, change in
      guard change.newValue == true else { return }
      DispatchQueue.main.async {
        // A wait cleared by stop() or replaced by a newer entry stays quiet.
        guard let self, self.waiting != nil else { return }
        self.start()
      }
    }
    let bound = DispatchWorkItem { [weak self] in
      guard let self else { return }
      self.waiting?.invalidate()
      self.waiting = nil
      self.expiry = nil
      self.emit?("changed", ["inPip": false])
    }
    expiry = bound
    DispatchQueue.main.asyncAfter(deadline: .now() + 2, execute: bound)
  }

  func update(title: String, phase: String, detail: String?, progress: Double?, thumb: String?, startedAt: Double?) {
    session(true)
    run()
    queue.async { [weak self] in
      guard let self else { return }
      // The run registry's own start time drives the clock when given, so
      // the card agrees with every other surface showing the same run.
      if let startedAt {
        self.began = Date(timeIntervalSince1970: startedAt / 1000)
      } else if self.began == nil {
        self.began = Date()
      }
      self.state = State(
        title: title,
        phase: phase,
        detail: detail,
        progress: progress.map { min(max($0, 0), 1) },
        thumb: thumb.flatMap(Self.image)
      )
      self.render()
    }
  }

  // Ends the window and empties the card but keeps the pipeline warm; the
  // next update or arm starts a fresh run. Auto stays as JS set it. A
  // manual entry still parked in start() is cancelled — stopped means no
  // window may open later.
  func stop() {
    waiting?.invalidate()
    waiting = nil
    expiry?.cancel()
    expiry = nil
    if controller.isPictureInPictureActive {
      controller.stopPictureInPicture()
    }
    idle()
    queue.async { [weak self] in
      guard let self else { return }
      self.began = nil
      self.state = State()
      self.clear()
    }
  }

  // Full teardown for module destruction; stop() alone keeps the host view
  // parked for the next run.
  func close() {
    stop()
    host.removeFromSuperview()
  }

  // Where the host view can live right now; nil during the first instants
  // of launch, which PipModule reports as a typed refusal.
  static var window: UIWindow? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
    return scene?.windows.first { $0.isKeyWindow } ?? scene?.windows.first
  }

  private func run() {
    guard timer == nil else { return }
    let made = DispatchSource.makeTimerSource(queue: queue)
    // One frame per second is exactly the cadence the clock needs and costs
    // nothing worth measuring.
    made.schedule(deadline: .now(), repeating: 1, leeway: .milliseconds(100))
    made.setEventHandler { [weak self] in self?.render() }
    made.resume()
    timer = made
  }

  private func idle() {
    timer?.cancel()
    timer = nil
    session(false)
  }

  // PiP eligibility and background runtime both hang off the audio session:
  // .playback keeps the process treated as playing, .mixWithOthers keeps us
  // from silencing whatever the user is actually listening to. The flag
  // records only what actually took — after a failed arm it stays false so
  // the next call retries, instead of trusting a session that never
  // existed; after a failed release it stays true, which is equally the
  // truth.
  private func session(_ on: Bool) {
    guard on != active else { return }
    let audio = AVAudioSession.sharedInstance()
    do {
      if on {
        try audio.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try audio.setActive(true)
      } else {
        try audio.setActive(false, options: [.notifyOthersOnDeactivation])
      }
      active = on
    } catch {
      NSLog("[pip] audio session: %@", error.localizedDescription)
    }
  }

  // A phone call or Siri deactivates the session out from under us. Record
  // that honestly the moment it begins, and take the session back when the
  // interruption ends while the pipeline is live — a running timer means
  // auto is armed or the window is open, exactly the states that depend on
  // the session. The notification can arrive on any thread; `active` and
  // `timer` belong to main.
  @objc private func interrupted(_ note: Notification) {
    guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
          let kind = AVAudioSession.InterruptionType(rawValue: raw) else { return }
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      switch kind {
      case .began:
        self.active = false
      case .ended:
        if self.timer != nil { self.session(true) }
      @unknown default:
        break
      }
    }
  }

  // On queue.
  private func render() {
    let elapsed = began.map { Date().timeIntervalSince($0) }
    guard let pixel = card.draw(state, elapsed: elapsed),
          let sample = Self.sample(pixel) else { return }
    if #available(iOS 17.0, *) {
      let renderer = layer.sampleBufferRenderer
      if renderer.status == .failed { renderer.flush() }
      if renderer.isReadyForMoreMediaData { renderer.enqueue(sample) }
    } else {
      if layer.status == .failed { layer.flush() }
      if layer.isReadyForMoreMediaData { layer.enqueue(sample) }
    }
  }

  private func clear() {
    if #available(iOS 17.0, *) {
      layer.sampleBufferRenderer.flush()
    } else {
      layer.flushAndRemoveImage()
    }
  }

  private static func sample(_ pixel: CVPixelBuffer) -> CMSampleBuffer? {
    var format: CMVideoFormatDescription?
    CMVideoFormatDescriptionCreateForImageBuffer(
      allocator: kCFAllocatorDefault,
      imageBuffer: pixel,
      formatDescriptionOut: &format
    )
    guard let format else { return nil }
    var timing = CMSampleTimingInfo(
      duration: .invalid,
      presentationTimeStamp: CMClock.hostTimeClock.time,
      decodeTimeStamp: .invalid
    )
    var sample: CMSampleBuffer?
    CMSampleBufferCreateReadyWithImageBuffer(
      allocator: kCFAllocatorDefault,
      imageBuffer: pixel,
      formatDescription: format,
      sampleTiming: &timing,
      sampleBufferOut: &sample
    )
    // Immediate display sidesteps timebase bookkeeping: each frame simply
    // replaces the previous one.
    if let sample,
       let list = CMSampleBufferGetSampleAttachmentsArray(sample, createIfNecessary: true),
       CFArrayGetCount(list) > 0 {
      let first = unsafeBitCast(CFArrayGetValueAtIndex(list, 0), to: CFMutableDictionary.self)
      CFDictionarySetValue(
        first,
        Unmanaged.passUnretained(kCMSampleAttachmentKey_DisplayImmediately).toOpaque(),
        Unmanaged.passUnretained(kCFBooleanTrue).toOpaque()
      )
    }
    return sample
  }

  // Accepts a data URI or raw base64. An https thumb is possible in the Run
  // shape but drawing must never block on the network, so only inline bytes
  // reach the card.
  private static func image(_ thumb: String) -> UIImage? {
    var text = thumb
    if text.hasPrefix("http") { return nil }
    if text.hasPrefix("data:"), let comma = text.firstIndex(of: ",") {
      text = String(text[text.index(after: comma)...])
    }
    guard let data = Data(base64Encoded: text, options: [.ignoreUnknownCharacters]) else {
      return nil
    }
    return UIImage(data: data)
  }
}

extension Pip: AVPictureInPictureControllerDelegate {
  func pictureInPictureControllerDidStartPictureInPicture(_ controller: AVPictureInPictureController) {
    emit?("changed", ["inPip": true])
  }

  func pictureInPictureControllerDidStopPictureInPicture(_ controller: AVPictureInPictureController) {
    emit?("changed", ["inPip": false])
  }

  func pictureInPictureController(_ controller: AVPictureInPictureController, failedToStartPictureInPictureWithError error: Error) {
    // The OS surfaces nothing on failure; report the settled state so JS is
    // never left believing a window exists.
    NSLog("[pip] failed to start: %@", error.localizedDescription)
    emit?("changed", ["inPip": false])
  }

  func pictureInPictureController(_ controller: AVPictureInPictureController, restoreUserInterfaceForPictureInPictureStopWithCompletionHandler completionHandler: @escaping (Bool) -> Void) {
    // The user tapped expand: the app is coming back. JS decides where to
    // land; nothing needs restoring natively, so complete immediately.
    emit?("restored", [:])
    completionHandler(true)
  }
}

extension Pip: AVPictureInPictureSampleBufferPlaybackDelegate {
  // The card is live status, not media. Never paused plus an indefinite
  // range makes the window show live-style chrome instead of a scrubber
  // frozen at zero.
  func pictureInPictureController(_ controller: AVPictureInPictureController, setPlaying playing: Bool) {}

  func pictureInPictureControllerTimeRangeForPlayback(_ controller: AVPictureInPictureController) -> CMTimeRange {
    CMTimeRange(start: .negativeInfinity, end: .positiveInfinity)
  }

  func pictureInPictureControllerIsPlaybackPaused(_ controller: AVPictureInPictureController) -> Bool {
    false
  }

  func pictureInPictureController(_ controller: AVPictureInPictureController, didTransitionToRenderSize newRenderSize: CMVideoDimensions) {
    queue.async { [weak self] in self?.render() }
  }

  func pictureInPictureController(_ controller: AVPictureInPictureController, skipByInterval skipInterval: CMTime, completion completionHandler: @escaping () -> Void) {
    completionHandler()
  }
}
