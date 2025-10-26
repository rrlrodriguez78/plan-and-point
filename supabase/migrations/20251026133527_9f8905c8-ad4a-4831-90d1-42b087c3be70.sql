-- Crear tenant para el super admin existente
INSERT INTO public.tenants (id, name, owner_id, status, subscription_tier)
VALUES (
  gen_random_uuid(),
  'KIMG RODRIGO Organization',
  'f457bb3a-5ba9-4da1-9fcb-3fcabc2ed94b',
  'active',
  'enterprise'
)
ON CONFLICT DO NOTHING;

-- Asignar usuario al tenant con rol tenant_admin
INSERT INTO public.tenant_users (tenant_id, user_id, role)
SELECT 
  t.id,
  'f457bb3a-5ba9-4da1-9fcb-3fcabc2ed94b',
  'tenant_admin'::tenant_role
FROM public.tenants t
WHERE t.owner_id = 'f457bb3a-5ba9-4da1-9fcb-3fcabc2ed94b'
ON CONFLICT DO NOTHING;