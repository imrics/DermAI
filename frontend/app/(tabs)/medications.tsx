import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  Medication,
  MedicationCategory,
  MedicationCreatePayload,
  addMedication,
  deleteMedication,
  getMedications,
  updateMedication,
} from '@/lib/api';
import { useUser } from '@/hooks/use-user';
import { Radii, spacing, TextColors } from '@/constants/theme';

const CATEGORY_CONFIG: { id: MedicationCategory; label: string; tagline: string }[] = [
  { id: 'hairline', label: 'Norwood', tagline: 'Treatments and supplements for hair loss.' },
  { id: 'acne', label: 'Acne', tagline: 'Topicals, orals, and skincare routines.' },
  { id: 'mole', label: 'Moles', tagline: 'Dermatologist-directed monitoring plans.' },
];

type FormState = {
  name: string;
  dosage: string;
  frequency: string;
  notes: string;
  category: MedicationCategory;
};

const defaultFormState = (category: MedicationCategory): FormState => ({
  name: '',
  dosage: '',
  frequency: '',
  notes: '',
  category,
});

export default function MedicationsScreen() {
  const { user } = useUser();

  const [selectedCategory, setSelectedCategory] = useState<MedicationCategory>('hairline');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [formState, setFormState] = useState<FormState>(() => defaultFormState('hairline'));
  const [submitting, setSubmitting] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);

  const categoryTagline = useMemo(() => {
    return CATEGORY_CONFIG.find((item) => item.id === selectedCategory)?.tagline ?? '';
  }, [selectedCategory]);

  const fetchMedications = useCallback(async (category?: MedicationCategory) => {
    if (!user) return;
    const targetCategory = category ?? selectedCategory;
    try {
      const data = await getMedications(user.id, targetCategory);
      setMedications(data ?? []);
    } catch (error) {
      console.error('Failed to load medications', error);
      Alert.alert('Unable to load', 'Please check your connection and try again.');
    }
  }, [selectedCategory, user]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        if (!active) return;
        setLoading(true);
        await fetchMedications();
        if (active) setLoading(false);
      };
      load();
      return () => {
        active = false;
      };
    }, [fetchMedications]),
  );

  useEffect(() => {
    setFormState((prev) => ({ ...prev, category: selectedCategory }));
  }, [selectedCategory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMedications();
    setRefreshing(false);
  }, [fetchMedications]);

  const openForm = useCallback(
    (medication?: Medication) => {
      if (medication) {
        setEditingMedication(medication);
        setFormState({
          name: medication.name,
          dosage: medication.dosage ?? '',
          frequency: medication.frequency ?? '',
          notes: medication.notes ?? '',
          category: medication.category,
        });
      } else {
        setEditingMedication(null);
        setFormState(defaultFormState(selectedCategory));
      }
      setFormVisible(true);
    },
    [selectedCategory],
  );

  const closeForm = useCallback(() => {
    if (submitting) return;
    setFormVisible(false);
  }, [submitting]);

  const handleSave = useCallback(async () => {
    if (!user) return;
    if (!formState.name.trim()) {
      Alert.alert('Name required', 'Medication name is required.');
      return;
    }

    try {
      setSubmitting(true);
      if (editingMedication) {
        await updateMedication(editingMedication.medication_id, {
          name: formState.name.trim(),
          dosage: formState.dosage.trim() || undefined,
          frequency: formState.frequency.trim() || undefined,
          notes: formState.notes.trim() || undefined,
        });
        await fetchMedications(editingMedication.category);
      } else {
        const payload: MedicationCreatePayload = {
          category: formState.category,
          name: formState.name.trim(),
          dosage: formState.dosage.trim() || undefined,
          frequency: formState.frequency.trim() || undefined,
          notes: formState.notes.trim() || undefined,
        };
        await addMedication(user.id, payload);
        if (formState.category !== selectedCategory) {
          setSelectedCategory(formState.category);
        }
        await fetchMedications(formState.category);
      }
      setFormVisible(false);
    } catch (error) {
      console.error('Failed to save medication', error);
      Alert.alert('Save failed', 'We could not save this medication. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [editingMedication, fetchMedications, formState, selectedCategory, user]);

  const handleDelete = useCallback(
    (medication: Medication) => {
      const performDelete = async () => {
        try {
          await deleteMedication(medication.medication_id);
          await fetchMedications(medication.category);
        } catch (error) {
          console.error('Failed to delete medication', error);
          Alert.alert('Delete failed', 'We could not delete this medication.');
        }
      };

      Alert.alert(
        'Remove medication',
        `Are you sure you want to remove ${medication.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete },
        ],
      );
    },
    [fetchMedications],
  );

  const openMedicationMenu = useCallback(
    (medication: Medication) => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Edit', 'Delete'],
            cancelButtonIndex: 0,
            destructiveButtonIndex: 2,
          },
          (index) => {
            if (index === 1) openForm(medication);
            if (index === 2) handleDelete(medication);
          },
        );
      } else {
        Alert.alert(medication.name, undefined, [
          { text: 'Edit', onPress: () => openForm(medication) },
          { text: 'Delete', style: 'destructive', onPress: () => handleDelete(medication) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    },
    [handleDelete, openForm],
  );

  const renderMedication = useCallback(
    ({ item }: { item: Medication }) => (
      <Pressable style={styles.medRow} onPress={() => openMedicationMenu(item)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.medName}>{item.name}</Text>
          <Text style={styles.medMeta}>
            {[item.dosage, item.frequency].filter(Boolean).join(' • ') || 'Custom schedule'}
          </Text>
          {item.notes ? (
            <Text style={styles.medNotes} numberOfLines={2}>
              {item.notes}
            </Text>
          ) : null}
        </View>
        <Text style={styles.medAction}>⋯</Text>
      </Pressable>
    ),
    [openMedicationMenu],
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>No medications tracked</Text>
      <Text style={styles.emptyCopy}>
        Add treatments, supplements, or prescriptions so DermAI can personalize your insights.
      </Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => openForm()}>
        <Text style={styles.primaryButtonText}>Add medication</Text>
      </TouchableOpacity>
    </View>
  );

  const listHeader = (
    <View style={styles.headerBlock}>
      <Text style={styles.title}>Medications</Text>
      <Text style={styles.subtitle}>{categoryTagline}</Text>

      <View style={styles.segmentedControl}>
        {CATEGORY_CONFIG.map((option) => {
          const active = option.id === selectedCategory;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.segmentButton, active && styles.segmentButtonActive]}
              onPress={() => {
                  setSelectedCategory(option.id);
                  fetchMedications(option.id);
                }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {option.label}
                </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => openForm()}>
        <Text style={styles.primaryButtonText}>Add medication</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <FlatList
        data={medications}
        keyExtractor={(item) => item.medication_id}
        renderItem={renderMedication}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        contentContainerStyle={medications.length === 0 ? styles.emptyContent : styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />

      {loading && medications.length === 0 && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
        </View>
      )}

      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeForm}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeForm} disabled={submitting}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingMedication ? 'Edit medication' : 'New medication'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          {!editingMedication && (
            <View style={styles.modalCategoryGroup}>
              <Text style={styles.modalLabel}>Category</Text>
              <View style={styles.segmentedControlInline}>
                {CATEGORY_CONFIG.map((option) => {
                  const active = option.id === formState.category;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.segmentButtonInline, active && styles.segmentButtonActive]}
                      onPress={() => setFormState((prev) => ({ ...prev, category: option.id }))}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.modalForm}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalLabel}>Medication name</Text>
            <TextInput
              value={formState.name}
              onChangeText={(value) => setFormState((prev) => ({ ...prev, name: value }))}
              placeholder="e.g., Minoxidil 5%"
              style={styles.input}
              autoFocus
              returnKeyType="next"
            />

            <Text style={styles.modalLabel}>Dosage</Text>
            <TextInput
              value={formState.dosage}
              onChangeText={(value) => setFormState((prev) => ({ ...prev, dosage: value }))}
              placeholder="e.g., 2 mL nightly"
              style={styles.input}
              returnKeyType="next"
            />

            <Text style={styles.modalLabel}>Frequency</Text>
            <TextInput
              value={formState.frequency}
              onChangeText={(value) => setFormState((prev) => ({ ...prev, frequency: value }))}
              placeholder="e.g., Twice daily"
              style={styles.input}
              returnKeyType="next"
            />

            <Text style={styles.modalLabel}>Notes</Text>
            <TextInput
              value={formState.notes}
              onChangeText={(value) => setFormState((prev) => ({ ...prev, notes: value }))}
              placeholder="Add context that will appear alongside AI insights."
              style={[styles.input, styles.inputMultiline]}
              multiline
              numberOfLines={4}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F5FF' },
  headerBlock: {
    paddingHorizontal: spacing(2),
    paddingTop: spacing(2),
    paddingBottom: spacing(3),
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: TextColors.primary,
    marginBottom: spacing(1),
  },
  subtitle: {
    fontSize: 15,
    color: TextColors.secondary,
    marginBottom: spacing(3),
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#E0E7FF',
    borderRadius: Radii.lg,
    padding: 4,
    marginBottom: spacing(2),
  },
  segmentedControlInline: {
    flexDirection: 'row',
    backgroundColor: '#E0E7FF',
    borderRadius: Radii.lg,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    borderRadius: Radii.md,
    paddingVertical: spacing(1.25),
    alignItems: 'center',
  },
  segmentButtonInline: {
    flex: 1,
    borderRadius: Radii.md,
    paddingVertical: spacing(1),
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#4F46E5',
    shadowColor: '#4F46E5',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4338CA',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  primaryButton: {
    backgroundColor: '#4F46E5',
    borderRadius: Radii.lg,
    paddingVertical: spacing(1.5),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(2),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: spacing(6),
  },
  emptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(6),
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(2),
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    marginHorizontal: spacing(2),
    marginBottom: spacing(2),
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  medName: {
    fontSize: 17,
    fontWeight: '700',
    color: TextColors.primary,
  },
  medMeta: {
    fontSize: 13,
    color: TextColors.secondary,
    marginTop: spacing(0.5),
  },
  medNotes: {
    fontSize: 13,
    color: TextColors.secondary,
    marginTop: spacing(0.75),
  },
  medAction: {
    fontSize: 24,
    color: '#9CA3AF',
    paddingHorizontal: spacing(1),
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing(3),
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TextColors.primary,
    marginBottom: spacing(1),
  },
  emptyCopy: {
    fontSize: 14,
    color: TextColors.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing(2),
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  modalContainer: { flex: 1, backgroundColor: '#F9FAFB' },
  modalHeader: {
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TextColors.primary,
  },
  modalCancel: {
    fontSize: 16,
    color: TextColors.secondary,
  },
  modalSave: {
    fontSize: 16,
    color: '#4F46E5',
    fontWeight: '700',
  },
  modalForm: {
    paddingHorizontal: spacing(3),
    paddingBottom: spacing(4),
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TextColors.secondary,
    marginTop: spacing(2),
    marginBottom: spacing(0.75),
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radii.lg,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1.25),
    fontSize: 15,
    color: TextColors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  inputMultiline: {
    height: 120,
    textAlignVertical: 'top',
  },
  modalCategoryGroup: {
    paddingHorizontal: spacing(3),
    marginTop: spacing(1),
  },
});
