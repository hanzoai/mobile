package ai.hanzo.mobile.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android side of the 'widget' module. JS hands over the state as a JSON
// string (same shape both platforms store: { snippet, updatedAt }); we
// persist it where WidgetProvider reads and nudge every placed widget.
class WidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    // The ONE cross-platform module name; modules/widget/index.ts and the
    // iOS side both bind 'Widget'.
    Name("Widget")

    AsyncFunction("set") { stateJson: String ->
      // No react context means the app is tearing down; there is nothing
      // to persist for and the next foreground write will land.
      val context = appContext.reactContext ?: return@AsyncFunction

      // commit, not apply: the broadcast below must find the new state on
      // disk when the provider re-renders.
      context.getSharedPreferences("widget", Context.MODE_PRIVATE)
        .edit()
        .putString("state", stateJson)
        .commit()

      val manager = AppWidgetManager.getInstance(context)
      val provider = ComponentName(context, WidgetProvider::class.java)
      val ids = manager.getAppWidgetIds(provider)
      if (ids.isNotEmpty()) {
        val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
          .setComponent(provider)
          .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        context.sendBroadcast(intent)
      }
    }
  }
}
