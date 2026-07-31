# Android App And Subscriptions

## Android packaging

My Pool Pal is prepared for Capacitor with:

- App name: `My Pool Pal`
- Draft Android package ID: `com.mypoolpal.app`
- Web output folder: `www`

The package ID can be changed before the first Play Store release. After publishing, treat it as permanent.

## Subscription model

Use Google Play Billing for Android subscriptions. A simple first release could be:

- Free: calculator, safety guide, volume calculator, saved pool profiles.
- Pro subscription: history export, unlimited history, advanced reminders, multi-device/cloud backup later.

Do not rely only on front-end local storage to unlock paid features. Google recommends connecting Play Billing with a server backend so purchases and subscription state can be verified and restored securely.

## Play Console setup needed

Before billing can be fully wired in, create these in Google Play Console:

- App listing for My Pool Pal.
- Subscription product ID, for example `my_pool_pal_pro_monthly`.
- Optional yearly product ID, for example `my_pool_pal_pro_yearly`.
- Internal testing track.
- License testers for test purchases.

## Build commands

After dependencies are installed:

```powershell
cd Poolz
npm.cmd run build
npx.cmd cap add android
npx.cmd cap sync android
```

Open the native project:

```powershell
npx.cmd cap open android
```

## Release signing

Release signing is configured through `android/keystore.properties`, which is ignored by Git.

Run `tools/create-android-upload-key.ps1` once to create the private upload key and local signing properties. Do not share or commit those files.

More detailed release steps are in `ANDROID_RELEASE.md`.
