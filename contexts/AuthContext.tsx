import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../convex/_generated/api';
import { Profile } from '../types';

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 🎉 Convex: Automatically fetches current user profile
  const convexProfile = useQuery(api.profiles.current);
  const { signOut: convexSignOut } = useAuthActions();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Convert Convex profile to our Profile type
  useEffect(() => {
    if (convexProfile === undefined) {
      // Still loading
      setLoading(true);
      return;
    }

    if (convexProfile === null) {
      // Not authenticated
      setProfile(null);
      setLoading(false);
      return;
    }

    // Authenticated with profile
    setProfile({
      id: convexProfile.userId,
      email: convexProfile.email,
      fullName: convexProfile.fullName || 'Traveler',
      role: convexProfile.role as 'customer' | 'vendor' | 'admin',
    });
    setLoading(false);
  }, [convexProfile]);

  const handleSignOut = async () => {
    setProfile(null);
    await convexSignOut();
  };

  const refreshProfile = async () => {
    // Convex automatically refreshes via reactive queries!
    // No need to manually refetch
  };

  // Create user object for backwards compatibility
  const user = profile ? { id: profile.id, email: profile.email } : null;

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut: handleSignOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
