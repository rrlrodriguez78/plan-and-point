import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface PermissionStatus {
  granted: boolean;
  canRequest: boolean;
}

/**
 * Verifica si los permisos de almacenamiento están concedidos
 */
export async function checkStoragePermission(): Promise<PermissionStatus> {
  if (!Capacitor.isNativePlatform()) {
    return { granted: true, canRequest: false }; // Web siempre tiene acceso
  }

  try {
    const permission = await Filesystem.checkPermissions();
    return {
      granted: permission.publicStorage === 'granted',
      canRequest: permission.publicStorage === 'prompt' || permission.publicStorage === 'prompt-with-rationale'
    };
  } catch (error) {
    console.error('Error checking storage permissions:', error);
    return { granted: false, canRequest: true };
  }
}

/**
 * Solicita permisos de almacenamiento al usuario
 */
export async function requestStoragePermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true; // Web no necesita permisos
  }

  try {
    const currentStatus = await checkStoragePermission();
    
    if (currentStatus.granted) {
      return true;
    }

    if (!currentStatus.canRequest) {
      console.warn('Cannot request storage permission - user must enable it in settings');
      return false;
    }

    const permission = await Filesystem.requestPermissions();
    return permission.publicStorage === 'granted';
  } catch (error) {
    console.error('Error requesting storage permissions:', error);
    return false;
  }
}

/**
 * Abre la configuración del sistema para que el usuario conceda permisos manualmente
 */
export async function openAppSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // En plataformas nativas, el usuario debe ir manualmente a ajustes
    alert('Por favor, ve a Ajustes > Aplicaciones > VirtualTour360 > Permisos para conceder acceso al almacenamiento');
  } catch (error) {
    console.error('Error opening app settings:', error);
  }
}

/**
 * Verifica si estamos en una plataforma nativa
 */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Obtiene el directorio apropiado según la plataforma
 */
export function getStorageDirectory(): Directory {
  if (Capacitor.getPlatform() === 'android') {
    return Directory.External; // Almacenamiento externo en Android
  }
  return Directory.Documents; // Documentos en iOS
}

/**
 * Obtiene la ruta base para los tours
 */
export function getBasePath(): string {
  return 'VirtualTour360';
}
