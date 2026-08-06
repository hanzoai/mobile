import CoreVideo
import UIKit

// What the card shows. The thumb arrives already decoded; decoding happens
// once per update, never inside the per-second draw loop.
struct State {
  var title = ""
  var phase = ""
  var detail: String?
  var progress: Double?
  var thumb: UIImage?
}

// Rasterizes the status card into pixel buffers AVKit can treat as video
// frames: the resting-card look — dark rounded card on black, wordmark and
// clock up top, bold phase over secondary detail, a thin progress bar when
// the work can measure itself. Pure drawing: no AVKit, no threading opinion.
// It is safe off the main thread because string and image drawing are
// documented thread-safe once an explicit context is current.
final class Card {
  // 16:9 at roughly 2x the on-screen window: crisp on device, cheap to fill.
  static let size = CGSize(width: 640, height: 360)

  private var pool: CVPixelBufferPool?

  func draw(_ state: State, elapsed: TimeInterval?) -> CVPixelBuffer? {
    guard let pixel = buffer() else { return nil }
    CVPixelBufferLockBaseAddress(pixel, [])
    defer { CVPixelBufferUnlockBaseAddress(pixel, []) }
    guard let ctx = CGContext(
      data: CVPixelBufferGetBaseAddress(pixel),
      width: Int(Self.size.width),
      height: Int(Self.size.height),
      bitsPerComponent: 8,
      bytesPerRow: CVPixelBufferGetBytesPerRow(pixel),
      space: CGColorSpaceCreateDeviceRGB(),
      bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    ) else { return nil }

    // UIKit string drawing wants a current context with a top-left origin.
    ctx.translateBy(x: 0, y: Self.size.height)
    ctx.scaleBy(x: 1, y: -1)
    UIGraphicsPushContext(ctx)
    defer { UIGraphicsPopContext() }
    paint(state, elapsed)
    return pixel
  }

  private func paint(_ state: State, _ elapsed: TimeInterval?) {
    let full = CGRect(origin: .zero, size: Self.size)

    // Opaque black base: video frames carry no useful alpha, and the fill
    // also initializes the pooled buffer, which arrives holding old contents.
    UIColor.black.setFill()
    UIRectFill(full)

    // #0a0a0a at 0.90 (E6) over black, hairline as subtle alpha — the same
    // ground and edge the rest of the estate uses. The OS rounds the window
    // itself; the inset card keeps its own edge visible inside that chrome.
    let card = full.insetBy(dx: 16, dy: 16)
    let shape = UIBezierPath(roundedRect: card, cornerRadius: 28)
    UIColor(white: 0.039, alpha: 0.9).setFill()
    shape.fill()
    shape.lineWidth = 2
    UIColor(white: 1, alpha: 0.08).setStroke()
    shape.stroke()

    let inset = card.insetBy(dx: 32, dy: 28)
    let fg = UIColor(white: 0.98, alpha: 1)
    let dim = UIColor(white: 0.98, alpha: 0.55)

    // Top row: clock on the right, wordmark and title filling the rest.
    var clockGap: CGFloat = 0
    if let elapsed {
      let whole = max(0, Int(elapsed))
      let text = String(format: "%02d:%02d", whole / 60, whole % 60) as NSString
      let attrs: [NSAttributedString.Key: Any] = [
        .font: UIFont.monospacedDigitSystemFont(ofSize: 24, weight: .medium),
        .foregroundColor: dim,
      ]
      let size = text.size(withAttributes: attrs)
      text.draw(at: CGPoint(x: inset.maxX - size.width, y: inset.minY + 2), withAttributes: attrs)
      clockGap = size.width + 24
    }

    let head = NSMutableAttributedString(
      string: "Hanzo",
      attributes: [.font: UIFont.systemFont(ofSize: 26, weight: .semibold), .foregroundColor: fg]
    )
    if !state.title.isEmpty {
      head.append(NSAttributedString(
        string: "  \u{00b7}  \(state.title)",
        attributes: [.font: UIFont.systemFont(ofSize: 24), .foregroundColor: dim]
      ))
    }
    let para = NSMutableParagraphStyle()
    para.lineBreakMode = .byTruncatingTail
    head.addAttribute(.paragraphStyle, value: para, range: NSRange(location: 0, length: head.length))
    head.draw(
      with: CGRect(x: inset.minX, y: inset.minY, width: inset.width - clockGap, height: 34),
      options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine],
      context: nil
    )

    // Middle band between the top row and the progress bar.
    let top = inset.minY + 46
    let bottom = state.progress == nil ? inset.maxY : inset.maxY - 24
    var x = inset.minX

    if let thumb = state.thumb, let ctx = UIGraphicsGetCurrentContext() {
      let side: CGFloat = 104
      let box = CGRect(x: x, y: (top + bottom - side) / 2, width: side, height: side)
      ctx.saveGState()
      UIBezierPath(roundedRect: box, cornerRadius: 22).addClip()
      let raw = thumb.size
      if raw.width > 0, raw.height > 0 {
        // Aspect-fill into the rounded box.
        let scale = max(side / raw.width, side / raw.height)
        let w = raw.width * scale
        let h = raw.height * scale
        thumb.draw(in: CGRect(x: box.midX - w / 2, y: box.midY - h / 2, width: w, height: h))
      }
      ctx.restoreGState()
      x = box.maxX + 24
    }

    let hasDetail = !(state.detail ?? "").isEmpty
    let block: CGFloat = hasDetail ? 92 : 50
    let y = (top + bottom - block) / 2
    let width = inset.maxX - x
    line(state.phase, UIFont.systemFont(ofSize: 40, weight: .bold), fg,
         CGRect(x: x, y: y, width: width, height: 50))
    if hasDetail, let detail = state.detail {
      line(detail, UIFont.systemFont(ofSize: 26), dim,
           CGRect(x: x, y: y + 58, width: width, height: 34))
    }

    // Progress is clamped to 0...1 upstream, in Pip, the one place status is
    // accepted; an absent value means indeterminate and draws nothing.
    if let progress = state.progress {
      let track = CGRect(x: inset.minX, y: inset.maxY - 8, width: inset.width, height: 8)
      UIColor(white: 1, alpha: 0.12).setFill()
      UIBezierPath(roundedRect: track, cornerRadius: 4).fill()
      let done = track.width * CGFloat(progress)
      if done >= 1 {
        fg.setFill()
        UIBezierPath(
          roundedRect: CGRect(x: track.minX, y: track.minY, width: done, height: 8),
          cornerRadius: min(4, done / 2)
        ).fill()
      }
    }
  }

  private func line(_ text: String, _ font: UIFont, _ color: UIColor, _ rect: CGRect) {
    let para = NSMutableParagraphStyle()
    para.lineBreakMode = .byTruncatingTail
    (text as NSString).draw(
      with: rect,
      options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine],
      attributes: [.font: font, .foregroundColor: color, .paragraphStyle: para],
      context: nil
    )
  }

  private func buffer() -> CVPixelBuffer? {
    if pool == nil {
      let attrs: [CFString: Any] = [
        kCVPixelBufferPixelFormatTypeKey: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey: Int(Self.size.width),
        kCVPixelBufferHeightKey: Int(Self.size.height),
        // IOSurface backing lets the display layer take frames without copies.
        kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary,
      ]
      var made: CVPixelBufferPool?
      CVPixelBufferPoolCreate(kCFAllocatorDefault, nil, attrs as CFDictionary, &made)
      pool = made
    }
    guard let pool else { return nil }
    var pixel: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &pixel)
    return pixel
  }
}
