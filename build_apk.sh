#!/usr/bin/env bash
set -euo pipefail

echo "========================================="
echo "   🌌 Building OtakuVerse Android APK   "
echo "========================================="

cd "$(dirname "$0")"

# Ensure google-services.json template exists
if [ ! -f "app/google-services.json" ]; then
    echo "Creating app/google-services.json from template..."
    cp app/google-services.json.example app/google-services.json
fi

# Ensure local.properties exists
if [ ! -f "local.properties" ]; then
    echo "sdk.dir=/home/nza/Android/Sdk" > local.properties
fi

chmod +x ./gradlew

echo "Starting Gradle build..."
./gradlew assembleGoogleAlpha --no-daemon

echo ""
echo "========================================="
echo "   ✅ Build Selesai! File APK OtakuVerse:"
echo "========================================="
find app/build/outputs/apk/ -name "*.apk" -type f
