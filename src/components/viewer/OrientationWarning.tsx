import { useTranslation } from 'react-i18next';
import { Smartphone } from 'lucide-react';

interface OrientationWarningProps {
  onContinue: () => void;
  onTryRotate?: () => void;
  isStandalone?: boolean;
}

export const OrientationWarning = ({ onContinue, onTryRotate, isStandalone = false }: OrientationWarningProps) => {
  const { t } = useTranslation();
  
  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}
    >
      <div style={{ 
        textAlign: 'center', 
        maxWidth: '28rem',
        color: 'white'
      }}>
        {/* Icono animado de teléfono rotando */}
        <div style={{ 
          marginBottom: '2rem', 
          display: 'flex', 
          justifyContent: 'center' 
        }}>
          <Smartphone 
            style={{
              width: '6rem',
              height: '6rem',
              animation: 'rotate360 2s ease-in-out infinite',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'
            }}
          />
        </div>
        
        <style>{`
          @keyframes rotate360 {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(90deg); }
          }
        `}</style>
        
        {/* Textos */}
        <h2 style={{ 
          fontSize: '1.875rem', 
          fontWeight: 'bold', 
          marginBottom: '1rem',
          textShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}>
          {t('orientation.rotateDevice', 'Please rotate your device')}
        </h2>
        
        <p style={{ 
          fontSize: '1.125rem', 
          marginBottom: '1.5rem',
          opacity: 0.95
        }}>
          {t('orientation.landscapeRequired', 'This experience works better in landscape mode')}
        </p>
        
        {/* Pasos instructivos */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(10px)',
          borderRadius: '1rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          textAlign: 'left',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          {isStandalone ? (
            // Instrucciones para PWA instalada
            <>
              <div style={{ 
                display: 'flex', 
                alignItems: 'start',
                marginBottom: '1rem'
              }}>
                <div style={{
                  background: 'white',
                  color: '#667eea',
                  borderRadius: '50%',
                  width: '1.75rem',
                  height: '1.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  marginRight: '0.75rem',
                  flexShrink: 0,
                  fontSize: '0.875rem'
                }}>1</div>
                <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
                  {t('orientation.step1', 'Disable rotation lock on your device')}
                </p>
              </div>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'start'
              }}>
                <div style={{
                  background: 'white',
                  color: '#667eea',
                  borderRadius: '50%',
                  width: '1.75rem',
                  height: '1.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  marginRight: '0.75rem',
                  flexShrink: 0,
                  fontSize: '0.875rem'
                }}>2</div>
                <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
                  {t('orientation.step2', 'Rotate your phone to landscape position')}
                </p>
              </div>
            </>
          ) : (
            // Instrucciones para acceso directo web
            <>
              <div style={{ 
                display: 'flex', 
                alignItems: 'start',
                marginBottom: '1rem'
              }}>
                <div style={{
                  background: 'white',
                  color: '#667eea',
                  borderRadius: '50%',
                  width: '1.75rem',
                  height: '1.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  marginRight: '0.75rem',
                  flexShrink: 0,
                  fontSize: '0.875rem'
                }}>1</div>
                <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
                  {t('orientation.installPwaStep', 'Para mejor experiencia, instala la app completa desde el menú de Chrome')}
                </p>
              </div>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'start'
              }}>
                <div style={{
                  background: 'white',
                  color: '#667eea',
                  borderRadius: '50%',
                  width: '1.75rem',
                  height: '1.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  marginRight: '0.75rem',
                  flexShrink: 0,
                  fontSize: '0.875rem'
                }}>2</div>
                <p style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>
                  {t('orientation.manualRotateStep', 'O simplemente gira tu teléfono a posición horizontal')}
                </p>
              </div>
            </>
          )}
        </div>
        
        {/* Botones */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          {onTryRotate && isStandalone && (
            <button
              onClick={onTryRotate}
              style={{
                background: 'white',
                color: '#667eea',
                padding: '0.875rem 1.5rem',
                borderRadius: '0.75rem',
                fontWeight: '600',
                fontSize: '1rem',
                border: 'none',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
            >
              {t('orientation.tryAgain', 'Try again')}
            </button>
          )}
          
          {!isStandalone && (
            <button
              onClick={() => {
                alert(t('orientation.installInstructions', 
                  'Abre el menú de Chrome (⋮) y selecciona "Agregar a la pantalla principal"'));
              }}
              style={{
                background: 'white',
                color: '#667eea',
                padding: '0.875rem 1.5rem',
                borderRadius: '0.75rem',
                fontWeight: '600',
                fontSize: '1rem',
                border: 'none',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
            >
              {t('orientation.installApp', 'Instalar App Completa')}
            </button>
          )}
          
          <button
            onClick={onContinue}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.75rem',
              fontWeight: '500',
              fontSize: '0.95rem',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              cursor: 'pointer',
              transition: 'background 0.2s',
              backdropFilter: 'blur(10px)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
            }}
          >
            {t('orientation.continueAnyway', 'Continue in portrait')}
          </button>
        </div>
      </div>
    </div>
  );
};
