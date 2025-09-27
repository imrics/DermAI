import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { EntryDetail, getEntry, getImageUrl } from '@/lib/api';
import { spacing, TextColors } from '@/constants/theme';

function formatFullDate(timestamp?: string) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function normalizeAnalysis(analysis: EntryDetail['analysis']) {
  if (!analysis) return [];
  return Object.entries(analysis).map(([key, value]) => ({
    key,
    value: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
  }));
}

export default function EntryDetailScreen() {
  const params = useLocalSearchParams<{ entryId?: string; condition?: string }>();
  const navigation = useNavigation();
  const router = useRouter();

  const entryId = params.entryId as string | undefined;
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/(tabs)');
    }
  }, [navigation, router]);

  useEffect(() => {
    if (!entryId) return;
    let active = true;
    const load = async () => {
      try {
        const data = await getEntry(entryId);
        if (!active) return;
        setEntry(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load entry', err);
        if (active) setError('We were unable to load this entry. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [entryId]);

  useEffect(() => {
    if (entry) {
      navigation.setOptions({
        title: formatFullDate(entry.created_at) || 'Entry Detail',
        headerBackTitleVisible: true,
        headerLeft: () => (
          <TouchableOpacity style={styles.headerBack} onPress={handleBack}>
            <Ionicons name="chevron-back" size={18} color={TextColors.primary} />
            <Text style={styles.headerBackText}>Home</Text>
          </TouchableOpacity>
        ),
      });
    }
  }, [entry, handleBack, navigation]);

  const imageUri = useMemo(() => {
    if (!entry) return undefined;
    return (
      getImageUrl(entry.image_id) ||
      (entry.photo_url as string | undefined) ||
      (entry as any).photoUrl
    );
  }, [entry]);

  const analysisPairs = useMemo(() => normalizeAnalysis(entry?.analysis), [entry?.analysis]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Entry not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {imageUri && (
          <Image
            source={{ uri: imageUri }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
          />
        )}

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>Recorded</Text>
          <Text style={styles.sectionTitle}>{formatFullDate(entry.created_at)}</Text>
          {entry.sequence_id && (
            <Text style={styles.sectionSubtitle}>Sequence #{entry.sequence_id}</Text>
          )}
        </View>

        {(entry.summary || entry.ai_summary) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>AI Summary</Text>
            <Text style={styles.cardBody}>{entry.summary ?? entry.ai_summary}</Text>
          </View>
        )}

        {analysisPairs.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Diagnosis & Insights</Text>
            {analysisPairs.map((item) => (
              <View key={item.key} style={styles.analysisRow}>
                <Text style={styles.analysisKey}>{item.key}</Text>
                <Text style={styles.analysisValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        )}

        {entry.medications && entry.medications.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Medications At The Time</Text>
            {entry.medications.map((med) => (
              <View key={med.medication_id} style={styles.medicationRow}>
                <Text style={styles.medicationName}>{med.name}</Text>
                <Text style={styles.medicationDetails}>
                  {[med.dosage, med.frequency].filter(Boolean).join(' • ')}
                </Text>
                {med.notes ? <Text style={styles.medicationNotes}>{med.notes}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {(entry.user_notes || entry.user_concerns) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Notes</Text>
            {entry.user_notes ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteLabel}>Observations</Text>
                <Text style={styles.noteText}>{entry.user_notes}</Text>
              </View>
            ) : null}
            {entry.user_concerns ? (
              <View style={styles.noteBlock}>
                <Text style={styles.noteLabel}>Concerns</Text>
                <Text style={styles.noteText}>{entry.user_concerns}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.metaCard}>
          <Text style={styles.metaText}>Entry ID: {entry.entry_id}</Text>
          <Text style={styles.metaText}>Condition: {entry.entry_type}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    paddingBottom: spacing(6),
  },
  heroImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    maxHeight: 420,
  },
  section: {
    paddingHorizontal: spacing(3),
    paddingTop: spacing(3),
    paddingBottom: spacing(2),
  },
  sectionEyebrow: {
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: TextColors.secondary,
    marginBottom: spacing(0.5),
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: TextColors.primary,
  },
  sectionSubtitle: {
    marginTop: spacing(0.5),
    fontSize: 14,
    color: TextColors.secondary,
  },
  card: {
    marginHorizontal: spacing(3),
    marginBottom: spacing(2.5),
    padding: spacing(2.5),
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TextColors.primary,
    marginBottom: spacing(1.5),
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 22,
    color: TextColors.secondary,
  },
  analysisRow: {
    marginBottom: spacing(1.5),
  },
  analysisKey: {
    fontSize: 13,
    fontWeight: '700',
    color: TextColors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing(0.5),
  },
  analysisValue: {
    fontSize: 15,
    lineHeight: 22,
    color: TextColors.primary,
  },
  medicationRow: {
    marginBottom: spacing(1.5),
  },
  medicationName: {
    fontSize: 16,
    fontWeight: '700',
    color: TextColors.primary,
  },
  medicationDetails: {
    fontSize: 13,
    color: TextColors.secondary,
    marginTop: spacing(0.25),
  },
  medicationNotes: {
    fontSize: 14,
    color: TextColors.secondary,
    marginTop: spacing(0.75),
  },
  noteBlock: {
    marginBottom: spacing(1.5),
  },
  noteLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: TextColors.secondary,
    marginBottom: spacing(0.5),
  },
  noteText: {
    fontSize: 15,
    lineHeight: 22,
    color: TextColors.primary,
  },
  metaCard: {
    marginHorizontal: spacing(3),
    marginTop: spacing(1),
    padding: spacing(2),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.16)',
    backgroundColor: 'rgba(79,70,229,0.05)',
  },
  metaText: {
    fontSize: 12,
    color: '#4F46E5',
    letterSpacing: 0.8,
    marginBottom: spacing(0.5),
  },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -8, // Compensate for default header padding
  },
  headerBackText: {
    marginLeft: spacing(0.5),
    fontSize: 15,
    fontWeight: '600',
    color: TextColors.primary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(4),
  },
  errorText: {
    fontSize: 15,
    color: '#B91C1C',
    textAlign: 'center',
  },
});
