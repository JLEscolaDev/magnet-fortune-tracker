import { useState, useCallback } from 'react';
import { Eye, EyeSlash, Sparkle, User, Envelope, Lock } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FortuneIcon } from '@/components/FortuneIcon';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const AuthPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const { toast } = useToast();

  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameError(username.length > 0 && username.length < 3 ? 'Username must be at least 3 characters long' : '');
      return false;
    }

    setCheckingUsername(true);
    setUsernameError('');

    try {
      const { data, error } = await supabase.rpc('is_username_available', { username });
      
      if (error) {
        console.error('Error checking username:', error);
        setUsernameError('Error checking username availability');
        return false;
      }

      if (!data) {
        setUsernameError('This username is already taken');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Username check failed:', error);
      setUsernameError('Error checking username availability');
      return false;
    } finally {
      setCheckingUsername(false);
    }
  }, []);

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDisplayName(value);
    
    // Clear previous error
    if (usernameError) {
      setUsernameError('');
    }
  };

  const handleDisplayNameBlur = () => {
    if (isSignUp && displayName) {
      checkUsernameAvailability(displayName);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // Check username availability one final time before submitting
        const isUsernameAvailable = await checkUsernameAvailability(displayName);
        if (!isUsernameAvailable) {
          setLoading(false);
          return;
        }

        const redirectUrl = `${window.location.origin}/`;
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              display_name: displayName
            }
          }
        });

        if (error) {
          // Handle specific error for duplicate username
          if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
            setUsernameError('This username is already taken');
            setLoading(false);
            return;
          }
          throw error;
        }

        toast({
          title: "Check your email!",
          description: "We've sent you a confirmation link to complete your registration.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Welcome back!",
          description: "You've successfully signed in to Fortune Magnet.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: error.message || "An error occurred during authentication",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <FortuneIcon />
          </div>
          <h1 className="text-3xl font-heading font-bold gold-accent mb-2">
            Fortune Magnet
          </h1>
          <p className="text-muted-foreground">
            Attract wealth and success into your life
          </p>
        </div>

        <div className="luxury-card p-8">
          <div className="text-center mb-6">
            <h2 className="text-xl font-heading font-semibold mb-2">
              {isSignUp ? 'Start Your Journey' : 'Welcome Back'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isSignUp 
                ? 'Create your account to begin tracking fortunes'
                : 'Sign in to continue your fortune journey'
              }
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                 <div className="relative">
                   <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                   <Input
                     id="displayName"
                     type="text"
                     value={displayName}
                     onChange={handleDisplayNameChange}
                     onBlur={handleDisplayNameBlur}
                     placeholder="Enter your username (min. 3 characters)"
                     className={`pl-10 focus:border-gold focus:ring-gold/20 ${usernameError ? 'border-destructive' : ''}`}
                     required={isSignUp}
                     minLength={3}
                   />
                   {checkingUsername && (
                     <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                       <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                     </div>
                   )}
                 </div>
                 {usernameError && (
                   <p className="text-sm text-destructive mt-1">{usernameError}</p>
                 )}
                 {displayName && !usernameError && !checkingUsername && isSignUp && displayName.length >= 3 && (
                   <p className="text-sm text-green-600 mt-1">✓ Username is available</p>
                 )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Envelope size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="pl-10 focus:border-gold focus:ring-gold/20"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="pl-10 pr-10 focus:border-gold focus:ring-gold/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || (isSignUp && (checkingUsername || !!usernameError || displayName.length < 3))}
              className="luxury-button w-full"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkle size={18} />
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </div>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-muted-foreground hover:text-gold transition-colors"
            >
              {isSignUp 
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};