# @lboa/mobile

Expo (SDK 57) app for the Local Business Opportunity Analyzer.

## Run

```bash
pnpm install                       # repo root
pnpm --filter @lboa/api dev        # backend on :3001 (fixture data mode by default)
pnpm --filter @lboa/mobile start   # Expo dev server
```

- **Expo Go**: everything works except the Map tab (react-native-maps requires a dev build:
  `npx expo run:android` / `run:ios` or an EAS development build).
- Set the API base URL in Settings when testing on a physical device (use your machine's LAN IP,
  not localhost).

## Android APK (local build, no EAS account needed)

```bash
cd apps/mobile
npx expo prebuild --platform android --no-install   # generates android/ (gitignored)
cd android
# Windows: ensure JAVA_HOME → JDK 17, ANDROID_HOME → %LOCALAPPDATA%\Android\Sdk
./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
adb install app/build/outputs/apk/debug/app-debug.apk
```

Debug APKs bundle no JS — they load from the Metro dev server (`pnpm --filter @lboa/mobile start`
on the same network). For a self-contained build use `assembleRelease` (auto-signed with the
debug keystore unless you configure signing).

## Offline behavior (ADR-003)

- Projects and field observations write to on-device SQLite first and queue in an outbox.
- Background sync drains the outbox when connectivity returns (exponential backoff on failure);
  per-entity sync status is shown as labeled dots.
- Analysis results are cached in SQLite after each run and readable offline. Running a NEW
  analysis requires connectivity (the engine and providers live behind the API).
- Conflicts resolve last-write-wins by revision; superseded writes are audited server-side and
  surfaced in Settings.

## Accessibility

- All interactive elements carry `accessibilityRole`/`accessibilityLabel`; live regions announce
  analysis progress and save confirmations.
- Scores are never conveyed by color alone — numeric values and text labels accompany every bar,
  pill, and dot. Touch targets are ≥44pt. Both light and dark themes meet AA contrast.

## Product invariants (ADR-001)

Opportunity, Risk, and Confidence are three separate measures and are rendered separately —
no blended score exists anywhere in this app. Every recommendation links to its rule
contributions and the evidence behind them, including assumptions and data gaps.
