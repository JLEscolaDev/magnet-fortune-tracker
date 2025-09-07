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
  Trophy,
  Star,
  Target,
  Sparkle
} from '@phosphor-icons/react';
import { BarChart, TrendingUp, Medal, User } from 'lucide-react';

interface TutorialContent {
  title: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  preview: React.ReactNode;
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
    icon: <House size={24} />,
    preview: (
      <div className="bg-gradient-to-br from-emerald/5 to-emerald/10 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald/20 flex items-center justify-center">
            <Star size={20} className="text-emerald" />
          </div>
          <div className="flex-1">
            <div className="h-3 bg-emerald/20 rounded w-24 mb-1"></div>
            <div className="h-2 bg-muted/50 rounded w-16"></div>
          </div>
        </div>
        <div className="bg-white/50 rounded p-3">
          <div className="h-2 bg-muted/30 rounded w-full mb-2"></div>
          <div className="h-2 bg-muted/30 rounded w-3/4"></div>
        </div>
        <div className="space-y-2">
          <div className="h-2 bg-emerald/10 rounded w-full"></div>
          <div className="h-2 bg-emerald/10 rounded w-5/6"></div>
        </div>
      </div>
    )
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
    icon: <ChartLine size={24} />,
    preview: (
      <div className="bg-gradient-to-br from-blue/5 to-blue/10 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/50 rounded p-2">
            <TrendingUp size={16} className="text-blue mb-1" />
            <div className="h-2 bg-blue/20 rounded w-full"></div>
          </div>
          <div className="bg-white/50 rounded p-2">
            <BarChart size={16} className="text-emerald mb-1" />
            <div className="h-2 bg-emerald/20 rounded w-3/4"></div>
          </div>
        </div>
        <div className="bg-white/50 rounded p-3">
          <div className="flex justify-between items-end h-16">
            <div className="w-3 bg-emerald/30 rounded-t" style={{height: '40%'}}></div>
            <div className="w-3 bg-emerald/30 rounded-t" style={{height: '70%'}}></div>
            <div className="w-3 bg-emerald/30 rounded-t" style={{height: '55%'}}></div>
            <div className="w-3 bg-emerald/30 rounded-t" style={{height: '85%'}}></div>
          </div>
        </div>
      </div>
    )
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
    icon: <Users size={24} />,
    preview: (
      <div className="bg-gradient-to-br from-purple/5 to-purple/10 rounded-lg p-4 space-y-3">
        {/* Mock tab switcher */}
        <div className="flex gap-1 bg-white/50 rounded p-1">
          <div className="flex-1 bg-emerald/20 rounded px-2 py-1 text-center">
            <Users size={12} className="inline text-emerald mb-1" />
            <div className="h-1 bg-emerald/40 rounded"></div>
          </div>
          <div className="flex-1 px-2 py-1 text-center">
            <Trophy size={12} className="inline text-muted-foreground mb-1" />
            <div className="h-1 bg-muted/30 rounded"></div>
          </div>
        </div>
        {/* Mock friends list */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-white/30 rounded p-2">
            <div className="w-6 h-6 rounded-full bg-purple/20"></div>
            <div className="flex-1">
              <div className="h-2 bg-purple/20 rounded w-16 mb-1"></div>
              <div className="h-1 bg-muted/30 rounded w-12"></div>
            </div>
            <Medal size={12} className="text-gold" />
          </div>
          <div className="flex items-center gap-2 bg-white/30 rounded p-2">
            <div className="w-6 h-6 rounded-full bg-purple/20"></div>
            <div className="flex-1">
              <div className="h-2 bg-purple/20 rounded w-16 mb-1"></div>
              <div className="h-1 bg-muted/30 rounded w-12"></div>
            </div>
            <Star size={12} className="text-emerald" />
          </div>
        </div>
      </div>
    )
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
    icon: <Gear size={24} />,
    preview: (
      <div className="bg-gradient-to-br from-slate/5 to-slate/10 rounded-lg p-4 space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between bg-white/50 rounded p-2">
            <div className="flex items-center gap-2">
              <User size={12} className="text-muted-foreground" />
              <div className="h-2 bg-muted/30 rounded w-16"></div>
            </div>
            <div className="w-6 h-3 bg-muted/20 rounded-full"></div>
          </div>
          <div className="flex items-center justify-between bg-white/50 rounded p-2">
            <div className="flex items-center gap-2">
              <Gear size={12} className="text-muted-foreground" />
              <div className="h-2 bg-muted/30 rounded w-20"></div>
            </div>
            <div className="w-6 h-3 bg-emerald/20 rounded-full relative">
              <div className="w-3 h-3 bg-emerald rounded-full absolute right-0"></div>
            </div>
          </div>
          <div className="flex items-center justify-between bg-white/50 rounded p-2">
            <div className="flex items-center gap-2">
              <Sparkle size={12} className="text-gold" />
              <div className="h-2 bg-gold/30 rounded w-14"></div>
            </div>
            <div className="w-6 h-3 bg-gold/20 rounded-full"></div>
          </div>
        </div>
      </div>
    )
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
    icon: <Plus size={24} />,
    preview: (
      <div className="bg-gradient-to-br from-emerald/5 to-emerald/10 rounded-lg p-4 space-y-3">
        <div className="bg-white/50 rounded p-3 space-y-2">
          <div className="h-2 bg-muted/30 rounded w-full"></div>
          <div className="h-2 bg-muted/30 rounded w-4/5"></div>
          <div className="h-2 bg-muted/30 rounded w-3/5"></div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-white/30 rounded p-2">
            <div className="h-1 bg-emerald/20 rounded w-12 mb-1"></div>
            <div className="h-2 bg-emerald/30 rounded w-full"></div>
          </div>
          <div className="flex-1 bg-white/30 rounded p-2">
            <div className="h-1 bg-gold/20 rounded w-10 mb-1"></div>
            <div className="flex gap-1">
              <Star size={8} className="text-gold" />
              <Star size={8} className="text-gold" />
              <Star size={8} className="text-gold" />
              <Star size={8} className="text-muted-foreground" />
              <Star size={8} className="text-muted-foreground" />
            </div>
          </div>
        </div>
        <div className="bg-emerald/20 rounded p-2 text-center">
          <Plus size={16} className="text-emerald" />
        </div>
      </div>
    )
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
    icon: <Calendar size={24} />,
    preview: (
      <div className="bg-gradient-to-br from-blue/5 to-blue/10 rounded-lg p-4 space-y-3">
        <div className="bg-white/50 rounded p-3">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <div key={i} className="h-4 text-center text-xs text-muted-foreground flex items-center justify-center">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({length: 21}, (_, i) => (
              <div key={i} className={`h-6 rounded text-xs flex items-center justify-center ${
                i === 8 ? 'bg-emerald/30 text-emerald' : 
                i === 15 ? 'bg-gold/30 text-gold' : 
                'bg-muted/20 text-muted-foreground'
              }`}>
                {i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
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
    icon: <BarChart size={24} />,
    preview: (
      <div className="bg-gradient-to-br from-indigo/5 to-indigo/10 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/50 rounded p-2 text-center">
            <div className="text-lg font-bold text-emerald">127</div>
            <div className="h-1 bg-emerald/20 rounded w-full"></div>
          </div>
          <div className="bg-white/50 rounded p-2 text-center">
            <div className="text-lg font-bold text-gold">85%</div>
            <div className="h-1 bg-gold/20 rounded w-full"></div>
          </div>
          <div className="bg-white/50 rounded p-2 text-center">
            <div className="text-lg font-bold text-purple">12</div>
            <div className="h-1 bg-purple/20 rounded w-full"></div>
          </div>
        </div>
        <div className="bg-white/50 rounded p-3">
          <div className="h-16 flex items-end justify-center">
            <svg viewBox="0 0 100 40" className="w-full h-full">
              <path d="M10,30 Q25,10 40,20 T70,15 T90,10" stroke="hsl(var(--emerald))" strokeWidth="2" fill="none"/>
              <circle cx="40" cy="20" r="2" fill="hsl(var(--emerald))"/>
              <circle cx="70" cy="15" r="2" fill="hsl(var(--emerald))"/>
            </svg>
          </div>
        </div>
      </div>
    )
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
    icon: <Trophy size={24} />,
    preview: (
      <div className="bg-gradient-to-br from-gold/5 to-gold/10 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/50 rounded p-2 text-center">
            <Trophy size={16} className="text-gold mx-auto mb-1" />
            <div className="h-1 bg-gold/30 rounded w-full mb-1"></div>
            <div className="h-1 bg-muted/20 rounded w-3/4 mx-auto"></div>
          </div>
          <div className="bg-white/30 rounded p-2 text-center opacity-60">
            <Target size={16} className="text-muted-foreground mx-auto mb-1" />
            <div className="h-1 bg-muted/20 rounded w-full mb-1"></div>
            <div className="h-1 bg-muted/20 rounded w-3/4 mx-auto"></div>
          </div>
        </div>
        <div className="bg-gold/10 rounded p-2 flex items-center gap-2">
          <Medal size={16} className="text-gold" />
          <div className="flex-1">
            <div className="h-2 bg-gold/30 rounded w-20 mb-1"></div>
            <div className="h-1 bg-muted/20 rounded w-16"></div>
          </div>
          <div className="text-xs bg-emerald/20 text-emerald px-2 py-1 rounded">NEW</div>
        </div>
      </div>
    )
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
      <DialogContent className="max-w-lg">{/* Made wider for visual preview */}
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
          {/* Visual Preview */}
          <div className="mb-4">
            <h4 className="font-medium text-sm mb-3 text-emerald">Visual Preview</h4>
            {content.preview}
          </div>

          {/* Features List */}
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