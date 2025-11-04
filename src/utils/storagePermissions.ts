import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface PermissionStatus {
  granted: boolean;
  canRequest: boolean;
  deniedPermanently?: boolean;
}

/**
 * Verifica si los permisos de almacenamiento están concedidos
 */
export async function checkStoragePermission(): Promise<PermissionStatus> {
  if (!Capacitor.isNativePlatform()) {
    return { granted: true, canRequest: false };
  }

  try {
    const permission = await Filesystem.checkPermissions();
    const isDenied = permission.publicStorage === 'denied';
    const isGranted = permission.publicStorage === 'granted';
    const canPrompt = permission.publicStorage === 'prompt' || permission.publicStorage === 'prompt-with-rationale';
    
    return {
      granted: isGranted,
      canRequest: canPrompt,
      deniedPermanently: isDenied && !canPrompt
    };
  } catch (error) {
    console.error('Error checking storage permissions:', error);
    return { granted: false, canRequest: true, deniedPermanently: false };
  }
}

/**
 * Solicita permisos de almacenamiento al usuario
 */
export async function requestStoragePermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }

  try {
    const currentStatus = await checkStoragePermission();
    
    if (currentStatus.granted) {
      return true;
    }

    if (currentStatus.deniedPermanently) {
      console.warn('⚠️ Storage permission permanently denied - user must enable in settings');
      return false;
    }

    if (!currentStatus.canRequest) {
      console.warn('Cannot request storage permission');
      return false;
    }

    const permission = await Filesystem.requestPermissions();
    const granted = permission.publicStorage === 'granted';
    
    if (granted) {
      console.log('✅ Storage permissions granted');
    }
    
    return granted;
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
    const platform = Capacitor.getPlatform();
    const appName = 'VirtualTour360';
    
    if (platform === 'android') {
      alert(`📱 Ve a: Ajustes > Aplicaciones > ${appName} > Permisos > Archivos y medios`);
    } else if (platform === 'ios') {
      alert(`📱 Ve a: Ajustes > ${appName} > Permitir acceso a: Fotos`);
    }
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
