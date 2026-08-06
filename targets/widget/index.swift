import WidgetKit
import SwiftUI

// The Hanzo home-screen widget. The app writes {snippet, updatedAt} JSON into
// the shared App Group (lib/widget.ts -> modules/widget); this extension only
// reads and renders it. No network and no invented content: before the first
// sync the widget says so instead of faking a conversation.

private let suite = "group.ai.hanzo.mobile"
private let key = "widget.state"

private struct Shared: Decodable {
  let snippet: String
  // Milliseconds since epoch, because the writer is JavaScript.
  let updatedAt: Double
}

private func shared() -> Shared? {
  guard
    let defaults = UserDefaults(suiteName: suite),
    let raw = defaults.string(forKey: key),
    let data = raw.data(using: .utf8)
  else { return nil }
  return try? JSONDecoder().decode(Shared.self, from: data)
}

struct Entry: TimelineEntry {
  let date: Date
  // nil means the app has never synced; the views render the honest hint.
  let snippet: String?
  let updated: Date?
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry {
    Entry(date: .now, snippet: nil, updated: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    completion(entry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    // The app reloads all timelines on every state write, so a single entry
    // is enough; the relative timestamp below renders live without reloads.
    completion(Timeline(entries: [entry()], policy: .never))
  }

  private func entry() -> Entry {
    guard let state = shared() else { return Entry(date: .now, snippet: nil, updated: nil) }
    return Entry(
      date: .now,
      snippet: state.snippet,
      updated: Date(timeIntervalSince1970: state.updatedAt / 1000)
    )
  }
}

// lib/theme.ts, mirrored: ground #0a0a0a, fg #fafafa, dim 55%, hairline 8%.
private let ground = Color(red: 10 / 255, green: 10 / 255, blue: 10 / 255)
private let fg = Color(red: 250 / 255, green: 250 / 255, blue: 250 / 255)
private let dim = fg.opacity(0.55)
private let hairline = fg.opacity(0.08)

private struct Mark: View {
  var body: some View {
    Text("Hanzo")
      .font(.system(size: 11, weight: .semibold))
      .tracking(0.5)
      .foregroundStyle(dim)
  }
}

private struct Snippet: View {
  let entry: Entry
  let lines: Int

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if let snippet = entry.snippet, let updated = entry.updated {
        Text(snippet)
          .font(.system(size: 13, weight: .regular))
          .foregroundStyle(fg)
          .lineLimit(lines)
          .fixedSize(horizontal: false, vertical: true)
        Text(updated, style: .relative)
          .font(.system(size: 11))
          .foregroundStyle(dim)
      } else {
        Text("Open Hanzo to sync")
          .font(.system(size: 13))
          .foregroundStyle(dim)
      }
    }
  }
}

private struct Action: View {
  let symbol: String
  let url: String

  var body: some View {
    Link(destination: URL(string: url)!) {
      Image(systemName: symbol)
        .font(.system(size: 14, weight: .medium))
        .foregroundStyle(fg)
        .frame(maxWidth: .infinity, minHeight: 34)
        .background(hairline, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
    }
  }
}

private struct Small: View {
  let entry: Entry

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Mark()
      Spacer(minLength: 0)
      Snippet(entry: entry, lines: 3)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    // The small family is one tap target; deep links per region need medium.
    .widgetURL(URL(string: "hanzo://chat"))
  }
}

private struct Medium: View {
  let entry: Entry

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Mark()
        Spacer()
      }
      Snippet(entry: entry, lines: 2)
      Spacer(minLength: 0)
      HStack(spacing: 8) {
        Action(symbol: "mic", url: "hanzo://voice")
        Action(symbol: "doc", url: "hanzo://send?type=file")
        Action(symbol: "photo", url: "hanzo://send?type=image")
        Action(symbol: "lock", url: "hanzo://chat/private")
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

private struct Root: View {
  @Environment(\.widgetFamily) private var family
  let entry: Entry

  var body: some View {
    switch family {
    case .systemMedium:
      Medium(entry: entry)
    default:
      Small(entry: entry)
    }
  }
}

struct HanzoWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "HanzoWidget", provider: Provider()) { entry in
      Root(entry: entry)
        .containerBackground(ground, for: .widget)
    }
    .configurationDisplayName("Hanzo")
    .description("Last conversation and quick actions.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct Widgets: WidgetBundle {
  var body: some Widget {
    HanzoWidget()
  }
}
