/**
 * Hook to detect if we're running in a native mobile app (Capacitor)
 * vs web browser environment.
 * 
 * IMPORTANT: This checks for REAL native platform, not mock uploaders.
 * The mock uploader in development still runs in web context.
 */
export const useIsNativePlatform = (): boolean => {
  // Check for Capacitor native platform - this is the authoritative check
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
    return true;
  }
  
  // Check for native uploader that was injected by actual native app
  // (not the mock uploader which runs in web)
  if (typeof window !== 'undefined' && 
      window.NativeUploaderAvailable === true && 
      (window as any).__NATIVE_BRIDGE_INJECTED__ === true) {
    return true;
  }
  
  return false;
};

/**
 * Simple function version for use outside of React components
 */
export const isNativePlatform = (): boolean => {
  if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
    return true;
  }
  
  if (typeof window !== 'undefined' && 
      window.NativeUploaderAvailable === true && 
      (window as any).__NATIVE_BRIDGE_INJECTED__ === true) {
    return true;
  }
  
  return false;
};
