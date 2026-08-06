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
      guard let defaults = UserDefaults(suiteName: "group.ai.hanzo.mobile") else {
        // No App Group means the entitlement is missing from this build;
        // the widget simply stays stale rather than the app failing.
        return
      }
      defaults.set(stateJson, forKey: "widget.state")
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
