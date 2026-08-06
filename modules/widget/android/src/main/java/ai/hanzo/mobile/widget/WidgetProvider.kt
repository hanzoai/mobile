package ai.hanzo.mobile.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.text.format.DateUtils
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

// Home-screen widget: a dark card with the latest snippet and four tap zones
// that deep-link into the app. Classic AppWidgetProvider + RemoteViews on
// purpose — zero extra dependencies, works on every launcher and API level
// the app supports.
//
// State arrives as JSON under SharedPreferences "widget"/"state" (the same
// shape the iOS side stores: { snippet, updatedAt }); WidgetModule writes it
// and broadcasts ACTION_APPWIDGET_UPDATE so this provider re-renders.
class WidgetProvider : AppWidgetProvider() {

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val views = render(context)
    for (id in ids) manager.updateAppWidget(id, views)
  }

  private fun render(context: Context): RemoteViews {
    // The layout and ids live in the app's own res tree — the config plugin
    // copies android-widget-res/ in at prebuild — so this library resolves
    // them by name at runtime; it cannot compile against the app's R class.
    val res = context.resources
    val pkg = context.packageName
    fun id(name: String, type: String) = res.getIdentifier(name, type, pkg)

    val views = RemoteViews(pkg, id("widget", "layout"))

    var snippet = ""
    var updatedAt = 0L
    val state = context.getSharedPreferences("widget", Context.MODE_PRIVATE).getString("state", null)
    if (state != null) {
      try {
        val json = JSONObject(state)
        snippet = json.optString("snippet")
        updatedAt = json.optLong("updatedAt")
      } catch (_: Exception) {
        // A malformed write renders as the honest empty state, never a crash
        // on the home screen.
      }
    }

    if (snippet.isEmpty()) {
      views.setTextViewText(id("snippet", "id"), "No activity yet")
      views.setViewVisibility(id("updated", "id"), View.GONE)
    } else {
      views.setTextViewText(id("snippet", "id"), snippet)
      if (updatedAt > 0L) {
        views.setViewVisibility(id("updated", "id"), View.VISIBLE)
        views.setTextViewText(id("updated", "id"), DateUtils.getRelativeTimeSpanString(updatedAt))
      } else {
        views.setViewVisibility(id("updated", "id"), View.GONE)
      }
    }

    // The whole card falls back to chat; the four zones sit above it and win
    // inside their own bounds.
    tap(context, views, id("card", "id"), "hanzo://chat", 0)
    tap(context, views, id("voice", "id"), "hanzo://voice", 1)
    tap(context, views, id("file", "id"), "hanzo://send?type=file", 2)
    tap(context, views, id("image", "id"), "hanzo://send?type=image", 3)
    tap(context, views, id("incognito", "id"), "hanzo://chat/private", 4)
    return views
  }

  private fun tap(context: Context, views: RemoteViews, view: Int, uri: String, code: Int) {
    // setPackage keeps the ACTION_VIEW inside our app even if another app
    // ever claims the hanzo scheme; distinct request codes keep the five
    // PendingIntents from collapsing into one.
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).setPackage(context.packageName)
    val pending = PendingIntent.getActivity(
      context, code, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    views.setOnClickPendingIntent(view, pending)
  }
}
