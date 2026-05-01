import { useAuth } from "@/contexts/AuthContext";
import { useRoles } from "@/hooks/useRoles";
import { Loader2, ShieldX } from "lucide-react";

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredPermission: string;
  fallback?: React.ReactNode;
}

export function PermissionGuard({ children, requiredPermission, fallback }: PermissionGuardProps) {
  const { user } = useAuth();
  const { roles, rolePermissions, permissions, teamMembers, isLoading } = useRoles();

  if (isLoading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return fallback || <AccessDenied />;
  }

  const memberRole = teamMembers.find(tm => tm.user_id === user.id);
  if (!memberRole) {
    return fallback || <AccessDenied />;
  }

  const role = roles.find(r => r.id === memberRole.role_id);
  if (role?.name === "Admin") {
    return <>{children}</>;
  }

  const userPermissionIds = rolePermissions
    .filter(rp => rp.role_id === memberRole.role_id)
    .map(rp => rp.permission_id);

  const hasPermission = permissions.some(
    p => p.code === requiredPermission && userPermissionIds.includes(p.id)
  );

  if (!hasPermission) {
    return fallback || <AccessDenied />;
  }

  return <>{children}</>;
}

function AccessDenied() {
  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <ShieldX className="h-12 w-12" />
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">Acesso Negado</h3>
        <p className="text-sm mt-1">Você não tem permissão para acessar esta página.</p>
        <p className="text-xs mt-2">Entre em contato com o administrador do sistema.</p>
      </div>
    </div>
  );
}
