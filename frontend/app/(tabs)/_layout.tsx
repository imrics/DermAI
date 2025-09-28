import React from 'react';
import { Slot } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Ionicons } from '@expo/vector-icons';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Ionicons name="home-outline" size={24} />
        Home
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="medications">
        <Ionicons name="medical-outline" size={24} />
        Medications
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="export">
        <Ionicons name="share-outline" size={24} />
        Export
      </NativeTabs.Trigger>
      <Slot />
    </NativeTabs>
  );
}
