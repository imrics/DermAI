import React from 'react';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { TextColors } from '@/constants/theme';

export default function EntriesLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: 'card',
        headerShown: true,
        headerShadowVisible: false,
        headerLargeTitle: Platform.OS === 'ios',
        headerStyle: { backgroundColor: '#F8F5FF' },
        headerTintColor: TextColors.primary,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#F8F5FF' },
      }}
    />
  );
}
