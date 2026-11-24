import ExpoModulesCore
import WidgetKit

// App-side half of the home-screen widget: persist the shared state in the
// App Group and ask WidgetKit to redraw. The JSON shape is owned by
// lib/widget.ts and decoded by targets/widget; this module never interprets
// it, so the two sides cannot drift through here.
public class WidgetModule: Module {
  public func definition() -> ModuleDefinition {
    Name("Widget")

    Function("set") { (stateJson: String) in
      // UserDefaults(suiteName:) returns an instance even WITHOUT the App
      // Group entitlement — the writes just land in an unshared bucket the
      // widget can never read, silently. containerURL is the probe that
      // actually answers "is the entitlement on this build": nil means a
      // build without plugins/widget-ios.js (or a hand-managed profile
      // missing group.ai.hanzo.mobile), and saying so in the log is the
      // difference between a five-minute fix and a widget that mysteriously
      // reads "Open Hanzo to sync" forever.
      let configured = (Bundle.main.object(forInfoDictionaryKey: "HanzoAppGroup") as? String)?
        .trimmingCharacters(in: .whitespacesAndNewlines)
      let group = (configured?.isEmpty == false ? configured : nil) ?? "group.ai.hanzo.mobile"
      guard FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: group) != nil,
        let defaults = UserDefaults(suiteName: group)
      else {
        NSLog("[widget] app group entitlement \(group) missing — widget state not shared")
        return
      }
      defaults.set(stateJson, forKey: "widget.state")
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
