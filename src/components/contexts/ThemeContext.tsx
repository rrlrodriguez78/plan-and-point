import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext<any>(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Definiciones de temas
const backgroundThemes = {
  default: { name: 'Predeterminado', gradient: 'from-slate-50 to-blue-50', cardBg: 'bg-white/80', description: 'Limpio y profesional' },
  dark: { name: 'Oscuro', gradient: 'from-slate-800 to-slate-900', cardBg: 'bg-slate-800/90', description: 'Elegante y moderno' },
  warm: { name: 'Cálido', gradient: 'from-orange-50 to-red-50', cardBg: 'bg-white/85', description: 'Acogedor y energético' },
  cool: { name: 'Fresco', gradient: 'from-cyan-50 to-blue-100', cardBg: 'bg-white/80', description: 'Relajante y sereno' },
  nature: { name: 'Naturaleza', gradient: 'from-green-50 to-emerald-100', cardBg: 'bg-white/85', description: 'Natural y orgánico' },
  minimal: { name: 'Minimalista', gradient: 'from-gray-50 to-gray-100', cardBg: 'bg-gray-50/90', description: 'Simple y limpio' }
};

const fontSizes = {
  small: { name: 'Pequeño', scale: '0.875' },
  medium: { name: 'Mediano', scale: '1' },
  large: { name: 'Grande', scale: '1.125' },
  xlarge: { name: 'Extra Grande', scale: '1.25' }
};

const fontFamilies = {
  inter: { name: 'Inter', family: '"Inter", system-ui, -apple-system, sans-serif', description: 'Moderna y legible' },
  roboto: { name: 'Roboto', family: '"Roboto", system-ui, -apple-system, sans-serif', description: 'Google Material Design' },
  opensans: { name: 'Open Sans', family: '"Open Sans", system-ui, -apple-system, sans-serif', description: 'Amigable y clara' },
  lato: { name: 'Lato', family: '"Lato", system-ui, -apple-system, sans-serif', description: 'Profesional y elegante' },
  poppins: { name: 'Poppins', family: '"Poppins", system-ui, -apple-system, sans-serif', description: 'Redonda y moderna' },
  montserrat: { name: 'Montserrat', family: '"Montserrat", system-ui, -apple-system, sans-serif', description: 'Geométrica y urbana' },
};

// Default theme configuration
const defaultTheme = {
  font_size: 'medium',
  font_family: 'inter',
  button_color: '#3b82f6',
  text_color: '#1e293b',
  secondary_text_color: '#64748b',
  background_theme: 'default',
  high_contrast: false,
  reduced_motion: false,
};

const saveThemeToLocalStorage = (themeSettings: any) => {
  try {
    localStorage.setItem('virtualHomeTheme', JSON.stringify(themeSettings));
  } catch (error) {
    console.error('Failed to save theme to localStorage:', error);
  }
};

const loadThemeFromLocalStorage = () => {
  try {
    const storedTheme = localStorage.getItem('virtualHomeTheme');
    return storedTheme ? JSON.parse(storedTheme) : defaultTheme;
  } catch (error) {
    console.error('Failed to load theme from localStorage, using default:', error);
    return defaultTheme;
  }
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState(loadThemeFromLocalStorage);
  const [isLoading] = useState(false);

  useEffect(() => {
    applyTheme(theme);
    saveThemeToLocalStorage(theme);
  }, [theme]);

  const applyTheme = (newTheme: any) => {
    const root = document.documentElement;
    const body = document.body;
    
    root.style.setProperty('--font-scale-multiplier', fontSizes[newTheme.font_size as keyof typeof fontSizes]?.scale || '1');
    root.style.setProperty('--primary-color', newTheme.button_color);
    
    body.classList.toggle('high-contrast', newTheme.high_contrast);
    body.classList.toggle('reduced-motion', newTheme.reduced_motion);
    
    Object.keys(backgroundThemes).forEach(themeKey => {
      body.classList.toggle(`theme-${themeKey}`, newTheme.background_theme === themeKey);
    });
  };

  const updateTheme = async (newThemeSettings: any) => {
    setTheme((prevTheme: any) => ({ ...prevTheme, ...newThemeSettings }));
  };

  const resetTheme = async () => {
    setTheme(defaultTheme);
  };

  const value = {
    theme,
    isLoading,
    updateTheme,
    resetTheme,
    backgroundThemes,
    fontSizes,
    fontFamilies,
    defaultTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
