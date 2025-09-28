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
// FIX: get the runtime header height (handles large-title iOS navbars)
import { useHeaderHeight } from '@react-navigation/elements';

import { EntryDetail, getEntry, getImageUrl } from '@/lib/api';
import { spacing, TextColors } from '@/constants/theme';

type CompositionCopy = {
  heading: string;
  subtitle: string;
  meaningTitle: string;
  meaningBody: string;
  recommendationTitle?: string;
  recommendationBody?: string | null;
  treatmentTitle: string;
  treatments: string[];
  disclaimer: string;
};

const DEFAULT_COMPOSITION: CompositionCopy = {
  heading: 'Condition',
  subtitle:
    'Norwood 1 — slight recession around the temples. Hairline remains largely intact; monitoring is recommended. Further diagnosis is needed by a medical professional. We recommend seeking a medical opinion.',
  meaningTitle: 'What This Means',
  meaningBody:
    'You are in the early stages of hair loss. Preventative measures taken now can help you permanently stop progression and protect what you have.',
  treatmentTitle: 'Treatment',
  treatments: ['Finasteride 10 mg daily', 'Dutasteride 2.5 mg daily (stronger)', 'Ketoconazole shampoo'],
  disclaimer:
    'This content is for UI demonstration only and is not medical advice. Consult a licensed clinician before starting or changing any treatment.',
};

const ACNE_COMPOSITION: CompositionCopy = {
  heading: 'Acne',
  subtitle:
    'Active inflammation present. Track flare triggers and treatment adherence for best results.',
  meaningTitle: 'What This Means',
  meaningBody:
    'Current breakouts show mixed lesions. Consistent skincare, topical retinoids, and early spot treatment can reduce scarring risk.',
  treatmentTitle: 'Recommended Routine',
  treatments: [
    'Topical retinoid nightly',
    'Benzoyl peroxide 2.5–5% in the morning',
    'Non-comedogenic moisturizer as needed',
  ],
  disclaimer:
    'Informational content only. Consult a licensed clinician for personalized acne treatment.',
};

const MOLE_COMPOSITION: CompositionCopy = {
  heading: 'Mole Check',
  subtitle:
    'Monitor any changes in asymmetry, border, color, or diameter. Photograph again if you notice differences.',
  meaningTitle: 'What This Means',
  meaningBody:
    'Documenting this mole helps track evolution over time. Share consistent photos with your dermatologist for assessment.',
  treatmentTitle: 'Next Steps',
  treatments: [
    'Schedule a skin exam if you notice rapid change',
    'Keep the area protected from sun exposure',
    'Note any itching, bleeding, or textural changes',
  ],
  disclaimer:
    'This is not a diagnosis. Seek medical guidance promptly if the mole changes or feels symptomatic.',
};

const COMPOSITION_COPY: Record<string, CompositionCopy> = {
  default: DEFAULT_COMPOSITION,
  norwood: DEFAULT_COMPOSITION,
  hairline: DEFAULT_COMPOSITION,
  acne: ACNE_COMPOSITION,
  skin: ACNE_COMPOSITION,
  mole: MOLE_COMPOSITION,
  moles: MOLE_COMPOSITION,
};

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

function renderNorwoodSubtitle(subtitle: string) {
  if (!subtitle) return <Text style={styles.cardSubtitle} />;
  const re = /(Norwood\s*\d+)/i;
  const m = re.exec(subtitle);
  if (!m) return <Text style={styles.cardSubtitle}>{subtitle}</Text>;

  const start = m.index ?? 0;
  const ratingText = m[0];
  const end = start + ratingText.length;

  const before = subtitle.slice(0, start);
  const after = subtitle.slice(end);

  return (
    <Text style={styles.cardSubtitle}>
      {before}
      <Text style={styles.norwoodBold}>{ratingText}</Text>
      {after}
    </Text>
  );
}

function formatNorwoodLabel(score?: number | null) {
  if (score == null) return null;
  const value = Number(score);
  if (!Number.isFinite(value)) return null;
  const formatted = Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, '');
  return `Norwood ${formatted}`;
}

function extractFirstSentence(text?: string | null) {
  if (!text) return '';
  const normalized = text.trim();
  if (!normalized) return '';
  const match = normalized.match(/.*?[.!?](?:\s|$)/);
  return match ? match[0].trim() : normalized;
}

