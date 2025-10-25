import { useDeviceDetection } from '@/hooks/useDeviceDetection';

export function DeviceDebug() {
  const deviceInfo = useDeviceDetection();
  
  return (
    <div 
      style={{ 
        position: 'fixed', 
        bottom: '10px', 
        right: '10px', 
        background: 'rgba(0, 0, 0, 0.9)', 
        color: 'white', 
        padding: '12px', 
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 9999,
        minWidth: '200px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
        🔍 Device Debug
      </div>
      <div style={{ marginBottom: '4px' }}>
        📱 Width: <strong>{deviceInfo.screenWidth}px</strong>
      </div>
      <div style={{ marginBottom: '4px' }}>
        💻 Device: <strong>{deviceInfo.deviceType}</strong>
      </div>
      <div style={{ marginBottom: '4px' }}>
        👆 Touch: <strong>{deviceInfo.hasTouch ? 'Yes' : 'No'}</strong>
      </div>
      <div style={{ marginBottom: '4px' }}>
        📲 Mobile: <strong>{deviceInfo.isMobile ? 'Yes' : 'No'}</strong>
      </div>
      <div style={{ marginBottom: '4px' }}>
        📟 Tablet: <strong>{deviceInfo.isTablet ? 'Yes' : 'No'}</strong>
      </div>
      <div style={{ marginBottom: '4px' }}>
        🖥️ Desktop: <strong>{deviceInfo.isDesktop ? 'Yes' : 'No'}</strong>
      </div>
      <div style={{ fontSize: '10px', marginTop: '8px', opacity: 0.7 }}>
        UA: {deviceInfo.userAgent.substring(0, 40)}...
      </div>
    </div>
  );
}
