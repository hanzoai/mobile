# Hanzo

The native Hanzo AI app for iOS and Android: chat, tasks, voice, image
generation. The AI follows you out of the app — while work runs, leaving the
app drops it into picture-in-picture on both platforms, and a home-screen
widget shows the latest activity with quick actions.

Expo SDK 57, expo-router, TypeScript, UI on @hanzo/gui 8.1.1 (RN-native).
Dark only for v0: ground `#0a0a0a`, foreground `#fafafa`, hairlines as subtle
alpha.

## Run

```sh
pnpm install
npx expo run:ios        # Xcode 16+ (26 works) + CocoaPods
npx expo run:android    # Android SDK
```

`pnpm start` serves the dev bundle; `pnpm typecheck` (tsc --noEmit) and
`pnpm test` (jest) are the gates. `ios/` and `android/` are prebuild output
and stay out of git — `npx expo prebuild` regenerates them from `app.json`
plus the three plugins in `plugins/`. On this machine the iOS device flow
mirrors `bot/apps/ios`'s manual deploy: local signing, no EAS.

## Auth

Identity is native Hanzo IAM (hanzo.id) over OIDC PKCE: public client
`hanzo-mobile`, redirect `hanzo://oauth/mobile`, discovery at
`/.well-known/openid-configuration`, token endpoint `/v1/iam/oauth/token`.
Registering the `hanzo-mobile` client in IAM is the one server-side seed
still needed; until it lands the sign-in screen says exactly that, and the
alpha path works today — paste an `sk-` API key, which is proven against
`GET /v1/models` before it is kept. Both credential kinds live in one slot in
the platform keychain (expo-secure-store); nothing secret ever touches
AsyncStorage or a file.

All API traffic is `https://api.hanzo.ai` with `/v1/` paths.

## Picture-in-picture

The rule, stated once in `lib/pip.ts`: work in flight arms the surface.
While a run is active, leaving the app miniaturizes it and the card follows
the run — phase, detail, progress, elapsed; when nothing runs, leaving the
app does nothing. Expanding the window lands on the Tasks board.

|  | iOS | Android |
|---|---|---|
| the window shows | rendered status frames fed to an `AVSampleBufferDisplayLayer` — iOS only miniaturizes video layers, and the OS supplies X/expand/drag | the real activity view; `components/pip/PipCard` overlays the React tree while miniature |
| auto-enter | on background, only while a run is active (contentSource pipeline, 15.1 floor) | `setAutoEnterEnabled` on API 31+, `onUserLeaveHint` below |
| update path | status crosses the bridge, throttled to one frame per second, trailing update kept | none — the card is live JS |

expo-video's own PiP covers actual video playback surfaces per the standard
recipe; this module exists because the status card is not a video.

App Review note: non-video PiP rides the video-layer API, which Apple has
historically rejected in public App Store review. Current posture is
internal/alpha distribution; revisit before submission.

## Widget

Shows the latest activity — the last assistant message, or the live run line
while work is in flight — plus four quick actions: Voice (`hanzo://voice`),
File (`hanzo://send?type=file`), Image (`hanzo://send?type=image`), Private
chat (`hanzo://chat/private`). Tapping the card body opens chat. The app
pushes state and the widget never polls or invents content — before the
first sync it says so.

iOS: WidgetKit extension in `targets/widget`, generated at prebuild by
@bacons/apple-targets (composed by `plugins/widget-ios.js`), reading state
across the process boundary through App Group `group.ai.hanzo.mobile`. If
the targets plugin is unavailable, prebuild warns and skips the target —
install it and re-run, or add the target manually in Xcode with the same
App Group.

Android: RemoteViews provider wired automatically at prebuild —
`plugins/widget-android.js` adds the receiver to the app manifest and copies
`android-widget-res/` into the app res tree.

## License

MIT OR Apache-2.0, at your option.
