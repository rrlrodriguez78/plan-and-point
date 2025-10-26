/**
 * Parsea archivo list.txt y retorna array de nombres
 */
export const parseListFile = async (file: File): Promise<string[]> => {
  const text = await file.text();
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0); // Eliminar líneas vacías
  
  return lines;
};

/**
 * Valida que los nombres sigan un patrón esperado
 */
export const validateNames = (names: string[]): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  names.forEach((name, index) => {
    // Verificar que no tenga caracteres raros (permitir letras, números, guiones y guiones bajos)
    if (!/^[A-Za-z0-9\-_]+$/.test(name)) {
      errors.push(`Línea ${index + 1}: "${name}" contiene caracteres inválidos`);
    }
    
    // Verificar longitud razonable
    if (name.length > 50) {
      errors.push(`Línea ${index + 1}: Nombre demasiado largo (max 50 caracteres)`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
};
