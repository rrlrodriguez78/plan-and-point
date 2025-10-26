export interface MatchedPhoto {
  file: File;
  preview: string;
  captureDate: string | null;
  groupName: string;
}

export interface PhotoGroup {
  id: string;
  name: string;
  photos: File[];
  manualDate: Date | null;
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
  photoGroups?: PhotoGroup[]
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

          if (
            (fileName.startsWith(searchName + '-') ||
              fileName.startsWith(searchName + '.')) &&
            (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg'))
          ) {
            let captureDate = extractDateFromFilename(photo.name);

            if (!captureDate && group.manualDate) {
              captureDate = group.manualDate.toISOString().split('T')[0];
            }

            matchingPhotos.push({
              file: photo,
              preview: URL.createObjectURL(photo),
              captureDate,
              groupName: group.name,
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

        if (
          (fileName.startsWith(searchName + '-') ||
            fileName.startsWith(searchName + '.')) &&
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
