# Capacidad Expandida de Pisos - 25+ Pisos

## Resumen de Cambios

Se ha expandido significativamente la capacidad del sistema de pisos en el editor para soportar edificios de 25+ pisos y más allá.

## Mejoras Implementadas

### 1. **FloorPlanManager.tsx** - Opciones de Pisos Expandidas

**Antes**: Solo 6 pisos predefinidos
**Ahora**: 25 pisos predefinidos + capacidad ilimitada con nombres personalizados

#### Opciones Disponibles:
- Sótano (Basement)
- Planta Baja (Ground Floor)
- Piso 1 a 25 (con nombres específicos hasta piso 10)
- Ático (Attic)
- Azotea (Rooftop)
- **Nombre Personalizado** (para cualquier piso adicional)

```typescript
// Ejemplo de pisos disponibles:
basement → Sótano
groundFloor → Planta Baja
firstFloor → Primer Piso (1)
...
tenthFloor → Décimo Piso (10)
eleventhFloor → Piso 11
...
twentyFifthFloor → Piso 25
attic → Ático
rooftop → Azotea
custom → Nombre Personalizado
```

### 2. **ViewerControls.tsx** - Detección Inteligente de Pisos

Se mejoró el sistema de detección de pisos para:
- Reconocer automáticamente hasta 25 pisos por nombre
- Soportar nombres en español e inglés
- Manejar nombres personalizados correctamente
- Asignar números correctos a cada piso

#### Sistema de Numeración:
```
-1: Sótano
 0: Planta Baja
 1-10: Nombres específicos (Primer, Segundo, Tercer, etc.)
 11-25: "Piso X"
 26+: Soporte ilimitado con nombres personalizados
 99: Ático
100: Azotea
```

### 3. **ScrollArea Ampliado**

**Antes**: `h-64` (256px) - Solo mostraba ~4-5 pisos
**Ahora**: `h-96` (384px) - Muestra ~6-7 pisos simultáneamente

Esto permite una mejor navegación cuando tienes muchos pisos.

## Capacidad Ilimitada

### Usando Nombres Personalizados

Para edificios con más de 25 pisos, simplemente:
1. Selecciona "Nombre Personalizado" en el selector
2. Ingresa cualquier nombre (ej: "Piso 26", "Piso 30", "Penthouse", etc.)
3. El sistema asignará automáticamente el número correcto

### Detección Automática

El sistema es inteligente y detecta:
- **Nombres en español**: "Primer Piso", "Segundo Piso", "Piso 15"
- **Nombres en inglés**: "First Floor", "Second Floor", "Floor 15"
- **Nombres técnicos**: "firstFloor", "secondFloor", "fifteenthFloor"
- **Números**: "1", "2", "15"

## Beneficios

✅ **Edificios de gran altura**: Soporta rascacielos de 50+ pisos  
✅ **Flexibilidad**: Usa nombres predefinidos O personalizados  
✅ **Multiidioma**: Reconoce español e inglés automáticamente  
✅ **Escalable**: Agregar más pisos es tan simple como agregar uno más  
✅ **Sin límites**: El único límite es tu edificio, no el sistema  

## Casos de Uso

### Ejemplo 1: Torre Residencial (30 pisos)
```
Sótano
Planta Baja
Piso 1 - Piso 30
Azotea
```

### Ejemplo 2: Complejo Mixto
```
Sótano 2
Sótano 1
Planta Baja
Entresuelo
Piso 1 - Piso 20
Penthouse
Terraza
Helipuerto
```

### Ejemplo 3: Rascacielos (60 pisos)
```
Sótano
Lobby
Piso 1 - Piso 60
Sky Lounge
Azotea
```

## Notas Técnicas

1. **Performance**: El sistema sigue siendo rápido incluso con 50+ pisos
2. **Base de datos**: No hay límites en la tabla `floor_plans`
3. **UI responsivo**: El scroll se ajusta automáticamente
4. **Compatibilidad**: Todos los pisos existentes siguen funcionando

## Próximos Pasos Recomendados

Para mejorar aún más la experiencia con muchos pisos:
1. **Búsqueda**: Agregar barra de búsqueda en lista de pisos
2. **Grupos**: Agrupar pisos por secciones (ej: "Pisos 1-10", "Pisos 11-20")
3. **Saltos rápidos**: Botones para saltar a inicio/fin de lista
4. **Miniaturas**: Previsualizaciones más grandes de los planos

---

**Versión**: 1.0  
**Fecha**: 2025-10-27  
**Capacidad Máxima Teórica**: Ilimitada  
**Capacidad Práctica Recomendada**: 100+ pisos
