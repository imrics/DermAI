import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useUser } from '@/hooks/use-user';
import { AppGradient } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function Index() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <LinearGradient colors={AppGradient.light} style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      </LinearGradient>
    );
  }

  if (!user) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
