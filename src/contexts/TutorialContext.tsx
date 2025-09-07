import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';

export type TutorialStep = 
  | 'home' 
  | 'insights' 
  | 'friends' 
  | 'settings' 
  | 'create-fortune' 
  | 'calendar' 
  | 'statistics' 
  | 'achievements';

interface TutorialContextType {
  completedSteps: Set<TutorialStep>;
  markStepCompleted: (step: TutorialStep) => void;
  isStepCompleted: (step: TutorialStep) => boolean;
  hasUnseenFeatures: boolean;
  getAllSteps: () => TutorialStep[];
  showTutorial: (step: TutorialStep) => void;
  activeTutorial: TutorialStep | null;
  closeTutorial: () => void;
}

export const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

const TUTORIAL_STORAGE_KEY = 'fortune-magnet-tutorial-progress';

const ALL_TUTORIAL_STEPS: TutorialStep[] = [
  'home',
  'insights', 
  'friends',
  'settings',
  'create-fortune',
  'calendar',
  'statistics',
  'achievements'
];

interface TutorialProviderProps {
  children: ReactNode;
}

export const TutorialProvider: React.FC<TutorialProviderProps> = ({ children }) => {
  const [completedSteps, setCompletedSteps] = useState<Set<TutorialStep>>(new Set());
  const [activeTutorial, setActiveTutorial] = useState<TutorialStep | null>(null);

  // Load completed steps from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(TUTORIAL_STORAGE_KEY);
      if (saved) {
        const parsedSteps = JSON.parse(saved);
        setCompletedSteps(new Set(parsedSteps));
      }
    } catch (error) {
      console.error('Failed to load tutorial progress:', error);
    }
  }, []);

  // Save to localStorage whenever completedSteps changes
  useEffect(() => {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify([...completedSteps]));
    } catch (error) {
      console.error('Failed to save tutorial progress:', error);
    }
  }, [completedSteps]);

  const markStepCompleted = (step: TutorialStep) => {
    setCompletedSteps(prev => new Set([...prev, step]));
  };

  const isStepCompleted = (step: TutorialStep) => {
    return completedSteps.has(step);
  };

  const hasUnseenFeatures = ALL_TUTORIAL_STEPS.some(step => !completedSteps.has(step));

  const getAllSteps = () => ALL_TUTORIAL_STEPS;

  const showTutorial = (step: TutorialStep) => {
    setActiveTutorial(step);
  };

  const closeTutorial = () => {
    setActiveTutorial(null);
  };

  const value: TutorialContextType = {
    completedSteps,
    markStepCompleted,
    isStepCompleted,
    hasUnseenFeatures,
    getAllSteps,
    showTutorial,
    activeTutorial,
    closeTutorial,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = (): TutorialContextType => {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};