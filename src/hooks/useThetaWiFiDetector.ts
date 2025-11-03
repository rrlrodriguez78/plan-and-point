import { useState, useEffect, useCallback } from 'react';

interface ThetaWiFiState {
  isThetaWiFi: boolean;
  hasRealInternet: boolean;
  isChecking: boolean;
  currentSSID: string | null;
}

/**
 * Hook para detectar si estás conectado al WiFi de la cámara Theta Z1
 * vs conexión a internet real
 */
export function useThetaWiFiDetector() {
  const [state, setState] = useState<ThetaWiFiState>({
    isThetaWiFi: false,
    hasRealInternet: navigator.onLine,
    isChecking: false,
    currentSSID: null,
  });

  const checkThetaWiFi = useCallback(async () => {
    setState(prev => ({ ...prev, isChecking: true }));

    try {
      // 1. Verificar si hay conexión básica
      if (!navigator.onLine) {
        setState({
          isThetaWiFi: false,
          hasRealInternet: false,
          isChecking: false,
          currentSSID: null,
        });
        return;
      }

      // 2. Intentar conectar con la cámara Theta
      const thetaController = new AbortController();
      const thetaTimeoutId = setTimeout(() => thetaController.abort(), 3000);
      
      try {
        const thetaResponse = await fetch('http://192.168.1.1/osc/info', {
          method: 'GET',
          signal: thetaController.signal,
          mode: 'cors',
        });
        
        clearTimeout(thetaTimeoutId);
        
        if (thetaResponse.ok) {
          // Estamos conectados al WiFi de la Theta
          console.log('✅ Detectado WiFi de Theta Z1');
          setState({
            isThetaWiFi: true,
            hasRealInternet: false,
            isChecking: false,
            currentSSID: 'THETA*',
          });
          return;
        }
      } catch (thetaError) {
        clearTimeout(thetaTimeoutId);
        // No es WiFi de Theta, continuar verificando internet
      }

      // 3. Verificar si hay internet real
      const internetController = new AbortController();
      const internetTimeoutId = setTimeout(() => internetController.abort(), 3000);
      
      try {
        // Intentar ping a un servidor público
        const internetResponse = await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          signal: internetController.signal,
          mode: 'no-cors',
        });
        
        clearTimeout(internetTimeoutId);
        
        console.log('✅ Detectado internet real');
        setState({
          isThetaWiFi: false,
          hasRealInternet: true,
          isChecking: false,
          currentSSID: null,
        });
      } catch (internetError) {
        clearTimeout(internetTimeoutId);
        
        // Hay conexión WiFi pero no hay internet
        console.log('⚠️ Conectado pero sin internet');
        setState({
          isThetaWiFi: false,
          hasRealInternet: false,
          isChecking: false,
          currentSSID: null,
        });
      }
    } catch (error) {
      console.error('Error checking WiFi status:', error);
      setState(prev => ({ ...prev, isChecking: false }));
    }
  }, []);

  // Verificar al montar y periódicamente
  useEffect(() => {
    checkThetaWiFi();
    
    const intervalId = setInterval(checkThetaWiFi, 10000); // Cada 10s
    
    return () => clearInterval(intervalId);
  }, [checkThetaWiFi]);

  // Escuchar cambios de red
  useEffect(() => {
    const handleNetworkChange = () => {
      console.log('🔄 Cambio de red detectado');
      setTimeout(checkThetaWiFi, 500);
    };

    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);

    return () => {
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
    };
  }, [checkThetaWiFi]);

  return {
    ...state,
    refresh: checkThetaWiFi,
  };
}
