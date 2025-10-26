export interface Match {
  name: string;
  photo: File | null;
  photoPreview: string;
  captureDate: string | null;
  status: 'matched' | 'missing';
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
  photos: File[]
): Promise<Match[]> => {
  const matches: Match[] = [];
  
  for (const name of names) {
    // Buscar foto que empiece exactamente con el nombre
    // y termine con .JPG (case insensitive)
    const photo = photos.find(p => {
      const fileName = p.name.toLowerCase();
      const searchName = name.toLowerCase();
      
      // Verificar que empiece con el nombre exacto y tenga un delimitador después (-, ., o extensión)
      return (fileName.startsWith(searchName + '-') || 
              fileName.startsWith(searchName + '.')) && 
             (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg'));
    });
    
    let photoPreview = '';
    let captureDate: string | null = null;
    
    if (photo) {
      // Crear URL de preview
      photoPreview = URL.createObjectURL(photo);
      // Extraer fecha del nombre
      captureDate = extractDateFromFilename(photo.name);
    }
    
    matches.push({
      name,
      photo: photo || null,
      photoPreview,
      captureDate,
      status: photo ? 'matched' : 'missing'
    });
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
  });
};
