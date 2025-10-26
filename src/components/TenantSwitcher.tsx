import { useTenant } from '@/contexts/TenantContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';

export default function TenantSwitcher() {
  const { currentTenant, tenants, setCurrentTenant, loading } = useTenant();

  if (loading || tenants.length === 0) {
    return null;
  }

  // Don't show if only one tenant
  if (tenants.length === 1) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        {currentTenant?.tenant_name}
      </div>
    );
  }

  return (
    <Select
      value={currentTenant?.tenant_id}
      onValueChange={(value) => {
        const tenant = tenants.find((t) => t.tenant_id === value);
        if (tenant) setCurrentTenant(tenant);
      }}
    >
      <SelectTrigger className="w-[200px]">
        <Building2 className="h-4 w-4 mr-2" />
        <SelectValue placeholder="Selecciona tenant" />
      </SelectTrigger>
      <SelectContent>
        {tenants.map((tenant) => (
          <SelectItem key={tenant.tenant_id} value={tenant.tenant_id}>
            {tenant.tenant_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
