export interface MatchedPhoto {
  file: File;
  preview: string;
  captureDate: string | null;
  groupName: string;
  optimizedBlob?: Blob;
  originalSize?: number;
  optimizedSize?: number;
}

export interface PhotoGroup {
  id: string;
  name: string;
  photos: File[];
  manualDate: Date | null;
}

export interface OptimizedPhotoGroup extends PhotoGroup {
  optimizedPhotos: Array<{
    file: File;
    blob: Blob;
    originalSize: number;
    optimizedSize: number;
  }>;
  isOptimizing: boolean;
  optimizationProgress: number;
}

export interface Match {
  name: string;
  photos: MatchedPhoto[];
  status: 'matched' | 'missing';
  // Legacy support
  photo?: File | null;
  photoPreview?: string;
  captureDate?: string | null;
}

export interface HotspotPhotoMatch {
  hotspot: { id: string; title: string };
  photos: MatchedPhoto[];
  status: 'matched' | 'no-match';
}

/**
 * Extrae fecha del formato: nombre-MM-DD-YYYY.JPG
 * Ejemplo: "B-0-0-10-21-2025.JPG" → "2025-10-21"
 */
export const extractDateFromFilename = (filename: string): string | null => {
  // Pattern: nombre-MM-DD-YYYY.JPG
  const pattern = /-(\d{2})-(\d{2})-(\d{4})\.(jpg|jpeg)$/i;
  const match = filename.match(pattern);
  
  if (match) {
    const [, month, day, year] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    // Validar fecha válida y razonable
    const now = new Date();
    const minDate = new Date('2000-01-01');
    
    if (!isNaN(date.getTime()) && date <= now && date >= minDate) {
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
  return null;
}

/**
 * Matchea nombres con fotos basándose en prefijo del filename
 * 
 * Ejemplo:
 *   nombre: "B-0-0"
 *   encuentra: "B-0-0-10-21-2025.JPG"
 *   no encuentra: "B-0-1-10-21-2025.JPG"
 */
export const matchPhotosToNames = async (
  names: string[],
  photos: File[],
  photoGroups?: PhotoGroup[] | OptimizedPhotoGroup[]
): Promise<Match[]> => {
  const matches: Match[] = [];

  // Si hay grupos, usar lógica multi-grupo
  if (photoGroups && photoGroups.length > 0) {
    for (const name of names) {
      const matchingPhotos: MatchedPhoto[] = [];

      photoGroups.forEach((group) => {
        group.photos.forEach((photo) => {
          const fileName = photo.name.toLowerCase();
          const searchName = name.toLowerCase();

          // Matching exacto: después del nombre debe haber un '-' o '.' inmediatamente
          const exactPattern = new RegExp(`^${searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[-.]`, 'i');
          
          if (
            exactPattern.test(fileName) &&
            (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg'))
          ) {
            let captureDate = extractDateFromFilename(photo.name);

            if (!captureDate && group.manualDate) {
              captureDate = group.manualDate.toISOString().split('T')[0];
            }

            // Buscar el blob optimizado si existe
            const optimizedGroup = 'optimizedPhotos' in group ? group as OptimizedPhotoGroup : null;
            const optimizedData = optimizedGroup?.optimizedPhotos?.find(opt => opt.file === photo);

            matchingPhotos.push({
              file: photo,
              preview: URL.createObjectURL(photo),
              captureDate,
              groupName: group.name,
              optimizedBlob: optimizedData?.blob,
              originalSize: optimizedData?.originalSize,
              optimizedSize: optimizedData?.optimizedSize,
            });
          }
        });
      });

      const firstPhoto = matchingPhotos[0];
      matches.push({
        name,
        photos: matchingPhotos,
        status: matchingPhotos.length > 0 ? 'matched' : 'missing',
        // Legacy support
        photo: firstPhoto?.file || null,
        photoPreview: firstPhoto?.preview || '',
        captureDate: firstPhoto?.captureDate || null,
      });
    }
  } else {
    // Lógica original para compatibilidad
    for (const name of names) {
      let matchedPhoto: File | null = null;
      let photoPreview = '';
      let captureDate: string | null = null;

      for (const photo of photos) {
        const fileName = photo.name.toLowerCase();
        const searchName = name.toLowerCase();

        // Matching exacto: después del nombre debe haber un '-' o '.' inmediatamente
        const exactPattern = new RegExp(`^${searchName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[-.]`, 'i');

        if (
          exactPattern.test(fileName) &&
          (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg'))
        ) {
          matchedPhoto = photo;
          photoPreview = URL.createObjectURL(photo);
          captureDate = extractDateFromFilename(photo.name);
          break;
        }
      }

      matches.push({
        name,
        photos: matchedPhoto ? [{ file: matchedPhoto, preview: photoPreview, captureDate, groupName: 'Grupo 1' }] : [],
        status: matchedPhoto ? 'matched' : 'missing',
        // Legacy support
        photo: matchedPhoto,
        photoPreview,
        captureDate,
      });
    }
  }

  return matches;
};

/**
 * Matchea fotos con hotspots existentes basándose en prefijo del filename
 */
export const matchPhotosToExistingHotspots = async (
  existingHotspots: Array<{ id: string; title: string }>,
  photoGroups: PhotoGroup[] | OptimizedPhotoGroup[]
): Promise<{
  matches: HotspotPhotoMatch[];
  validPhotos: number;
  ignoredPhotos: number;
}> => {
  const matches: HotspotPhotoMatch[] = [];
  let validPhotos = 0;
  const allPhotos = (photoGroups as PhotoGroup[]).reduce((sum, g) => sum + g.photos.length, 0);

  for (const hotspot of existingHotspots) {
    const matchingPhotos: MatchedPhoto[] = [];

    photoGroups.forEach((group) => {
      group.photos.forEach((photo) => {
        const fileName = photo.name.toLowerCase();
        const hotspotName = hotspot.title.toLowerCase();

        // Matching exacto: después del nombre debe haber un '-' o '.' inmediatamente
        const exactPattern = new RegExp(`^${hotspotName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[-.]`, 'i');

        if (
          exactPattern.test(fileName) &&
          (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg'))
        ) {
          let captureDate = extractDateFromFilename(photo.name);

          if (!captureDate && group.manualDate) {
            captureDate = group.manualDate.toISOString().split('T')[0];
          }

          // Buscar el blob optimizado si existe
          const optimizedGroup = 'optimizedPhotos' in group ? group as OptimizedPhotoGroup : null;
          const optimizedData = optimizedGroup?.optimizedPhotos?.find(opt => opt.file === photo);

          matchingPhotos.push({
            file: photo,
            preview: URL.createObjectURL(photo),
            captureDate,
            groupName: group.name,
            optimizedBlob: optimizedData?.blob,
            originalSize: optimizedData?.originalSize,
            optimizedSize: optimizedData?.optimizedSize,
          });
          
          validPhotos++;
        }
      });
    });

    matches.push({
      hotspot: { id: hotspot.id, title: hotspot.title },
      photos: matchingPhotos,
      status: matchingPhotos.length > 0 ? 'matched' : 'no-match',
    });
  }

  const ignoredPhotos = allPhotos - validPhotos;

  return { matches, validPhotos, ignoredPhotos };
};

/**
 * Liberar URLs de preview cuando ya no se necesiten
 */
export const cleanupPreviews = (matches: Match[]) => {
  matches.forEach(match => {
    if (match.photoPreview) {
      URL.revokeObjectURL(match.photoPreview);
    }
    match.photos.forEach(photo => {
      if (photo.preview) {
        URL.revokeObjectURL(photo.preview);
      }
    });
  });
};
