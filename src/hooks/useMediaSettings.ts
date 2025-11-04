import { useUserSettingsContext } from '@/contexts/UserSettingsContext';

/**
 * Hook to access media settings (volume, autoplay, etc.)
 * Use this in components that need audio/video configuration
 */
export const useMediaSettings = () => {
  const { settings } = useUserSettingsContext();
  
  return {
    volume: settings.default_volume / 100, // Convert to 0-1 range
    autoplay: settings.autoplay,
    soundEffects: settings.sound_effects,
    videoQuality: settings.video_quality,
  };
};
