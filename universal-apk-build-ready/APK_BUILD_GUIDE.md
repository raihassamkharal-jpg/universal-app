# Universal Android APK (free GitHub Actions build)

This ZIP is your original AI Studio project with a GitHub Actions workflow added to build a **debug APK** in the cloud.

## Build it without installing Android Studio

1. Extract this ZIP.
2. Create a GitHub account if you do not have one: https://github.com/
3. Create a **new repository**. A private repository is fine.
4. Upload all extracted project files and folders to the repository root. Make sure `.github/workflows/build-android.yml` is included. GitHub's web uploader may hide dot-folders; if so, upload using the GitHub web editor or GitHub Desktop.
5. Commit the files to the `main` branch.
6. Open the repository's **Actions** tab.
7. Choose **Build Universal Android APK** and click **Run workflow** (or wait for the first push build to finish).
8. Open the completed workflow run. Under **Artifacts**, download `universal-debug-apk`.
9. Extract the downloaded artifact ZIP. It contains `app-debug.apk`. Transfer it to your Android phone and install it. Android may ask you to allow installation from that source.

## Important notes

- GitHub Actions has free usage allowances; usage limits depend on your account and repository settings.
- This creates a **debug APK for testing / personal installation**, not a signed Play Store release.
- Your app still depends on its Supabase project, database schema, storage policies, and any required environment/API settings. APK packaging does not set up the backend.
- Before public use, review any API keys and configuration. Never put private service-role keys in a mobile app. Only public/anon client keys belong in frontend code, with proper Supabase Row Level Security.
- The project uses Vite. If the build fails, open the failed Actions run and check the first error in the logs; a TypeScript or dependency error may need fixing before APK output is produced.
- To change the Android package ID, edit `appId` in `capacitor.config.ts` before the first build.
