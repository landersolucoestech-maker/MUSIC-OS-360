import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { SystemLogo } from "@/shared/ui/system-logo";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { ADMIN_NOTIFICATIONS } from "../data/admin-source";
import {
  LayoutDashboard, Building2, Tag, Receipt,
  ScrollText, Bell, HeadphonesIcon,
  Settings, LogOut, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle2, Info, AlertTriangle, ExternalLink,
  BookOpen,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Painel",       href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Clientes",        href: "/admin/clients",   icon: Building2 },
  { label: "Planos",          href: "/admin/plans",     icon: Tag },
  { label: "Assinaturas",     href: "/admin/subscriptions", icon: Receipt },
  { label: "Registros e auditoria",href: "/admin/audit",     icon: ScrollText },
  { label: "Suporte",         href: "/admin/support",   icon: HeadphonesIcon },
  { label: "Base de Conhecimento", href: "/admin/knowledge", icon: BookOpen },
  { label: "Configurações",   href: "/admin/configuracoes", icon: Settings },
];

const SEVERITY_ICON = {
  info:    <Info className="h-3.5 w-3.5 text-primary" />,
  warning: <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />,
  error:   <AlertCircle className="h-3.5 w-3.5 text-red-400" />,
  success: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
};

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const unread = ADMIN_NOTIFICATIONS.filter(n => !n.read).length;

  const active = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + "/");

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-60",
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
          {!collapsed && (
            <SystemLogo subtitle="Super Admin" markClassName="h-8" />
          )}
          {collapsed && (
            <SystemLogo collapsed markClassName="h-8" className="mx-auto" />
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = active(href);
            return (
              <Link
                key={href}
                to={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/70",
                  collapsed && "justify-center px-2",
                )}
                data-testid={`admin-nav-${label.toLowerCase().replace(/\s/g, "-")}`}
              >
                <Icon className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-4 w-4", isActive ? "text-sidebar-primary" : "opacity-60")} />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="p-4 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors flex items-center justify-center"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Back to app */}
        {!collapsed && (
          <div className="p-3 border-t border-sidebar-border">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-[11px] text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/70 transition-all"
              data-testid="admin-back-to-app"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Voltar ao app
            </button>
          </div>
        )}
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="text-[9px] h-5 px-2 border-primary/30 text-primary bg-primary/10 font-semibold tracking-wider"
            >
              SUPER ADMIN
            </Badge>
            <span className="text-[12px] text-muted-foreground">Painel Global</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-8 w-8 text-muted-foreground hover:text-muted-foreground hover:bg-muted"
                  data-testid="admin-notifications-btn"
                >
                  <Bell className="h-4 w-4" />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary text-[8px] text-foreground flex items-center justify-center font-bold">
                      {unread}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="px-3 py-2 border-b border-border/60">
                  <p className="text-[12px] font-semibold">Notificações</p>
                </div>
                {ADMIN_NOTIFICATIONS.slice(0, 4).map((n) => (
                  <DropdownMenuItem key={n.id} className="gap-2 py-2.5 cursor-pointer">
                    {SEVERITY_ICON[n.severity as keyof typeof SEVERITY_ICON]}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{n.message}</p>
                    </div>
                    {!n.read && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin/notifications" className="text-[12px] text-primary justify-center">
                    Ver todas
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-muted transition-colors"
                  data-testid="admin-profile-btn"
                >
                  <div className="h-7 w-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <span className="text-[11px] font-bold text-primary">SA</span>
                  </div>
                  <span className="text-[12px] text-muted-foreground">Super Admin</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate("/")}>
                  <ExternalLink className="h-3.5 w-3.5 mr-2" /> Voltar ao App
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-400" onClick={() => navigate("/auth")}>
                  <LogOut className="h-3.5 w-3.5 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
