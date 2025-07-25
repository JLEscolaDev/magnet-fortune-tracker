import React, { useEffect } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BillingSuccess: React.FC = () => {
  const { refetch } = useSubscription();
  const navigate = useNavigate();

  useEffect(() => {
    // Refresh subscription status when landing on success page
    refetch();
  }, [refetch]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-emerald/10 p-3 rounded-full">
              <CheckCircle className="w-8 h-8 text-emerald" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
          <p className="text-muted-foreground mb-6">
            Welcome to Pro! Your subscription is now active and you have access to all premium features.
          </p>
          
          <Button 
            onClick={() => navigate('/')}
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Continue to App
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default BillingSuccess;