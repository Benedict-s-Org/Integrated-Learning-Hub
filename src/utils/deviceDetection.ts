/**
 * Handwriting Assessment — Device Detection Utility
 * 
 * Provides logic to identify if the current user is on an iPhone (Grip Station) 
 * or an iPad (Writing Station) based on UserAgent and touch characteristics.
 */

/**
 * Detects if the current device is an iPad.
 * Modern iPads often report as "Macintosh" for desktop compatibility, 
 * so we verify using touch point support.
 */
export function isIPad(): boolean {
  const ua = window.navigator.userAgent;
  const isIPadUA = /iPad/i.test(ua);
  const isMacintoshWithTouch = /Macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1;
  return isIPadUA || isMacintoshWithTouch;
}

/**
 * Detects if the current device is an iPhone.
 */
export function isIPhone(): boolean {
  return /iPhone/i.test(window.navigator.userAgent);
}

/**
 * Detects if the current device is a mobile or tablet device.
 */
export function isMobileDevice(): boolean {
  if (isIPad() || isIPhone()) return true;
  
  const mobileRegex = /Android|webOS|BlackBerry|IEMobile|Opera Mini/i;
  return mobileRegex.test(window.navigator.userAgent);
}

/**
 * Returns the handwriting assessment station recommended for this device.
 */
export function getRecommendedStation(): "grip" | "writing" | "report" | "home" {
  if (isIPhone()) return "grip";
  if (isIPad()) return "writing";
  return "home";
}

/**
 * Returns a bilingual label identifying the current device station role.
 */
export function getDeviceLabel(): { english: string; chinese: string } {
  if (isIPhone()) {
    return { english: "iPhone (Grip Station)", chinese: "iPhone（握筆站）" };
  }
  if (isIPad()) {
    return { english: "iPad (Writing Station)", chinese: "iPad（書寫站）" };
  }
  return { english: "Desktop / Other", chinese: "桌面裝置／其他" };
}
