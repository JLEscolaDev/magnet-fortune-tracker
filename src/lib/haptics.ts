/**
 * Haptic feedback utility using the Vibration API
 * Works on Android Chrome/Firefox, silent fallback on iOS/desktop
 */
export const haptics = {
  /** Short success vibration (100ms) */
  success: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }
  },
  
  /** Light tap vibration (50ms) */
  light: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  },
  
  /** Double-tap pattern */
  pattern: () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50]);
    }
  }
};
