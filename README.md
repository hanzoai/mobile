# Hanzo

[![Open in Hanzo](https://hanzo.app/badges/open-in-hanzo.svg)](https://hanzo.app/dev/open?repo=github.com/hanzoai/mobile&ref=main&action=open) [![Edit with Hanzo](https://hanzo.app/badges/edit-with-hanzo.svg)](https://hanzo.app/dev/open?repo=github.com/hanzoai/mobile&ref=main&action=edit) [![Deploy with Hanzo](https://hanzo.app/badges/deploy-with-hanzo.svg)](https://hanzo.app/dev/open?repo=github.com/hanzoai/mobile&ref=main&action=deploy)

The native Hanzo AI app for iOS and Android: chat, tasks, voice, image
generation, and unified `gen` agentic harness control for Cloud and local
`hanzod`. The AI follows you out of the app — while work runs, leaving the app
drops it into picture-in-picture on both platforms, and a home-screen widget
shows the latest activity with quick actions.

Full mobile setup & sideloading guide: <https://docs.hanzo.ai/docs/apps/mobile>

Expo SDK 57, expo-router, TypeScript, UI on @hanzo/gui 8.1.1 (RN-native).
Dark only for v0: ground `#0a0a0a`, foreground `#fafafa`, hairlines as subtle
alpha.

## Install

### Android APK

Download the signed Release APK directly or install over ADB:

- Direct APK: <https://github.com/hanzoai/mobile/releases/latest/download/hanzo-android.apk>

```sh
curl -fLO https://github.com/hanzoai/mobile/releases/latest/download/hanzo-android.apk
adb install -r hanzo-android.apk
```

### iOS on macOS over USB (Xcode + Free Personal Team Apple ID)

Free Personal Team Apple IDs cannot use the `ai.hanzo.mobile` bundle ID or
Apple `App Group` / WidgetKit extension entitlements. Set
`HANZO_IOS_PERSONAL_TEAM=1` and a unique `HANZO_IOS_BUNDLE_ID` to generate a
clean single-target `Hanzo.app` project that signs with any free Apple ID:

```sh
pnpm install
HANZO_IOS_PERSONAL_TEAM=1 HANZO_IOS_BUNDLE_ID=dev.<you>.hanzo npx expo prebuild --platform ios --clean
pod install --project-directory=ios
open ios/Hanzo.xcworkspace
```

In Xcode: select the **Hanzo** target -> **Signing & Capabilities**, enable
**Automatically manage signing**, pick your **Personal Team** Apple ID, choose
your USB-connected iPhone, and press **Run (`⌘R`)**. On first install, trust
your developer certificate on iPhone under **Settings -> General -> VPN &
Device Management**.

Paid Apple Developer teams using a custom bundle ID while keeping the
home-screen widget can instead pass `HANZO_IOS_BUNDLE_ID=com.acme.hanzo` and
`HANZO_APP_GROUP=group.com.acme.hanzo`.

### iOS on Linux Desktop over USB (`hanzo-ios.ipa`)

Every release publishes an unsigned single-target Release IPA ready for local
Apple ID signing over `usbmuxd`:

- Direct IPA: <https://github.com/hanzoai/mobile/releases/latest/download/hanzo-ios.ipa>

**Option A — `AltServer-Linux` / `SideStore` (free Apple ID over USB):**

```sh
curl -fLO https://github.com/hanzoai/mobile/releases/latest/download/hanzo-ios.ipa
UDID="$(idevice_id -l | head -n1)"
AltServer -u "$UDID" -a "<your-apple-id>" -p "<your-password>" hanzo-ios.ipa
```

**Option B — `zsign` + `ideviceinstaller` (developer `.p12` + `.mobileprovision`):**

```sh
curl -fLO https://github.com/hanzoai/mobile/releases/latest/download/hanzo-ios.ipa
zsign -k cert.p12 -p "<p12-password>" -m profile.mobileprovision -o hanzo-signed.ipa hanzo-ios.ipa
ideviceinstaller -i hanzo-signed.ipa
```

See <https://docs.hanzo.ai/docs/apps/mobile> for `usbmuxd`, pairing, and
7-day free-account refresh details.

## Run (Development)

```sh
pnpm install
npx expo run:ios        # Xcode 16+ (26 works) + CocoaPods
npx expo run:android    # Android SDK
```

`pnpm start` serves the dev bundle; `pnpm typecheck` (tsc --noEmit) and
`pnpm test` (jest) are the gates. `ios/` and `android/` are prebuild output
and stay out of git — `npx expo prebuild` regenerates them from `app.json` +
`app.config.js` plus the three plugins in `plugins/`. On macOS the iOS device
flow mirrors `bot/apps/ios`'s manual deploy: local signing, no EAS.

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
across the process boundary through App Group `group.ai.hanzo.mobile` (or
`HANZO_APP_GROUP`). Setting `HANZO_IOS_PERSONAL_TEAM=1` omits the extension
and entitlement for free Personal Team builds.

Android: RemoteViews provider wired automatically at prebuild —
`plugins/widget-android.js` adds the receiver to the app manifest and copies
`android-widget-res/` into the app res tree.

## License

MIT OR Apache-2.0, at your option.
