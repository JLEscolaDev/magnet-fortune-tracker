import React, { createContext, useContext, useCallback } from 'react';

interface LifestyleDataContextType {
  refreshLifestyleData: () => void;
}

const LifestyleDataContext = createContext<LifestyleDataContextType | undefined>(undefined);

export function LifestyleDataProvider({ children }: { children: React.ReactNode }) {
  const refreshCallbacks = new Set<() => void>();

  const addRefreshCallback = useCallback((callback: () => void) => {
    refreshCallbacks.add(callback);
    return () => refreshCallbacks.delete(callback);
  }, []);

  const refreshLifestyleData = useCallback(() => {
    refreshCallbacks.forEach(callback => callback());
  }, []);

  return (
    <LifestyleDataContext.Provider value={{ refreshLifestyleData }}>
      {children}
    </LifestyleDataContext.Provider>
  );
}

export function useLifestyleData() {
  const context = useContext(LifestyleDataContext);
  if (context === undefined) {
    throw new Error('useLifestyleData must be used within a LifestyleDataProvider');
  }
  return context;
}

export function useLifestyleDataRefresh(callback: () => void) {
  const context = useContext(LifestyleDataContext);
  
  React.useEffect(() => {
    if (!context) return;
    
    const refreshCallbacks = (context as any).refreshCallbacks || new Set();
    refreshCallbacks.add(callback);
    
    return () => refreshCallbacks.delete(callback);
  }, [callback, context]);
}