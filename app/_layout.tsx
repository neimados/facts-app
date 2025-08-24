// app/_layout.tsx - Root layout for FactSwipe
import * as React from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" hidden />
      <Stack
        screenOptions={{
          headerShown: false,
          orientation: 'portrait',
          gestureEnabled: false, // We handle gestures manually
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{
            title: 'FactSwipe',
          }} 
        />
      </Stack>
    </GestureHandlerRootView>
  );
}