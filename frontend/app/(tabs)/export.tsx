import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';

import { exportPdf } from '@/lib/api';
import { useUser } from '@/hooks/use-user';
import { AppGradient, Radii, spacing, TextColors } from '@/constants/theme';

export default function ExportScreen() {
  const { user } = useUser();
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState<{ message: string; tone: 'info' | 'error' } | null>(null);

  const handleExport = useCallback(async () => {
    if (!user) return;
    try {
      setExporting(true);
      setStatus(null);
      const url = await exportPdf(user.id);
      setStatus({ message: 'Report generated. Opening in your browser…', tone: 'info' });
      if (url) {
        await WebBrowser.openBrowserAsync(url);
      }
    } catch (error) {
      console.error('Failed to export report', error);
      setStatus({ message: 'We could not export your report. Please try again.', tone: 'error' });
    } finally {
      setExporting(false);
    }
  }, [user]);

  return (
    <LinearGradient colors={AppGradient.light} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Export Your Dermatology Report</Text>
          <Text style={styles.subtitle}>
            Create a PDF summary with your latest photos, AI assessments, and medication history to
            share with your dermatologist.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>What’s included</Text>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletMark}>•</Text>
              <Text style={styles.bulletText}>Chronological entries for Acne, Norwood, and Moles</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletMark}>•</Text>
              <Text style={styles.bulletText}>AI summaries, diagnoses, and recommended next steps</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletMark}>•</Text>
              <Text style={styles.bulletText}>Active medications by condition with dosage details</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletMark}>•</Text>
              <Text style={styles.bulletText}>High-resolution images for clinician review</Text>
            </View>
          </View>

          <View style={styles.ctaCard}>
            <Text style={styles.ctaTitle}>Ready to share your progress?</Text>
            <Text style={styles.ctaCopy}>
              DermAI assembles a polished PDF you can email, print, or bring to your next
              appointment.
            </Text>
            <TouchableOpacity
              style={[styles.primaryButton, exporting && styles.primaryButtonDisabled]}
              onPress={handleExport}
              disabled={exporting}
            >
              {exporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Generate report</Text>}
            </TouchableOpacity>
            {status && (
              <Text style={[styles.status, status.tone === 'error' && styles.statusError]}>
                {status.message}
              </Text>
            )}
          </View>

          <View style={styles.infoBlock}>
            <Text style={styles.infoTitle}>Privacy first</Text>
            <Text style={styles.infoCopy}>
              Your data is stored securely and only used to generate this report. No information is
              shared without your explicit action.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(4),
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: TextColors.primary,
    marginBottom: spacing(1.5),
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: TextColors.secondary,
    marginBottom: spacing(3),
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.xl,
    padding: spacing(3),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    marginBottom: spacing(3),
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TextColors.primary,
    marginBottom: spacing(2),
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing(1),
  },
  bulletMark: {
    fontSize: 18,
    color: '#4F46E5',
    marginRight: spacing(1),
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: TextColors.secondary,
    lineHeight: 22,
  },
  ctaCard: {
    backgroundColor: '#1D4ED8',
    borderRadius: Radii.xl,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing(1),
  },
  ctaCopy: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginBottom: spacing(2),
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    paddingVertical: spacing(1.5),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(1.5),
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#1D4ED8',
    fontSize: 16,
    fontWeight: '700',
  },
  status: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  statusError: {
    color: '#FEE2E2',
  },
  infoBlock: {
    padding: spacing(3),
    borderRadius: Radii.xl,
    backgroundColor: '#F1F5F9',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TextColors.primary,
    marginBottom: spacing(1),
  },
  infoCopy: {
    fontSize: 14,
    color: TextColors.secondary,
    lineHeight: 20,
  },
});
