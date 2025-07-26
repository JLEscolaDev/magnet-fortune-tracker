import React, { createContext, useContext, ReactNode } from 'react';
import { Profile, Subscription } from '@/types/fortune';

interface AppStateContextType {
  profile: Profile | null;
  fortunesCountToday: number;
  fortunesCountTotal: number;
  activeSubscription: Subscription | null;
  loading: boolean;
  errors: Array<{ source: string; message: string; timestamp: number }>;
  addError: (source: string, message: string) => void;
  clearErrors: () => void;
  refetch: () => Promise<void>;
}

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

interface AppStateProviderProps {
  children: ReactNode;
  value: AppStateContextType;
}

export const AppStateProvider: React.FC<AppStateProviderProps> = ({ children, value }) => {
  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = (): AppStateContextType => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};