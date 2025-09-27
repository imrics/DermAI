import { Platform } from 'react-native';

const API_BASE_URL = 'https://a12f967e1089.ngrok-free.app';

export type EntryType = 'hairline' | 'acne' | 'mole';
export type MedicationCategory = 'hairline' | 'acne' | 'mole';

export interface User {
  id: string;
  name: string;
}

export interface UserResponse {
  user_id: string;
  name?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface EntrySummary {
  entry_id: string;
  entry_type: EntryType;
  created_at: string;
  sequence_id?: string | null;
  image_id?: string | null;
  photo_url?: string | null;
  summary?: string | null;
  ai_summary?: string | null;
  user_notes?: string | null;
  user_concerns?: string | null;
  [key: string]: unknown;
}

export interface EntryDetail extends EntrySummary {
  analysis?: Record<string, unknown> | null;
  medications?: Medication[];
}

export interface Medication {
  medication_id: string;
  category: MedicationCategory;
  name: string;
  dosage?: string | null;
  frequency?: string | null;
  notes?: string | null;
}

export interface MedicationCreatePayload {
  category: MedicationCategory;
  name: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
}

export interface MedicationUpdatePayload {
  name?: string;
  dosage?: string;
  frequency?: string;
  notes?: string;
}

class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData)) {
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data: unknown = null;

  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status, data);
  }

  return data as T;
}

function normalizeEntrySummary(raw: any): EntrySummary {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid entry summary payload');
  }

  const entry: any = { ...raw };
  entry.entry_id = entry.entry_id ?? entry.id ?? entry.entryId ?? entry.entryID;
  entry.entry_type = entry.entry_type ?? entry.type ?? entry.entryType ?? entry.condition ?? 'hairline';
  entry.created_at = entry.created_at ?? entry.createdAt ?? new Date().toISOString();
  entry.sequence_id = entry.sequence_id ?? entry.sequenceId ?? null;
  entry.image_id = entry.image_id ?? entry.imageId ?? entry.photo_id ?? null;
  entry.photo_url = entry.photo_url ?? entry.photoUrl ?? null;
  entry.summary = entry.summary ?? entry.ai_summary ?? entry.user_notes ?? null;

  if (!entry.entry_id) {
    entry.entry_id = `${entry.entry_type ?? 'entry'}-${Date.now()}`;
  }

  if (!entry.created_at) {
    entry.created_at = new Date().toISOString();
  }

  return entry as EntrySummary;
}

function normalizeEntryDetail(raw: any): EntryDetail {
  if (raw && typeof raw === 'object' && 'entry' in raw) {
    return normalizeEntryDetail((raw as { entry: any }).entry);
  }

  const entry = normalizeEntrySummary(raw ?? {});
  const detail: any = { ...raw, ...entry };
  detail.analysis = detail.analysis ?? detail.details ?? null;
  detail.medications = detail.medications ?? detail.current_medications ?? [];
  return detail as EntryDetail;
}

export async function createUser(name: string): Promise<User> {
  const payload = { name };
  const data = await apiFetch<UserResponse>('/create-user', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const id = (data.user_id as string) ?? (data.id as string);

  if (!id) {
    throw new Error('Invalid create user response.');
  }

  return { id, name: data.name ?? name };
}

export async function getUser(userId: string): Promise<UserResponse> {
  return apiFetch<UserResponse>(`/users/${userId}`);
}

export async function getEntries(userId: string, entryType?: EntryType): Promise<EntrySummary[]> {
  const params = entryType ? `?entry_type=${entryType}` : '';
  const data = await apiFetch<EntrySummary[] | { entries: EntrySummary[] }>(
    `/users/${userId}/entries${params}`,
  );

  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.entries)
      ? (data as any).entries
      : [];

  return list.map((item) => normalizeEntrySummary(item));
}

export async function getEntry(entryId: string): Promise<EntryDetail> {
  const data = await apiFetch<EntryDetail | { entry: EntryDetail }>(`/entries/${entryId}`);
  return normalizeEntryDetail(data);
}

export interface CreateEntryPayload {
  photo: {
    uri: string;
    name?: string;
    type?: string;
  };
  sequence_id?: string | null;
  user_notes?: string | null;
  user_concerns?: string | null;
}

export async function createEntry(
  userId: string,
  entryType: EntryType,
  payload: CreateEntryPayload,
): Promise<EntryDetail> {
  const formData = new FormData();

  const fileName = payload.photo.name ?? payload.photo.uri.split('/').pop() ?? `photo-${Date.now()}.jpg`;
  const fileType = payload.photo.type ?? 'image/jpeg';

  if (Platform.OS === 'web') {
    const response = await fetch(payload.photo.uri);
    const blob = await response.blob();
    formData.append('photo', blob, fileName);
  } else {
    formData.append('photo', {
      uri: payload.photo.uri,
      name: fileName,
      type: fileType,
    } as any);
  }

  if (payload.sequence_id) {
    formData.append('sequence_id', payload.sequence_id);
  }
  if (payload.user_notes) {
    formData.append('user_notes', payload.user_notes);
  }
  if (payload.user_concerns) {
    formData.append('user_concerns', payload.user_concerns);
  }

  const data = await apiFetch<EntryDetail | { entry: EntryDetail }>(`/users/${userId}/${entryType}-entries`, {
    method: 'POST',
    body: formData,
  });

  return normalizeEntryDetail(data);
}

export async function deleteEntry(entryId: string): Promise<void> {
  await apiFetch(`/entries/${entryId}`, {
    method: 'DELETE',
  });
}

export async function getMedications(userId: string, category?: MedicationCategory): Promise<Medication[]> {
  const params = category ? `?category=${category}` : '';
  const data = await apiFetch<Medication[] | { medications: Medication[] }>(
    `/users/${userId}/medications${params}`,
  );

  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === 'object' && 'medications' in data) {
    return (data as { medications: Medication[] }).medications;
  }

  return [];
}

export async function addMedication(userId: string, payload: MedicationCreatePayload): Promise<Medication> {
  return apiFetch<Medication>(`/users/${userId}/medications`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateMedication(
  medicationId: string,
  payload: MedicationUpdatePayload,
): Promise<Medication> {
  return apiFetch<Medication>(`/medications/${medicationId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteMedication(medicationId: string): Promise<void> {
  await apiFetch(`/medications/${medicationId}`, {
    method: 'DELETE',
  });
}

export async function exportPdf(userId: string): Promise<string> {
  const data = await apiFetch(`/users/${userId}/export-pdf`, {
    method: 'GET',
  });

  if (typeof data === 'string') {
    return data;
  }

  if (data && typeof data === 'object' && 'url' in data) {
    return String((data as { url: string }).url);
  }

  if (Platform.OS === 'web' && data) {
    return URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  }

  throw new Error('Unexpected export response format.');
}

export function getImageUrl(imageId?: string | null) {
  if (!imageId) return undefined;
  return `${API_BASE_URL}/images/${imageId}`;
}

export function getEntryTypeSlug(category: 'norwood' | 'skin' | 'moles'): EntryType {
  switch (category) {
    case 'norwood':
      return 'hairline';
    case 'skin':
      return 'acne';
    case 'moles':
      return 'mole';
    default:
      return 'hairline';
  }
}
