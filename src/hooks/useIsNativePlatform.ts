/**
 * Hook to detect if we're running in a native mobile app (Capacitor)
 * vs web browser environment.
 * 
 * Uses NativeUploaderAvailable as the primary indicator since it's set
 * by the native bridge when running in Capacitor.
 */
export const useIsNativePlatform = (): boolean => {
  // Check if the native uploader bridge is available
  // This is set by the native app when running in Capacitor
  if (typeof window !== 'undefined' && window.NativeUploaderAvailable === true) {
    return true;
  }
  
  // Additional fallback checks for native environment
  // Check for Capacitor global object
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
    return true;
  }
  
  return false;
};

/**
 * Simple function version for use outside of React components
 */
export const isNativePlatform = (): boolean => {
  if (typeof window !== 'undefined' && window.NativeUploaderAvailable === true) {
    return true;
  }
  
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
    return true;
  }
  
  return false;
};
