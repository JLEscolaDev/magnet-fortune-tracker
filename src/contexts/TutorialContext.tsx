import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  markStepCompleted: (step: TutorialStep) => void; // legacy alias
  completeStep: (step: TutorialStep) => void;      // preferred API
  isStepCompleted: (step: TutorialStep) => boolean;
  hasUnseenFeatures: boolean;
  getAllSteps: () => TutorialStep[];
  showTutorial: (step: TutorialStep) => void;
  activeTutorial: TutorialStep | null;
  closeTutorial: () => void;
  hasCompletedAllTutorials: boolean;
  isLoading: boolean;
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
  const [isLoading, setIsLoading] = useState(true);

  // Load completed steps from localStorage on mount
  useEffect(() => {
    const loadProgress = async () => {
      try {
        // Load from localStorage first
        const saved = localStorage.getItem(TUTORIAL_STORAGE_KEY);
        if (saved) {
          const parsedSteps = JSON.parse(saved);
          setCompletedSteps(new Set(parsedSteps));
        }

        // Then load from Supabase and merge
        const { data: { user } } = await supabase.auth.getUser();
        const remote = (user?.user_metadata?.tutorials_seen ?? {}) as Record<string, boolean>;
        if (remote && Object.keys(remote).length) {
          setCompletedSteps(prev => {
            const next = new Set(prev);
            for (const [k, v] of Object.entries(remote)) {
              if (v) next.add(k as TutorialStep);
            }
            return next;
          });
        }
      } catch (error) {
        console.error('Failed to load tutorial progress:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProgress();
  }, []);


  // Save to localStorage whenever completedSteps changes
  useEffect(() => {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(Array.from(completedSteps)));
    } catch (error) {
      console.error('Failed to save tutorial progress:', error);
    }
  }, [completedSteps]);

  const completeStep = (step: TutorialStep) => {
    setCompletedSteps(prev => {
      if (prev.has(step)) return prev;
      const next = new Set(prev);
      next.add(step);

      // Fire-and-forget remote sync to Supabase user metadata
      (async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const current = (user.user_metadata?.tutorials_seen ?? {}) as Record<string, boolean>;
            await supabase.auth.updateUser({
              data: { tutorials_seen: { ...current, [step]: true } },
            });
          }
        } catch (e) {
          console.warn('Tutorial progress remote sync failed:', e);
        }
      })();

      return next;
    });
  };

  const markStepCompleted = (step: TutorialStep) => {
    completeStep(step);
  };

  const isStepCompleted = (step: TutorialStep) => {
    return completedSteps.has(step);
  };

  const hasUnseenFeatures = ALL_TUTORIAL_STEPS.some(step => !completedSteps.has(step));
  const hasCompletedAllTutorials = completedSteps.size === ALL_TUTORIAL_STEPS.length;

  const getAllSteps = () => ALL_TUTORIAL_STEPS;

  const showTutorial = (step: TutorialStep) => {
    setActiveTutorial(prev => {
      if (prev) return prev; // do not override an active tutorial
      if (completedSteps.has(step)) return prev; // do not show if already completed
      return step;
    });
  };

  const closeTutorial = () => {
    setActiveTutorial(null);
  };

  const value: TutorialContextType = {
    completedSteps,
    markStepCompleted,
    completeStep,
    isStepCompleted,
    hasUnseenFeatures,
    getAllSteps,
    showTutorial,
    activeTutorial,
    closeTutorial,
    hasCompletedAllTutorials,
    isLoading,
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