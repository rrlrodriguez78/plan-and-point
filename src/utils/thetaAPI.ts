/**
 * Cliente API para Ricoh Theta Z1
 * Documentación: https://api.ricoh/docs/theta-web-api-v2.1/
 */

export interface ThetaDeviceInfo {
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  supportUrl: string;
  endpoints: {
    httpPort: number;
    httpUpdatesPort: number;
  };
  gps: boolean;
  gyro: boolean;
  uptime: number;
  api: string[];
  apiLevel: number[];
}

export interface ThetaState {
  fingerprint: string;
  state: {
    batteryLevel: number;
    storageUri: string;
    storageID: string;
    captureStatus: string;
    recordedTime: number;
    recordableTime: number;
    latestFileUrl: string;
    batteryState: string;
  };
}

export class ThetaAPI {
  private baseUrl: string = '';
  private readonly possibleIPs = [
    '192.168.1.5',      // IP configurada (tu Theta Z1)
    '192.168.1.1',      // IP más común en Theta Z1
    '192.168.1.100',    // Algunas versiones usan esta
    '192.168.1.254',    // Alternativa menos común
  ];

  /**
   * Verifica si la cámara está accesible
   * Prueba múltiples IPs comunes de Theta Z1
   */
  async checkConnection(): Promise<boolean> {
    console.log('🔍 Buscando cámara Theta Z1...');
    
    for (const ip of this.possibleIPs) {
      try {
        console.log(`🔄 Probando IP: ${ip}...`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const response = await fetch(`http://${ip}/osc/info`, {
          method: 'GET',
          signal: controller.signal,
          mode: 'cors',
          cache: 'no-cache',
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Cámara encontrada en ${ip}:`, data.model);
          this.baseUrl = `http://${ip}`;
          return true;
        }
      } catch (error: any) {
        console.warn(`⚠️ No se encontró cámara en ${ip}:`, error.message);
        // Continuar probando otras IPs
      }
    }
    
    console.error('❌ No se pudo conectar con la cámara Theta Z1 en ninguna IP');
    return false;
  }

  /**
   * Obtiene información del dispositivo
   */
  async getDeviceInfo(): Promise<ThetaDeviceInfo> {
    if (!this.baseUrl) {
      throw new Error('No hay conexión establecida con la cámara');
    }
    
    console.log('📡 Obteniendo información del dispositivo...');
    
    const response = await fetch(`${this.baseUrl}/osc/info`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error('Failed to get device info');
    }
    
    const data = await response.json();
    console.log('✅ Información del dispositivo:', data);
    return data;
  }

  /**
   * Inicia una sesión con la cámara
   */
  async startSession(): Promise<string> {
    if (!this.baseUrl) {
      throw new Error('No hay conexión establecida con la cámara');
    }
    
    console.log('🔐 Iniciando sesión con la cámara...');
    
    const response = await fetch(`${this.baseUrl}/osc/commands/execute`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-XSRF-Protected': '1'
      },
      body: JSON.stringify({
        name: 'camera.startSession',
        parameters: {}
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to start session');
    }
    
    const data = await response.json();
    console.log('✅ Sesión iniciada:', data.results.sessionId);
    return data.results.sessionId;
  }

  /**
   * Cierra la sesión actual
   */
  async closeSession(sessionId: string): Promise<void> {
    if (!this.baseUrl) return;
    
    console.log('🔒 Cerrando sesión...');
    
    await fetch(`${this.baseUrl}/osc/commands/execute`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-XSRF-Protected': '1'
      },
      body: JSON.stringify({
        name: 'camera.closeSession',
        parameters: { sessionId }
      })
    });
  }

  /**
   * Obtiene el estado actual de la cámara
   */
  async getState(): Promise<ThetaState> {
    if (!this.baseUrl) {
      throw new Error('No hay conexión establecida con la cámara');
    }
    
    const response = await fetch(`${this.baseUrl}/osc/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error('Failed to get camera state');
    }
    
    return await response.json();
  }

  /**
   * Captura una foto
   */
  async takePicture(sessionId: string): Promise<string> {
    if (!this.baseUrl) {
      throw new Error('No hay conexión establecida con la cámara');
    }
    
    console.log('📸 Capturando foto...');
    
    const response = await fetch(`${this.baseUrl}/osc/commands/execute`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-XSRF-Protected': '1'
      },
      body: JSON.stringify({
        name: 'camera.takePicture',
        parameters: { sessionId }
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to take picture');
    }
    
    const data = await response.json();
    
    // Si el comando está en progreso, esperar usando polling
    if (data.state === 'inProgress') {
      return await this.pollCommandStatus(data.id);
    }
    
    console.log('✅ Foto capturada:', data.results.fileUrl);
    return data.results.fileUrl;
  }

  /**
   * Hace polling del estado de un comando
   */
  private async pollCommandStatus(commandId: string): Promise<string> {
    const maxAttempts = 30; // 30 segundos máximo
    const pollInterval = 1000; // 1 segundo
    
    console.log('⏳ Esperando finalización de captura...');
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      
      const response = await fetch(`${this.baseUrl}/osc/commands/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: commandId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to check command status');
      }
      
      const data = await response.json();
      
      if (data.state === 'done') {
        console.log('✅ Captura completada');
        return data.results.fileUrl;
      }
      
      if (data.state === 'error') {
        throw new Error(data.error?.message || 'Command failed');
      }
    }
    
    throw new Error('Timeout esperando captura de foto');
  }

  /**
   * Descarga una imagen desde la cámara
   */
  async downloadImage(fileUrl: string): Promise<Blob> {
    console.log('⬇️ Descargando imagen...');
    
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error('Failed to download image');
    }
    
    const blob = await response.blob();
    console.log(`✅ Imagen descargada: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
    return blob;
  }

  /**
   * Obtiene el URL del live preview (MJPEG stream)
   * Nota: Este endpoint requiere que la cámara esté en modo live view
   */
  async getLivePreview(): Promise<ReadableStream<Uint8Array>> {
    if (!this.baseUrl) {
      throw new Error('No hay conexión establecida con la cámara');
    }
    
    const response = await fetch(`${this.baseUrl}/osc/commands/execute`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-XSRF-Protected': '1'
      },
      body: JSON.stringify({
        name: 'camera.getLivePreview',
        parameters: {}
      })
    });
    
    if (!response.ok || !response.body) {
      throw new Error('Failed to get live preview');
    }
    
    return response.body;
  }

  /**
   * Lista los archivos en la cámara
   */
  async listFiles(maxResults: number = 10): Promise<any[]> {
    if (!this.baseUrl) {
      throw new Error('No hay conexión establecida con la cámara');
    }
    
    const response = await fetch(`${this.baseUrl}/osc/commands/execute`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-XSRF-Protected': '1'
      },
      body: JSON.stringify({
        name: 'camera.listFiles',
        parameters: {
          fileType: 'image',
          entryCount: maxResults,
          maxThumbSize: 0
        }
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to list files');
    }
    
    const data = await response.json();
    return data.results.entries || [];
  }
}

export const thetaAPI = new ThetaAPI();
