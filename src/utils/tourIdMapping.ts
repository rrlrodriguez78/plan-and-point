/**
 * Tour ID Mapping Utility
 * Manages mapping between local UUIDs (offline) and remote Supabase IDs (online)
 */

const MAPPING_KEY = 'tour_id_mappings';

export interface TourIdMapping {
  [localId: string]: string; // localId -> remoteId
}

export function getMappings(): TourIdMapping {
  try {
    const stored = localStorage.getItem(MAPPING_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error loading tour ID mappings:', error);
    return {};
  }
}

export function updateMapping(localId: string, remoteId: string): void {
  const mappings = getMappings();
  mappings[localId] = remoteId;
  localStorage.setItem(MAPPING_KEY, JSON.stringify(mappings));
  console.log(`✅ ID mapping saved: ${localId} → ${remoteId}`);
}

export function getRemoteId(localId: string): string | null {
  const mappings = getMappings();
  return mappings[localId] || null;
}

export function getLocalId(remoteId: string): string | null {
  const mappings = getMappings();
  const entry = Object.entries(mappings).find(([_, remote]) => remote === remoteId);
  return entry ? entry[0] : null;
}

export function clearMapping(localId: string): void {
  const mappings = getMappings();
  delete mappings[localId];
  localStorage.setItem(MAPPING_KEY, JSON.stringify(mappings));
}

export function clearAllMappings(): void {
  localStorage.removeItem(MAPPING_KEY);
}
