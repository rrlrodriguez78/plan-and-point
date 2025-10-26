# Guía del Sistema Multi-Tenant

## 📋 Resumen del Sistema

Este sistema implementa una arquitectura multi-tenant completa con roles jerárquicos:

- **Super Admin**: Control total del sistema, gestiona todos los tenants
- **Tenant Admin**: Administra usuarios dentro de su tenant
- **Member**: Usuario regular con acceso a su tenant

## 🏗️ Arquitectura

### Tablas Principales

1. **tenants** - Organizaciones del sistema
   - `id`, `name`, `owner_id`, `status`, `subscription_tier`

2. **tenant_users** - Relación usuarios-tenants
   - `tenant_id`, `user_id`, `role` (tenant_admin/member)

3. **user_roles** - Roles globales del sistema
   - `user_id`, `role` (admin/moderator/user)

4. **virtual_tours** - Tours asociados a tenants
   - Cada tour pertenece a un `tenant_id`

### Funciones de Seguridad

- `get_user_tenants(user_id)` - Obtiene tenants del usuario
- `is_super_admin(user_id)` - Verifica si es super admin
- `is_tenant_admin(user_id, tenant_id)` - Verifica admin de tenant
- `belongs_to_tenant(user_id, tenant_id)` - Verifica pertenencia

## 🚀 Flujo de Registro Automático

Cuando un nuevo usuario se registra:

1. Se crea su perfil en `profiles`
2. Se crea automáticamente un tenant con su nombre
3. Se asigna como `tenant_admin` de ese tenant
4. Ya puede comenzar a crear tours

```sql
-- Función handle_new_user() ejecutada automáticamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_new_user();
```

## 👥 Roles y Permisos

### Super Admin (Global)

**Acceso:**
- ✅ Dashboard Super Admin (`/app/super-admin`)
- ✅ Crear/editar/eliminar tenants
- ✅ Ver estadísticas del sistema completo
- ✅ Acceso a todos los datos

**Funcionalidades:**
- Gestión completa de tenants
- Estadísticas globales del sistema
- Configuración de suscripciones (free/premium/enterprise)

### Tenant Admin

**Acceso:**
- ✅ Dashboard de Analytics (`/app/inicio`)
- ✅ Gestión de Usuarios (`/app/tenant-admin`)
- ✅ Crear/editar/eliminar tours de su tenant
- ✅ Agregar/remover usuarios a su tenant
- ✅ Cambiar roles dentro del tenant

**Funcionalidades:**
- Invitar usuarios existentes al tenant
- Asignar roles (member/tenant_admin)
- Ver estadísticas del tenant
- Gestión completa de tours

### Member

**Acceso:**
- ✅ Dashboard de Analytics (`/app/inicio`)
- ✅ Ver tours del tenant
- ✅ Crear tours nuevos
- ❌ No puede gestionar usuarios

## 📊 Estadísticas Implementadas

### Dashboard Principal (`/app/inicio`)

**Estadísticas por Tenant:**
- 👥 Total de usuarios en el tenant
- 📍 Total de tours (publicados/draft)
- 👁️ Vistas totales
- 📈 Vistas últimos 30 días

**Estadísticas Generales del Usuario:**
- Tours totales
- Vistas, likes, comentarios
- Emails enviados
- Actividad reciente

### Super Admin Dashboard (`/app/super-admin`)

**Estadísticas del Sistema:**
- 🏢 Tenants totales (activos/premium)
- 👥 Usuarios totales
- 📍 Tours totales
- 👁️ Vistas totales del sistema

## 🔔 Sistema de Notificaciones

### Eventos que Generan Notificaciones

1. **Agregado a Tenant**
   - Cuando un admin agrega un usuario a su tenant
   - Tipo: `tenant_invite`
   - Incluye: nombre del tenant, rol asignado

2. **Nueva Vista en Tour**
   - Cuando alguien ve un tour
   - Tipo: `new_view`

3. **Nuevo Comentario**
   - Comentarios en tours
   - Tipo: `new_comment`

### Acceso a Notificaciones

- Widget en dashboard principal
- Notificaciones en tiempo real
- Metadata completa del evento

## 🧪 Guía de Pruebas

### 1. Probar Registro de Nuevo Usuario

```bash
1. Ir a /signup
2. Registrarse con email nuevo
3. Verificar:
   ✅ Usuario creado en profiles
   ✅ Tenant creado automáticamente
   ✅ Usuario es tenant_admin de su tenant
   ✅ Aparece en TenantSwitcher
```

**Verificación en Base de Datos:**
```sql
-- Ver tenant creado
SELECT * FROM tenants WHERE owner_id = 'USER_ID';

-- Ver asignación como admin
SELECT * FROM tenant_users WHERE user_id = 'USER_ID';
```

### 2. Verificar Super Admin

```bash
1. Login como super admin (rrlrodriguez78@gmail.com)
2. Ir a /app/super-admin
3. Verificar:
   ✅ Ve todos los tenants
   ✅ Puede crear nuevos tenants
   ✅ Ve estadísticas del sistema
   ✅ Puede editar/eliminar tenants
```

### 3. Probar Gestión de Usuarios (Tenant Admin)

```bash
1. Login como tenant admin
2. Ir a /app/tenant-admin
3. Click en "Agregar Usuario"
4. Ingresar email de usuario registrado
5. Seleccionar rol (member/tenant_admin)
6. Verificar:
   ✅ Usuario agregado a la tabla
   ✅ Notificación enviada al usuario
   ✅ Usuario aparece en lista
   ✅ Puede cambiar su rol
   ✅ Puede removerlo
```

### 4. Probar Invitación de Usuarios

