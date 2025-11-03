# Guía de Configuración de Capacitor

## ✅ Pasos Completados Automáticamente

1. ✅ Dependencias instaladas:
   - `@capacitor/core`
   - `@capacitor/cli`
   - `@capacitor/android`
   - `@capacitor/ios`

2. ✅ Archivo `capacitor.config.ts` creado con:
   - **App ID**: `com.lovable.virtualtour360simba`
   - **App Name**: `virtual-tour-360-simba`
   - **Hot-reload** configurado desde Lovable
   - **Configuración Android**: Permite contenido mixto (necesario para Theta Z1)
   - **Configuración iOS**: Optimizada para webviews

## 📋 Pasos que DEBES Completar en tu Máquina Local

### 1️⃣ Exportar el Proyecto a GitHub
1. Haz clic en el botón **"Export to GitHub"** en la interfaz de Lovable (esquina superior derecha)
2. Autoriza la conexión con GitHub si es necesario
3. Clona el repositorio en tu máquina local:
   ```bash
   git clone [URL-DE-TU-REPO]
   cd virtual-tour-360-simba
   ```

### 2️⃣ Instalar Dependencias
```bash
npm install
```

### 3️⃣ Agregar Plataformas

**Para Android:**
```bash
npx cap add android
```

**Para iOS (requiere macOS con Xcode):**
```bash
npx cap add ios
```

### 4️⃣ Compilar el Proyecto Web
```bash
npm run build
```

### 5️⃣ Sincronizar con Capacitor
```bash
npx cap sync
```
⚠️ **IMPORTANTE**: Debes ejecutar este comando cada vez que hagas `git pull` de cambios nuevos.

### 6️⃣ Ejecutar en Dispositivo/Emulador

**Para Android:**
```bash
npx cap run android
```
- Si tienes Android Studio instalado, se abrirá automáticamente
- Selecciona un emulador o conecta un dispositivo físico con USB Debugging habilitado

**Para iOS (solo en macOS):**
```bash
npx cap run ios
```
- Se abrirá Xcode
- Selecciona un simulador o dispositivo físico

## 🎯 Uso con Theta Z1

### Flujo de Trabajo en la App Nativa:

1. **Inicia la app** desde tu dispositivo móvil (la app Capacitor)
2. **Conecta el WiFi** del dispositivo a la Theta Z1 (THETAXXX)
3. ✅ **La app NO se recargará** (ventaja sobre PWA)
4. **Captura fotos** desde la sección Editor → ThetaCameraConnector
5. Las fotos se guardan en **IndexedDB local**
6. **Desconecta de Theta Z1**, reconecta a tu WiFi normal
7. La app automáticamente **sincronizará todas las fotos** pendientes

## 🔧 Modo de Desarrollo (Hot-Reload)

Durante el desarrollo, la app se conectará automáticamente a Lovable para recargar cambios en tiempo real:
- Editas código en Lovable
- La app nativa se actualiza automáticamente
- No necesitas recompilar cada vez

### Para Desactivar Hot-Reload (Producción):
Edita `capacitor.config.ts` y comenta/elimina la sección `server`:
```typescript
// server: {
//   url: 'https://...',
//   cleartext: true
// },
```

Luego ejecuta:
```bash
npm run build
npx cap sync
```

## 📱 Requisitos del Sistema

### Para Android:
- **Android Studio** instalado
- **Java Development Kit (JDK)** 17 o superior
- Dispositivo Android con **Developer Options** habilitadas
- O un **Android Emulator** configurado

### Para iOS (solo macOS):
- **Xcode** instalado (desde Mac App Store)
- **CocoaPods** instalado:
  ```bash
  sudo gem install cocoapods
  ```
- Cuenta de Apple Developer (gratuita para testing, de pago para App Store)

## 🆘 Solución de Problemas

### Error al sincronizar:
```bash
npm run build
npx cap sync
```

### La app no actualiza cambios:
```bash
npm run build
npx cap sync
npx cap run android  # o ios
```

### Problemas con IndexedDB en Android:
IndexedDB está habilitado por defecto en Capacitor. Si tienes problemas:
1. Verifica que `android/app/src/main/AndroidManifest.xml` tenga:
   ```xml
   <application android:usesCleartextTraffic="true">
   ```

## 📚 Recursos Adicionales

- [Documentación Oficial de Capacitor](https://capacitorjs.com/docs)
- [Guía de Android Studio](https://developer.android.com/studio/intro)
- [Guía de Xcode](https://developer.apple.com/xcode/)
- [Blog Post de Lovable sobre Capacitor](https://docs.lovable.dev/)

## ✨ Ventajas de Usar Capacitor con Theta Z1

✅ **No se recarga la app** al cambiar de WiFi  
✅ **IndexedDB persistente** incluso sin conexión  
✅ **Acceso completo** a APIs del dispositivo  
✅ **Mejor rendimiento** que PWA  
✅ **Posibilidad de publicar** en App Store / Google Play  
✅ **Push notifications** nativas (futuro)  
✅ **Acceso a cámara nativa** del dispositivo (futuro)

---

## 🚀 Próximos Pasos

1. Sigue los pasos de la sección **"Pasos que DEBES Completar"**
2. Prueba la app en un emulador primero
3. Luego prueba en dispositivo físico con Theta Z1
4. Reporta cualquier problema en el chat de Lovable

¡Tu app ya está lista para funcionar offline con Theta Z1! 🎉
