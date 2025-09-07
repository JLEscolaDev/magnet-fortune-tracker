import FortuneApp from '@/components/FortuneApp';
import { TutorialProvider } from '@/contexts/TutorialContext';

const Index = () => {
  return (
    <TutorialProvider>
      <FortuneApp />
    </TutorialProvider>
  );
};

export default Index;
