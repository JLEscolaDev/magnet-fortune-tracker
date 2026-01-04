import FortuneApp from '@/components/FortuneApp';
import { TutorialProvider } from '@/contexts/TutorialContext';

const Index = () => {
  // Note: Checkout success handling is now done in SubscriptionContext
  // to prevent race conditions from multiple hook instances
  
  return (
    <TutorialProvider>
      <FortuneApp />
    </TutorialProvider>
  );
};

export default Index;
