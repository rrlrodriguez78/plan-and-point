/**
 * Convierte coordenadas del contenedor a coordenadas porcentuales de la imagen
 */
export const convertContainerToImageCoordinates = (
  clientX: number,
  clientY: number,
  containerElement: HTMLElement,
  imageElement: HTMLImageElement
): { x: number; y: number } | null => {
  if (!containerElement || !imageElement) return null;

  const containerRect = containerElement.getBoundingClientRect();
  const imageRect = imageElement.getBoundingClientRect();

  // Coordenadas relativas a la imagen directamente
  const imageX = clientX - imageRect.left;
  const imageY = clientY - imageRect.top;

  // Verificar si el clic está dentro de la imagen
  if (
    imageX < 0 ||
    imageX > imageRect.width ||
    imageY < 0 ||
    imageY > imageRect.height
  ) {
    return null; // Fuera de la imagen
  }

  // Convertir a porcentajes basados en las dimensiones reales de la imagen
  const percentX = (imageX / imageRect.width) * 100;
  const percentY = (imageY / imageRect.height) * 100;

  return {
    x: Math.max(0, Math.min(100, percentX)),
    y: Math.max(0, Math.min(100, percentY))
  };
};

/**
 * Convierte coordenadas porcentuales de la imagen a posición CSS del contenedor
 */
export const convertImageToContainerPosition = (
  percentX: number,
  percentY: number,
  containerElement: HTMLElement,
  imageElement: HTMLImageElement
): { left: string; top: string } => {
  if (!containerElement || !imageElement) {
    return { left: `${percentX}%`, top: `${percentY}%` };
  }

  const containerRect = containerElement.getBoundingClientRect();
  const imageRect = imageElement.getBoundingClientRect();

  // Calcular posición de la imagen dentro del contenedor
  const imageLeft = imageRect.left - containerRect.left;
  const imageTop = imageRect.top - containerRect.top;

  // Calcular posición del hotspot en píxeles dentro de la imagen
  const hotspotImageX = (percentX / 100) * imageRect.width;
  const hotspotImageY = (percentY / 100) * imageRect.height;

  // Posición absoluta dentro del contenedor
  const hotspotContainerX = imageLeft + hotspotImageX;
  const hotspotContainerY = imageTop + hotspotImageY;

  return {
    left: `${hotspotContainerX}px`,
    top: `${hotspotContainerY}px`
  };
};
