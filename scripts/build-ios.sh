#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> npm ci"
npm ci

echo "==> Capacitor iOS"
if [ ! -d ios/App ]; then
  npx cap add ios
fi
npx cap sync ios

PLIST="ios/App/App/Info.plist"
if [ -f "$PLIST" ]; then
  /usr/libexec/PlistBuddy -c "Print :UIBackgroundModes" "$PLIST" >/dev/null 2>&1 || \
    /usr/libexec/PlistBuddy -c "Add :UIBackgroundModes array" "$PLIST"
  /usr/libexec/PlistBuddy -c "Print :UIBackgroundModes:0" "$PLIST" >/dev/null 2>&1 || \
    /usr/libexec/PlistBuddy -c "Add :UIBackgroundModes:0 string audio" "$PLIST"
fi

echo "==> CocoaPods"
cd ios/App
pod install

mkdir -p "$ROOT/build"
ARCHIVE="$ROOT/build/Nexory.xcarchive"
EXPORT_DIR="$ROOT/build/export"
SCHEME="App"
WORKSPACE="App.xcworkspace"

if [ -z "${IOS_CERTIFICATE_P12_BASE64:-}" ]; then
  echo "ERROR: IOS_CERTIFICATE_P12_BASE64 secret is not set."
  echo "Add signing secrets to GitHub repo (Settings → Secrets) and re-run workflow."
  exit 1
fi

KEYCHAIN="$RUNNER_TEMP/nexory-signing.keychain-db"
KEYCHAIN_PASSWORD="${IOS_KEYCHAIN_PASSWORD:-nexory-ci-keychain}"

echo "==> Import signing certificate"
echo "$IOS_CERTIFICATE_P12_BASE64" | base64 --decode > "$RUNNER_TEMP/cert.p12"
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security import "$RUNNER_TEMP/cert.p12" -k "$KEYCHAIN" -P "${IOS_CERTIFICATE_PASSWORD}" -T /usr/bin/codesign -T /usr/bin/security
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security list-keychains -d user -s "$KEYCHAIN" login.keychain
security default-keychain -s "$KEYCHAIN"

if [ -n "${IOS_PROVISIONING_PROFILE_BASE64:-}" ]; then
  echo "==> Install provisioning profile"
  mkdir -p "$HOME/Library/MobileDevice/Provisioning Profiles"
  echo "$IOS_PROVISIONING_PROFILE_BASE64" | base64 --decode > "$RUNNER_TEMP/profile.mobileprovision"
  PROFILE_UUID=$(/usr/libexec/PlistBuddy -c "Print :UUID" /dev/stdin <<< "$(security cms -D -i "$RUNNER_TEMP/profile.mobileprovision")")
  cp "$RUNNER_TEMP/profile.mobileprovision" "$HOME/Library/MobileDevice/Provisioning Profiles/${PROFILE_UUID}.mobileprovision"
  PROFILE_NAME=$(/usr/libexec/PlistBuddy -c "Print :Name" /dev/stdin <<< "$(security cms -D -i "$RUNNER_TEMP/profile.mobileprovision")")
  TEAM_ID=$(/usr/libexec/PlistBuddy -c "Print :TeamIdentifier:0" /dev/stdin <<< "$(security cms -D -i "$RUNNER_TEMP/profile.mobileprovision")")
else
  echo "ERROR: IOS_PROVISIONING_PROFILE_BASE64 secret is not set."
  exit 1
fi

BUNDLE_ID="${IOS_BUNDLE_ID:-app.nexory.mobile}"
EXPORT_METHOD="${IOS_EXPORT_METHOD:-development}"

cat > "$ROOT/build/ExportOptions.generated.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>${EXPORT_METHOD}</string>
  <key>teamID</key>
  <string>${TEAM_ID}</string>
  <key>compileBitcode</key>
  <false/>
  <key>signingStyle</key>
  <string>manual</string>
  <key>provisioningProfiles</key>
  <dict>
    <key>${BUNDLE_ID}</key>
    <string>${PROFILE_NAME}</string>
  </dict>
</dict>
</plist>
EOF

echo "==> xcodebuild archive (team=${TEAM_ID}, profile=${PROFILE_NAME})"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -archivePath "$ARCHIVE" \
  -destination 'generic/platform=iOS' \
  archive \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGN_STYLE=Manual \
  PROVISIONING_PROFILE_SPECIFIER="$PROFILE_NAME" \
  PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID"

echo "==> export IPA"
rm -rf "$EXPORT_DIR"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportPath "$EXPORT_DIR" \
  -exportOptionsPlist "$ROOT/build/ExportOptions.generated.plist"

IPA_SRC=$(find "$EXPORT_DIR" -maxdepth 1 -name '*.ipa' | head -1)
if [ -z "$IPA_SRC" ]; then
  echo "ERROR: IPA not found in $EXPORT_DIR"
  exit 1
fi

cp "$IPA_SRC" "$ROOT/build/Nexory.ipa"
echo "==> Done: build/Nexory.ipa"
