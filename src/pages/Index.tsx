import FortuneApp from '@/components/FortuneApp';
import { TutorialProvider } from '@/contexts/TutorialContext';
import { useCheckoutSuccess } from '@/hooks/useCheckoutSuccess';

const Index = () => {
  useCheckoutSuccess();
  
  return (
    <TutorialProvider>
      <FortuneApp />
    </TutorialProvider>
  );
};

export default Index;
