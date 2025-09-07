import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTutorial, TutorialStep } from '@/contexts/TutorialContext';
import { 
  House, 
  ChartLine, 
  Users, 
  Gear, 
  Plus, 
  Calendar, 
  Trophy 
} from '@phosphor-icons/react';
import { BarChart } from 'lucide-react';

interface TutorialContent {
  title: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
}

const TUTORIAL_CONTENT: Record<TutorialStep, TutorialContent> = {
  home: {
    title: "Welcome to Home",
    description: "Your main dashboard where you can see your daily quote and recent fortunes.",
    features: [
      "View your daily inspiring quote",
      "See your avatar and current level",
      "Browse your recent fortune entries",
      "Track your fortune count progress"
    ],
    icon: <House size={24} />
  },
  insights: {
    title: "Discover Insights",
    description: "Analyze your fortune patterns and track your progress over time.",
    features: [
      "View detailed statistics and charts",
      "Analyze fortune patterns by category",
      "Track your progress over time",
      "See trends in your fortune creation"
    ],
    icon: <ChartLine size={24} />
  },
  friends: {
    title: "Connect with Friends",
    description: "Share your fortune journey with others and compare achievements.",
    features: [
      "View friends' achievements",
      "Compare fortune statistics",
      "Share your progress",
      "Join fortune challenges together"
    ],
    icon: <Users size={24} />
  },
  settings: {
    title: "Customize Your Experience",
    description: "Personalize your app settings and manage your account.",
    features: [
      "Update your profile information",
      "Customize app preferences",
      "Manage notification settings",
      "Access premium features"
    ],
    icon: <Gear size={24} />
  },
  'create-fortune': {
    title: "Create Your Fortunes",
    description: "Record your daily fortunes and track what brings you luck.",
    features: [
      "Add new fortune entries",
      "Categorize your fortunes",
      "Set impact levels",
      "Choose custom dates for entries"
    ],
    icon: <Plus size={24} />
  },
  calendar: {
    title: "Fortune Calendar",
    description: "View your fortunes on a calendar and track daily patterns.",
    features: [
      "See fortunes on specific dates",
      "Navigate through months",
      "Identify fortune patterns",
      "Track your most active days"
    ],
    icon: <Calendar size={24} />
  },
  statistics: {
    title: "Statistics & Analytics",
    description: "Dive deep into your fortune data with detailed analytics.",
    features: [
      "View comprehensive charts",
      "Analyze category breakdowns",
      "Track growth over time",
      "Export your data"
    ],
    icon: <BarChart size={24} />
  },
  achievements: {
    title: "Unlock Achievements",
    description: "Earn badges and rewards for your fortune tracking journey.",
    features: [
      "View all available achievements",
      "Track your progress",
      "Unlock special rewards",
      "Share your accomplishments"
    ],
    icon: <Trophy size={24} />
  }
};

export const TutorialModal = () => {
  const { activeTutorial, closeTutorial, markStepCompleted } = useTutorial();

  if (!activeTutorial) return null;

  const content = TUTORIAL_CONTENT[activeTutorial];

  const handleComplete = () => {
    markStepCompleted(activeTutorial);
    closeTutorial();
  };

  return (
    <Dialog open={!!activeTutorial} onOpenChange={() => closeTutorial()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald/10 text-emerald">
              {content.icon}
            </div>
            <Badge variant="secondary" className="text-xs">
              Tutorial
            </Badge>
          </div>
          <DialogTitle className="text-left">{content.title}</DialogTitle>
          <DialogDescription className="text-left">
            {content.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm mb-2">What you can do here:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {content.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-emerald mt-1">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={closeTutorial} className="flex-1">
              Skip
            </Button>
            <Button onClick={handleComplete} className="flex-1">
              Got it!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};