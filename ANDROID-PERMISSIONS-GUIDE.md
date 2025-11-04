# 📱 Guía de Permisos Android - VirtualTour360

## ⚠️ Importante
Esta guía es para cuando **compiles la app nativa Android**. Si solo usas la versión web, no necesitas hacer nada.

---

## 🚀 Pasos para Configurar Permisos

### 1. Exportar y Configurar Proyecto (Primera vez)

```bash
# En tu máquina local después de exportar desde Lovable
npm install
npx cap add android
npm run build
npx cap sync
```

---

### 2. Editar AndroidManifest.xml

**Ubicación del archivo:**
```
android/app/src/main/AndroidManifest.xml
```

**Agregar estos permisos dentro de `<manifest>` (antes de `<application>`):**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- ✅ Permisos de almacenamiento (Android 12 y anteriores) -->
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" 
                     android:maxSdkVersion="32" />
    
    <!-- ✅ Permisos de almacenamiento (Android 13+) -->
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    
    <!-- ✅ Internet (necesario para sincronización) -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <!-- ✅ Cámara (para conectar Theta Z1) -->
    <uses-permission android:name="android.permission.CAMERA" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:requestLegacyExternalStorage="true"
        android:usesCleartextTraffic="true">
        
        <!-- ☝️ requestLegacyExternalStorage: Permite usar almacenamiento externo en Android 10-12 -->
        <!-- ☝️ usesCleartextTraffic: Permite conexión HTTP a localhost para desarrollo -->
        
        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">
            
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

---

### 3. Compilar y Ejecutar

```bash
# Sincronizar cambios
npx cap sync

# Abrir en Android Studio
npx cap open android

# O ejecutar directamente
npx cap run android
```

---

## 🧪 Pruebas de Permisos

### Primera Instalación
1. Instala la app en dispositivo físico o emulador
2. Al abrir la app, debe aparecer un diálogo pidiendo permisos de almacenamiento
3. Acepta los permisos
4. Verifica en consola: `✅ Storage permissions granted`

### Verificar Permisos Manualmente
```bash
# Ver permisos de la app
adb shell dumpsys package app.lovable.090a7828d3d34f3091e7e22507021ad8 | grep permission

# Ver archivos guardados
adb shell
cd /storage/emulated/0/VirtualTour360/tours/
ls -lah
```

---

## ❌ Problemas Comunes

### Error: "Permission denied" al guardar tour

**Causa:** Permisos no concedidos o denegados permanentemente.

**Solución:**
1. Ve a: **Ajustes > Aplicaciones > VirtualTour360 > Permisos**
2. Activa **"Archivos y medios"** o **"Almacenamiento"**
3. Reinicia la app

---

### Error: "Storage not available" en Android 13+

**Causa:** Falta `READ_MEDIA_IMAGES` o `READ_MEDIA_VIDEO`.

**Solución:**
1. Verifica que `AndroidManifest.xml` tenga los permisos granulares de Android 13+
2. Reinstala la app para aplicar cambios

---

### App no pide permisos automáticamente

**Causa:** Permisos ya denegados en instalación anterior.

**Solución:**
```bash
# Desinstalar app completamente
adb uninstall app.lovable.090a7828d3d34f3091e7e22507021ad8

# Reinstalar
npx cap run android
```

---

## 📊 Versiones de Android

| Android | API Level | Permisos Necesarios |
|---------|-----------|---------------------|
| 9 (Pie) y anteriores | ≤28 | `READ/WRITE_EXTERNAL_STORAGE` |
| 10 (Q) | 29 | `READ/WRITE_EXTERNAL_STORAGE` + `requestLegacyExternalStorage="true"` |
| 11-12 (R-S) | 30-32 | `READ/WRITE_EXTERNAL_STORAGE` |
| 13+ (T) | ≥33 | `READ_MEDIA_IMAGES` + `READ_MEDIA_VIDEO` |

---

## 🎯 Flujo Completo de Desarrollo

```bash
# 1. Exportar desde Lovable
git clone [tu-repo]
cd virtual-tour-360-simba

# 2. Instalar dependencias
npm install

# 3. Agregar plataforma Android (primera vez)
npx cap add android

# 4. Editar AndroidManifest.xml
# (Agregar permisos según esta guía)

# 5. Compilar proyecto web
npm run build

# 6. Sincronizar con Android
npx cap sync

# 7. Ejecutar en dispositivo
npx cap run android

# 8. Después de cambios en código web
npm run build
npx cap sync
# No necesitas reinstalar la app
```

---

## 🔧 Comandos Útiles

```bash
# Ver logs en tiempo real
adb logcat | grep -i "capacitor\|virtualtour"

# Limpiar datos de la app (resetear permisos)
adb shell pm clear app.lovable.090a7828d3d34f3091e7e22507021ad8

# Ver info de la app instalada
adb shell pm list packages | grep lovable
adb shell pm dump app.lovable.090a7828d3d34f3091e7e22507021ad8

# Verificar espacio disponible
adb shell df /storage/emulated/0/
```

---

## ✅ Checklist de Configuración

- [ ] Exportar proyecto desde Lovable a GitHub
- [ ] Clonar repositorio en tu máquina
- [ ] Ejecutar `npm install`
- [ ] Ejecutar `npx cap add android`
- [ ] Editar `AndroidManifest.xml` con permisos
- [ ] Ejecutar `npm run build && npx cap sync`
- [ ] Abrir en Android Studio con `npx cap open android`
- [ ] Conectar dispositivo físico o iniciar emulador
- [ ] Ejecutar app y aceptar permisos
- [ ] Probar guardar tour offline
- [ ] Verificar archivos en `/storage/emulated/0/VirtualTour360/`

---

## 📚 Recursos Adicionales

- [Capacitor Storage Documentation](https://capacitorjs.com/docs/apis/filesystem)
- [Android Permissions Guide](https://developer.android.com/training/permissions/requesting)
- [Scoped Storage (Android 10+)](https://developer.android.com/about/versions/11/privacy/storage)

---

## 💡 Notas Importantes

1. **Web vs Nativa:** La versión web NO necesita estos permisos, funcionan automáticamente en el navegador.

2. **Hot Reload:** Después de editar código web, solo necesitas:
   ```bash
   npm run build
   npx cap sync
   ```
   No necesitas reinstalar la app.

3. **Permisos en Runtime:** Los permisos se solicitan automáticamente al abrir la app (ver `App.tsx`).

4. **Almacenamiento Externo:** Los tours se guardan en:
   - **Android:** `/storage/emulated/0/VirtualTour360/tours/`
   - **iOS:** `Documents/VirtualTour360/tours/`

5. **Sincronización:** La app funciona 100% offline. Cuando recuperes conexión, los datos se sincronizan automáticamente con Supabase.
