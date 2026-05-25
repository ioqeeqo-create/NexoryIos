/**
 * Платформа Capacitor: классы на <html> для Android/iOS-оптимизаций.
 */
const Platform = (() => {
  let os = 'web'

  function detect() {
    try {
      if (typeof Capacitor !== 'undefined' && Capacitor.getPlatform) {
        os = Capacitor.getPlatform() || 'web'
      }
    } catch (_) {}
    const root = document.documentElement
    root.classList.remove('platform-web', 'platform-ios', 'platform-android')
    root.classList.add(`platform-${os}`)
    if (os === 'android') root.classList.add('perf-lite')
    if (os === 'ios') root.classList.add('platform-native')
    return os
  }

  function isAndroid() {
    return os === 'android' || document.documentElement.classList.contains('platform-android')
  }

  function isIOS() {
    return os === 'ios' || document.documentElement.classList.contains('platform-ios')
  }

  function isNative() {
    return isAndroid() || isIOS()
  }

  return { detect, isAndroid, isIOS, isNative, get: () => os }
})()
