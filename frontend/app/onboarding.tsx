import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { AppGradient, Radii, spacing, TextColors } from '@/constants/theme';
import { useUser } from '@/hooks/use-user';

export default function OnboardingScreen() {
  const router = useRouter();
  const { createUser, isLoading } = useUser();

  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (!name.trim()) {
      setError('Please enter your full name to continue.');
      return;
    }
    setError(null);
    try {
      setSubmitting(true);
      await createUser(name.trim());
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Failed to create user', err);
      setError('We could not create your profile right now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient colors={AppGradient.light} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.select({ ios: 'padding', android: undefined })}
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>Welcome to DermAI</Text>
              <Text style={styles.title}>Let’s personalize your skin health journey.</Text>
              <Text style={styles.subtitle}>
                Enter your full name so we can create a private profile for your updates and AI
                insights.
              </Text>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="John Appleseed"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                returnKeyType="done"
                editable={!submitting && !isLoading}
              />
              {error && <Text style={styles.error}>{error}</Text>}
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.button, (!name.trim() || submitting || isLoading) && styles.buttonDisabled]}
              onPress={handleContinue}
              disabled={!name.trim() || submitting || isLoading}
            >
              {submitting || isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              DermAI is a demonstration experience. A new profile is created the first time you
              launch the app; no login or password is required.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(4),
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing(4),
  },
  eyebrow: {
    textTransform: 'uppercase',
    fontSize: 12,
    letterSpacing: 2,
    color: '#4F46E5',
    fontWeight: '600',
    marginBottom: spacing(1),
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '800',
    color: TextColors.primary,
    marginBottom: spacing(1.5),
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: TextColors.secondary,
  },
  form: {
    marginBottom: spacing(4),
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: TextColors.secondary,
    marginBottom: spacing(1),
  },
  input: {
    height: 56,
    paddingHorizontal: spacing(2),
    borderRadius: Radii.lg,
    backgroundColor: '#FFFFFF',
    fontSize: 16,
    color: TextColors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  error: {
    marginTop: spacing(1),
    color: '#B91C1C',
    fontSize: 13,
  },
  button: {
    height: 56,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  buttonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  disclaimer: {
    marginTop: spacing(3),
    fontSize: 12,
    lineHeight: 18,
    color: TextColors.secondary,
    textAlign: 'center',
  },
});
