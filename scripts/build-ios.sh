#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_NAME="App"
SCHEME="App"
IOS_DIR="ios/App"
WORKSPACE="${IOS_DIR}/App.xcworkspace"
DERIVED="$ROOT/build/DerivedData"
PRODUCTS="$DERIVED/Build/Products/Release-iphoneos"
IPA_OUT="$ROOT/build/Nexory.ipa"

echo "==> npm ci"
npm ci

echo "==> Capacitor iOS"
if [ -d ios ] && [ ! -d ios/App ]; then
  echo "Removing incomplete ios/ folder"
  rm -rf ios
fi
if [ ! -d ios/App ]; then
  npx cap add ios
fi
npx cap sync ios

echo "==> App icon"
if [ -f "$ROOT/resources/icon.png" ]; then
  npx @capacitor/assets generate --ios --iconBackgroundColor '#000000' --iconBackgroundColorDark '#000000' --splashBackgroundColor '#06080d' || echo "icon generate skipped"
fi

PLIST="${IOS_DIR}/App/Info.plist"
if [ -f "$PLIST" ]; then
  /usr/libexec/PlistBuddy -c "Print :UIBackgroundModes" "$PLIST" >/dev/null 2>&1 || \
    /usr/libexec/PlistBuddy -c "Add :UIBackgroundModes array" "$PLIST"
  /usr/libexec/PlistBuddy -c "Print :UIBackgroundModes:0" "$PLIST" >/dev/null 2>&1 || \
    /usr/libexec/PlistBuddy -c "Add :UIBackgroundModes:0 string audio" "$PLIST"
  /usr/libexec/PlistBuddy -c "Print :NSAppTransportSecurity" "$PLIST" >/dev/null 2>&1 || \
    /usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity dict" "$PLIST"
  /usr/libexec/PlistBuddy -c "Print :NSAppTransportSecurity:NSAllowsArbitraryLoads" "$PLIST" >/dev/null 2>&1 && \
    /usr/libexec/PlistBuddy -c "Set :NSAppTransportSecurity:NSAllowsArbitraryLoads bool true" "$PLIST" || \
    /usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity:NSAllowsArbitraryLoads bool true" "$PLIST"
  if ! /usr/libexec/PlistBuddy -c "Print :CFBundleURLTypes" "$PLIST" >/dev/null 2>&1; then
    /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" "$PLIST"
    /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0 dict" "$PLIST"
    /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLName string app.nexory.mobile" "$PLIST"
    /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" "$PLIST"
    /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string nexory" "$PLIST"
  fi
fi

echo "==> CocoaPods"
cd "$IOS_DIR"
pod install
cd "$ROOT"

mkdir -p "$ROOT/build"

echo "==> xcodebuild (unsigned)"
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath "$DERIVED" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  EXPANDED_CODE_SIGN_IDENTITY="" \
  DEVELOPMENT_TEAM="" \
  PROVISIONING_PROFILE_SPECIFIER="" \
  -quiet

APP_PATH="$PRODUCTS/${APP_NAME}.app"
if [ ! -d "$APP_PATH" ]; then
  echo "ERROR: .app not found at $APP_PATH"
  find "$DERIVED" -name '*.app' -type d || true
  exit 1
fi

echo "==> Pack unsigned IPA"
PACK_DIR="$ROOT/build/ipa-pack"
rm -rf "$PACK_DIR" "$IPA_OUT"
mkdir -p "$PACK_DIR/Payload"
cp -R "$APP_PATH" "$PACK_DIR/Payload/"
(cd "$PACK_DIR" && zip -qr "$IPA_OUT" Payload)

echo "==> Done: $IPA_OUT ($(du -h "$IPA_OUT" | cut -f1))"