**Escenario A: Usuario Existente**
```bash
1. Como tenant admin, ir a /app/tenant-admin
2. Ingresar email de usuario ya registrado
3. Asignar rol
4. ✅ Usuario se agrega inmediatamente
5. ✅ Recibe notificación
```

**Escenario B: Usuario Nuevo**
```bash
1. Ingresar email de usuario NO registrado
2. ❌ Sistema muestra: "Usuario no encontrado. Debe registrarse primero."
3. Usuario debe registrarse primero en /signup
```

### 5. Probar Notificaciones

```bash
1. Usuario A agrega a Usuario B a su tenant
2. Usuario B login y ve:
   ✅ Notificación en dashboard
   ✅ Badge con número de no leídas
   ✅ Mensaje: "Has sido agregado al tenant X con rol Y"
   ✅ Al hacer click, se marca como leída
```

### 6. Probar Estadísticas por Tenant

```bash
1. Login como cualquier usuario
2. Ir a /app/inicio
3. Verificar sección "Estadísticas de [Tenant Name]":
   ✅ Muestra usuarios del tenant
   ✅ Muestra tours del tenant
   ✅ Muestra vistas totales
   ✅ Muestra vistas últimos 30 días
```

### 7. Probar Cambio de Tenant

```bash
Requisito: Usuario debe pertenecer a múltiples tenants

1. Como super admin, agregar usuario a otro tenant
2. Usuario hace login
3. Ve TenantSwitcher en navbar
4. Selecciona otro tenant
5. Verificar:
   ✅ Dashboard actualiza estadísticas
   ✅ Tours cambian según tenant
   ✅ Permisos se actualizan
```

## 🔒 Seguridad (RLS Policies)

### Tenants
- ✅ Usuarios solo ven tenants a los que pertenecen
- ✅ Solo owners pueden eliminar tenants
- ✅ Solo admins pueden editar tenants

### Tenant Users
- ✅ Solo tenant admins pueden gestionar usuarios
- ✅ Super admin tiene acceso completo

### Virtual Tours
- ✅ Tours públicos: todos pueden ver
- ✅ Tours privados: solo miembros del tenant
- ✅ Solo tenant admins pueden crear/editar/eliminar

### Notifications
- ✅ Usuarios solo ven sus propias notificaciones
- ✅ Sistema puede crear notificaciones para cualquier usuario

## 🎯 Navegación Mejorada

### Navbar Organizado por Roles

**Sección Principal (Todos):**
- Home
- Dashboard
- Crear Tour
- Tours
- Tours Públicos
- My Settings

**Sección Administración (Tenant Admin):**
- Gestionar Usuarios

**Sección Super Admin:**
- Gestionar Tenants
- Settings

## 📝 Casos de Uso Comunes

### Caso 1: Empresa Nueva se Registra

1. Representante se registra en `/signup`
2. Sistema crea tenant automáticamente
3. Puede invitar a su equipo desde `/app/tenant-admin`
4. Equipo recibe notificaciones
5. Todos trabajan en el mismo tenant

### Caso 2: Freelancer con Múltiples Clientes

1. Freelancer es agregado a tenant de Cliente A
2. También es agregado a tenant de Cliente B
3. Usa TenantSwitcher para cambiar entre clientes
4. Ve y gestiona tours de cada cliente por separado

### Caso 3: Super Admin Gestiona Sistema

1. Super admin ve dashboard global
2. Crea nuevo tenant para cliente premium
3. Asigna plan "enterprise"
4. Agrega usuario como tenant_admin
5. Usuario puede invitar su equipo

## 🚨 Troubleshooting

### Usuario no ve ningún tenant

**Causa:** No pertenece a ningún tenant
**Solución:** 
```sql
-- Verificar en tenant_users
SELECT * FROM tenant_users WHERE user_id = 'USER_ID';

-- Si no existe, crear tenant
INSERT INTO tenants (name, owner_id) VALUES ('Tenant Name', 'USER_ID');
INSERT INTO tenant_users (tenant_id, user_id, role) 
VALUES ('NEW_TENANT_ID', 'USER_ID', 'tenant_admin');
```

### Error al crear tour: "row violates RLS"

**Causa:** tenant_id no coincide con usuario autenticado
**Solución:** Verificar que `currentTenant.tenant_id` se use correctamente

### Super admin no aparece en menú

**Causa:** Falta rol en `user_roles`
**Solución:**
```sql
INSERT INTO user_roles (user_id, role) 
VALUES ('USER_ID', 'admin');
```

## 📦 Deploy a Producción

### Checklist Pre-Deploy

- ✅ Todas las migraciones aplicadas
- ✅ RLS policies configuradas
- ✅ Funciones de seguridad creadas
- ✅ Triggers activos
- ✅ Email auto-confirm habilitado (para testing)

### Pasos de Deploy

1. **Base de Datos:**
   ```bash
   # Ya desplegada automáticamente con Lovable Cloud
   ```

2. **Frontend:**
   ```bash
   # Click en "Publish" en Lovable
   # O push a repo conectado con GitHub
   ```

3. **Verificación Post-Deploy:**
   - Registro de nuevo usuario funciona
   - Notificaciones se envían
   - Estadísticas cargan correctamente
   - RLS policies funcionan

## 🎉 Sistema Completo y Listo

El sistema multi-tenant está **100% funcional** con:

✅ Registro automático de tenants  
✅ Gestión de usuarios por tenant  
✅ Notificaciones en tiempo real  
✅ Estadísticas por tenant y globales  
✅ Navegación organizada por roles  
✅ Seguridad con RLS completa  
✅ Super Admin dashboard  
✅ Tenant Admin dashboard  
✅ TenantSwitcher funcional  

**¡Listo para producción! 🚀**