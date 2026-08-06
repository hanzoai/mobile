# Hanzo

The native Hanzo AI app for iOS and Android. Expo SDK 57, expo-router,
TypeScript, UI on @hanzo/gui.

```sh
pnpm install
pnpm start        # expo dev server
pnpm typecheck    # tsc --noEmit
```

Identity is Hanzo IAM (hanzo.id, OIDC PKCE) or a pasted sk- API key; both
live only in the platform keychain via expo-secure-store. API is
https://api.hanzo.ai with /v1/ paths. Native project folders (ios/, android/)
are prebuild output and stay out of git.
