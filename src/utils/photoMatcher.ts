export interface Match {
  name: string;
  photo: File | null;
  photoPreview: string;
  status: 'matched' | 'missing';
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
    if (photo) {
      // Crear URL de preview
      photoPreview = URL.createObjectURL(photo);
    }
    
    matches.push({
      name,
      photo: photo || null,
      photoPreview,
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
