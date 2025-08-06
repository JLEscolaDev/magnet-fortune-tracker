import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SettingsContextType {
  soundEnabled: boolean;
  animationsEnabled: boolean;
  hapticsEnabled: boolean;
  currency: string;
  setSoundEnabled: (enabled: boolean) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setCurrency: (currency: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [soundEnabled, setSoundEnabledState] = useState(() => {
    const saved = localStorage.getItem('settings.sound');
    return saved ? JSON.parse(saved) : true;
  });

  const [animationsEnabled, setAnimationsEnabledState] = useState(() => {
    const saved = localStorage.getItem('settings.animations');
    return saved ? JSON.parse(saved) : true;
  });

  const [hapticsEnabled, setHapticsEnabledState] = useState(() => {
    const saved = localStorage.getItem('settings.haptics');
    return saved ? JSON.parse(saved) : true;
  });

  const [currency, setCurrencyState] = useState(() => {
    const saved = localStorage.getItem('settings.currency');
    return saved || 'USD';
  });

  const setSoundEnabled = (enabled: boolean) => {
    setSoundEnabledState(enabled);
    localStorage.setItem('settings.sound', JSON.stringify(enabled));
  };

  const setAnimationsEnabled = (enabled: boolean) => {
    setAnimationsEnabledState(enabled);
    localStorage.setItem('settings.animations', JSON.stringify(enabled));
  };

  const setHapticsEnabled = (enabled: boolean) => {
    setHapticsEnabledState(enabled);
    localStorage.setItem('settings.haptics', JSON.stringify(enabled));
  };

  const setCurrency = (currency: string) => {
    setCurrencyState(currency);
    localStorage.setItem('settings.currency', currency);
  };

  return (
    <SettingsContext.Provider
      value={{
        soundEnabled,
        animationsEnabled,
        hapticsEnabled,
        currency,
        setSoundEnabled,
        setAnimationsEnabled,
        setHapticsEnabled,
        setCurrency,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};