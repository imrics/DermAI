import React from 'react';
import { withLayoutContext } from 'expo-router';
import { Platform } from 'react-native';
import {
  createNativeBottomTabNavigator,
  NativeBottomTabNavigationOptions,
  NativeBottomTabNavigationEventMap,
} from '@bottom-tabs/react-navigation';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';

const BottomTabNavigator = createNativeBottomTabNavigator().Navigator;

const Tabs = withLayoutContext<
  NativeBottomTabNavigationOptions,
  typeof BottomTabNavigator,
  TabNavigationState<ParamListBase>,
  NativeBottomTabNavigationEventMap
>(BottomTabNavigator);

export default function TabsLayout() {
  return (
    <Tabs
      // iOS 26 specific features
      minimizeBehavior={Platform.OS === 'ios' ? 'automatic' : undefined}
      translucent={Platform.OS === 'ios'}
      screenOptions={{
        // Native tab styling 
        tabBarActiveTintColor: '#007AFF',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          // Native tabs use SF Symbols on iOS
          tabBarIcon: ({ focused }) => ({
            sfSymbol: focused ? 'house.fill' : 'house',
          }),
        }}
      />
      <Tabs.Screen
        name="medications"
        options={{
          title: 'Medications',
          tabBarIcon: ({ focused }) => ({
            sfSymbol: focused ? 'cross.case.fill' : 'cross.case',
          }),
        }}
      />
      <Tabs.Screen
        name="export"
        options={{
          title: 'Export',  
          tabBarIcon: ({ focused }) => ({
            sfSymbol: focused ? 'square.and.arrow.up.fill' : 'square.and.arrow.up',
          }),
        }}
      />
    </Tabs>
  );
}