export default function EntryDetailScreen() {
  const params = useLocalSearchParams<{ entryId?: string; condition?: string }>();
  const navigation = useNavigation();
  const router = useRouter();

  // FIX: read header height so we can offset hero + content below translucent/large header
  const headerHeight = useHeaderHeight();

  const entryId = params.entryId as string | undefined;
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accentColor = useMemo(() => '#F8F5FE', [entry?.entry_type, params.condition]);
  const pageBackground = accentColor;

  const handleBack = useCallback(() => {
    if ((navigation as any).canGoBack?.()) {
      (navigation as any).goBack();
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
      (navigation as any).setOptions({
        title: formatFullDate(entry.created_at) || 'Entry Detail',
        headerBackTitleVisible: false,
        headerTransparent: true,
        headerLargeTitle: true,
        headerBackground: () => <View style={{ flex: 1, backgroundColor: accentColor }} />,
        headerLeft: () => (
          <TouchableOpacity style={styles.headerBackButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={18} color={TextColors.primary} />
          </TouchableOpacity>
        ),
      });
    }
  }, [accentColor, entry, handleBack, navigation]);

  const imageUri = useMemo(() => {
    if (!entry) return undefined;
    return getImageUrl(entry.image_id) || (entry.photo_url as string | undefined) || (entry as any).photoUrl;
  }, [entry]);

  const analysisPairs = useMemo(() => normalizeAnalysis(entry?.analysis), [entry?.analysis]);

  const composition = useMemo(() => {
    const key = (params.condition ?? entry?.entry_type ?? '').toString().toLowerCase();
    const base = COMPOSITION_COPY[key] ?? COMPOSITION_COPY.default;
    const isNorwood = key === 'norwood' || key === 'hairline';
    const norwoodLabel = isNorwood ? formatNorwoodLabel(entry?.norwood_score ?? null) : null;

    const analysisText =
      entry?.ai_comments?.trim() || entry?.ai_summary?.trim() || '';
    const analysisSnippet = analysisText ? extractFirstSentence(analysisText) : '';

    const recommendationText =
      isNorwood && entry?.recommendations?.trim() ? entry.recommendations.trim() : '';

    const summaryText = entry?.summary?.trim() || '';

    let subtitle = base.subtitle;
    if (isNorwood) {
      if (norwoodLabel && analysisSnippet) {
        subtitle = `${norwoodLabel} — ${analysisSnippet}`;
      } else if (norwoodLabel) {
        subtitle = norwoodLabel;
      } else if (analysisSnippet) {
        subtitle = analysisSnippet;
      } else if (summaryText) {
        subtitle = summaryText;
      }
    } else if (summaryText) {
      subtitle = summaryText.includes('Norwood 1')
        ? `${summaryText} Hairline remains largely intact; document monthly for temple recession, miniaturization, and crown thinning.`
        : summaryText;
    }

    const medicationTreatments = entry?.medications?.length
      ? entry.medications.map((med) => {
          const details = [med.dosage, med.frequency].filter(Boolean).join(' • ');
          const core = [med.name, details].filter(Boolean).join(' • ');
          return med.notes?.trim() ? `${core} — ${med.notes}` : core;
        })
      : [];

    const norwoodTreatments = entry?.treatment?.length
      ? entry.treatment
          .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
          .filter((item) => item.length > 0)
      : [];

    const treatments = norwoodTreatments.length > 0
      ? norwoodTreatments
      : medicationTreatments.length > 0
        ? medicationTreatments
        : base.treatments;

    const meaningBody = analysisText || base.meaningBody;

    return {
      heading: isNorwood && norwoodLabel ? norwoodLabel : base.heading,
      subtitle,
      meaningTitle: isNorwood ? 'AI Analysis' : base.meaningTitle,
      meaningBody,
      recommendationTitle: recommendationText
        ? 'Recommendation'
        : base.recommendationTitle,
      recommendationBody: recommendationText || base.recommendationBody || null,
      treatmentTitle: isNorwood ? 'Suggested Treatments' : base.treatmentTitle,
      treatments: treatments.filter(Boolean),
      disclaimer: base.disclaimer,
    };
  }, [entry, params.condition]);

  const entryDate = formatFullDate(entry?.created_at);

  if (loading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: pageBackground }]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: pageBackground }]}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: pageBackground }]}>
        <Text style={styles.errorText}>Entry not found.</Text>
      </SafeAreaView>
    );
  }

  // FIX: push hero & content down by the header height so the big title never overlaps
  const TOP_OFFSET = headerHeight || 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: pageBackground }]}>
      <ScrollView
        style={{ backgroundColor: pageBackground }}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.content,
        ]}
        scrollIndicatorInsets={{ top: TOP_OFFSET }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.primaryCard}>
          {imageUri ? (
            <View style={styles.heroSection}>
              <View style={[styles.heroClip, { backgroundColor: accentColor }]}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.heroImage}
                  contentFit="cover"
                  transition={200}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.cardContent}>
            {entryDate ? <Text style={styles.entryDate}>{entryDate}</Text> : null}

            <Text style={styles.cardHeading}>{composition.heading}</Text>
            {renderNorwoodSubtitle(composition.subtitle)}

            <View style={styles.divider} />

            <View style={styles.cardSection}>
              <Text style={styles.sectionHeading}>{composition.meaningTitle}</Text>
              <Text style={styles.sectionBody}>{composition.meaningBody}</Text>
            </View>

            {composition.recommendationBody && composition.recommendationBody.trim().length > 0 ? (
              <View style={styles.cardSection}>
                <Text style={styles.sectionHeading}>
                  {composition.recommendationTitle ?? 'Recommendation'}
                </Text>
                <Text style={styles.sectionBody}>{composition.recommendationBody}</Text>
              </View>
            ) : null}

            <View style={styles.cardSection}>
              <Text style={styles.sectionHeading}>{composition.treatmentTitle}</Text>
              {composition.treatments.map((item, index) => (
                <View style={styles.bulletRow} key={`${item}-${index}`}>
                  <Text style={styles.bulletDot}>{'\u2022'}</Text>
                  <Text style={styles.bulletText}>{item}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.disclaimer}>{composition.disclaimer}</Text>
          </View>
        </View>

        {analysisPairs.length > 0 && (
          <View style={styles.secondaryCard}>
            <Text style={styles.secondaryTitle}>Diagnosis & Insights</Text>
            {analysisPairs.map((item) => (
              <View key={item.key} style={styles.secondarySection}>
                <Text style={styles.secondaryLabel}>{item.key}</Text>
                <Text style={styles.secondaryBody}>{item.value}</Text>
              </View>
            ))}
          </View>
        )}

        {(entry.user_notes || entry.user_concerns) && (
          <View style={styles.secondaryCard}>
            <Text style={styles.secondaryTitle}>Your Notes</Text>
            {entry.user_notes ? (
              <View style={styles.secondarySection}>
                <Text style={styles.secondaryLabel}>Observations</Text>
                <Text style={styles.secondaryBody}>{entry.user_notes}</Text>
              </View>
            ) : null}
            {entry.user_concerns ? (
              <View style={styles.secondarySection}>
                <Text style={styles.secondaryLabel}>Concerns</Text>
                <Text style={styles.secondaryBody}>{entry.user_concerns}</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F6' },
  content: {
    paddingHorizontal: spacing(2),
    paddingBottom: spacing(7),
    paddingTop: spacing(3.5), // final paddingTop is overridden in-line
  },

  primaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
    marginBottom: spacing(3.5),
    overflow: 'hidden',
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing(3),
    paddingBottom: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: '#FFFFFF',
  },
  heroClip: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 28,
    overflow: 'hidden',
  },
  heroImage: { width: '100%', height: '100%' },

  cardContent: {
    paddingHorizontal: spacing(3.5),
    paddingTop: spacing(3),
    paddingBottom: spacing(4),
    backgroundColor: '#FFFFFF',
  },

  entryDate: {
    fontSize: 13,
    color: TextColors.secondary,
    textAlign: 'center',
    marginBottom: spacing(1),
  },
  cardHeading: {
    fontSize: 32,
    fontWeight: '800',
    color: TextColors.primary,
    textAlign: 'center',
    marginBottom: spacing(1),
  },
  cardSubtitle: {
    fontSize: 18,
    lineHeight: 26,
    color: TextColors.secondary,
    textAlign: 'center',
  },
  norwoodBold: { fontWeight: '800', color: TextColors.primary },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15, 23, 42, 0.1)',
    marginVertical: spacing(2.5),
  },
  cardSection: { marginBottom: spacing(2) },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: TextColors.primary,
    marginBottom: spacing(1.25),
  },
  sectionBody: { fontSize: 18, lineHeight: 28, color: TextColors.primary },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing(0.75) },
  bulletDot: { fontSize: 18, lineHeight: 22, color: '#4F46E5', marginRight: spacing(1) },
  bulletText: { flex: 1, fontSize: 18, lineHeight: 28, color: TextColors.primary },
  disclaimer: {
    fontSize: 13,
    lineHeight: 20,
    color: TextColors.secondary,
    textAlign: 'center',
    marginTop: spacing(2),
  },

  secondaryCard: {
    marginBottom: spacing(3),
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  secondaryTitle: { fontSize: 19, fontWeight: '700', color: TextColors.primary, marginBottom: spacing(1.5) },
  secondarySection: { marginBottom: spacing(1.5) },
  secondaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: TextColors.secondary,
    marginBottom: spacing(0.5),
  },
  secondaryBody: { fontSize: 16, lineHeight: 24, color: TextColors.primary },
  headerBackButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(4), backgroundColor: '#F3F4F6' },
  errorText: { fontSize: 15, color: '#B91C1C', textAlign: 'center' },
});
