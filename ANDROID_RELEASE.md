# My Pool Pal Android Release

## One-time upload key setup

Run this from PowerShell:

```powershell
cd C:\Users\benno\Documents\Codex\2026-05-21\make-an-app-for-calculating-pool\Poolz
powershell -ExecutionPolicy Bypass -File .\tools\create-android-upload-key.ps1
```

Choose strong passwords when prompted and keep them somewhere safe.

This creates:

- `android/keys/pool-ez-upload-key.jks`
- `android/keystore.properties`

Both files are ignored by Git and must stay private. Back them up somewhere secure.

## Build the signed Play Store bundle

After the upload key exists:

```powershell
cd C:\Users\benno\Documents\Codex\2026-05-21\make-an-app-for-calculating-pool\Poolz
powershell -ExecutionPolicy Bypass -File .\tools\build-android-release.ps1
```

The signed upload file for Google Play will be:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

If `android/keystore.properties` does not exist, a release `.aab` may be generated as a dry-run artifact, but it is not the private upload-key-signed bundle you should send to Google Play.

## Play Console

In Google Play Console:

1. Create the My Pool Pal app.
2. Keep package name `com.mypoolpal.app`.
3. Upload the signed `.aab`.
4. Let Google Play manage app signing.
5. Keep using the local upload key for future releases.

## Subscriptions

Recommended first products:

- `my_pool_pal_pro_monthly`
- `my_pool_pal_pro_yearly`

Create these in Play Console before the app subscription code is wired in.
