import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { createUser as apiCreateUser, getUser, User, UserResponse } from '@/lib/api';

const STORAGE_KEY = '@dermai/user';

type StoredUser = {
  id: string;
  name: string;
};

type UserContextValue = {
  user: StoredUser | null;
  isLoading: boolean;
  createUser: (name: string) => Promise<StoredUser>;
  refreshUser: () => Promise<UserResponse | null>;
  signOut: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as StoredUser;
          setUser(parsed);
        }
      } catch (error) {
        console.warn('Failed to load stored user', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const persistUser = useCallback(async (next: StoredUser | null) => {
    if (next) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const createUser = useCallback(async (name: string) => {
    const newUser = await apiCreateUser(name.trim());
    const storedUser = { id: newUser.id, name: newUser.name };
    setUser(storedUser);
    await persistUser(storedUser);
    return storedUser;
  }, [persistUser]);

  const refreshUser = useCallback(async () => {
    if (!user) return null;
    try {
      const data = await getUser(user.id);
      if (data && typeof data === 'object') {
        const next: StoredUser = {
          id: (data.user_id as string) ?? user.id,
          name: (data.name as string) ?? user.name,
        };
        setUser(next);
        await persistUser(next);
        return data;
      }
    } catch (error) {
      console.warn('Failed to refresh user', error);
    }
    return null;
  }, [persistUser, user]);

  const signOut = useCallback(async () => {
    setUser(null);
    await persistUser(null);
  }, [persistUser]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      createUser,
      refreshUser,
      signOut,
    }),
    [createUser, isLoading, refreshUser, signOut, user],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
}
