package ai.hanzo.mobile.pip

import android.app.PictureInPictureParams
import android.content.pm.PackageManager
import android.os.Build
import android.util.Rational
import androidx.activity.ComponentActivity
import androidx.annotation.RequiresApi
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.core.util.Consumer
import androidx.lifecycle.Lifecycle
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android side of the 'pip' module. Android PiP is activity-level: the OS
// miniaturizes the live activity and the React tree keeps rendering inside
// the small window, so this module only decides WHEN the window appears and
// what aspect it keeps. What the window shows is decided in JS.
class PipModule : Module() {
  private var auto = false
  private var ratio = Rational(16, 9)
  private var bound: ComponentActivity? = null

  // Expand and dismiss arrive through the same mode-change callback; the
  // lifecycle tells them apart. An expanding activity is heading back to the
  // foreground (STARTED or above), a dismissed one has already stopped.
  private val moded = Consumer<PictureInPictureModeChangedInfo> { info ->
    sendEvent("changed", mapOf("inPip" to info.isInPictureInPictureMode))
    if (!info.isInPictureInPictureMode &&
      bound?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.STARTED) == true
    ) {
      sendEvent("restored", emptyMap<String, Any?>())
    }
  }

  override fun definition() = ModuleDefinition {
    Name("pip")

    Events("changed", "restored")

    Function("isSupported") { supported() }

    AsyncFunction("enter") { w: Int, h: Int ->
      ratio = rational(w, h)
      enter()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setAuto") { on: Boolean ->
      auto = on
      apply()
    }.runOnQueue(Queues.MAIN)

    // The current activity only exists once it is up, and foreground is the
    // one hook that fires both on cold start and on every return, so the
    // listeners (re)bind here to whatever activity is live.
    OnActivityEntersForeground { bind() }

    // Pre-S auto-enter. S and later consume the leave hint natively once
    // auto-enter params are set, so this only fires where the OS will not
    // do it for us.
    OnUserLeavesActivity {
      if (auto && Build.VERSION.SDK_INT < Build.VERSION_CODES.S) enter()
    }

    OnActivityDestroys { unbind() }

    OnDestroy { unbind() }
  }

  private fun supported(): Boolean {
    val context = appContext.reactContext ?: return false
    return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
      context.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
  }

  private fun rational(w: Int, h: Int): Rational {
    if (w <= 0 || h <= 0) return Rational(16, 9)
    // The platform only allows aspect ratios in [~1:2.39, 2.39:1] and throws
    // on enter otherwise, so out-of-range requests fall back to the default.
    val value = w.toFloat() / h.toFloat()
    return if (value < 0.42f || value > 2.39f) Rational(16, 9) else Rational(w, h)
  }

  @RequiresApi(Build.VERSION_CODES.O)
  private fun params(): PictureInPictureParams {
    val builder = PictureInPictureParams.Builder().setAspectRatio(ratio)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setAutoEnterEnabled(auto)
      // The window shows text, not video; scaling it smoothly mid-resize
      // turns the card into a blur.
      builder.setSeamlessResizeEnabled(false)
    }
    return builder.build()
  }

  private fun enter(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !supported()) return false
    val activity = appContext.currentActivity ?: return false
    return try {
      activity.enterPictureInPictureMode(params())
    } catch (_: IllegalStateException) {
      // Not visible, already finishing, or the OS refused; nothing to do.
      false
    }
  }

  // Keep the stored params on the live activity current so S+ auto-enter
  // fires with no JS involvement at leave time.
  private fun apply() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !supported()) return
    val activity = appContext.currentActivity ?: return
    try {
      activity.setPictureInPictureParams(params())
    } catch (_: IllegalStateException) {
      // The activity is on its way out; the next bind applies fresh params.
    }
  }

  private fun bind() {
    val activity = appContext.currentActivity as? ComponentActivity ?: return
    if (bound === activity) {
      apply()
      return
    }
    unbind()
    activity.addOnPictureInPictureModeChangedListener(moded)
    bound = activity
    apply()
  }

  private fun unbind() {
    bound?.removeOnPictureInPictureModeChangedListener(moded)
    bound = null
  }
}
