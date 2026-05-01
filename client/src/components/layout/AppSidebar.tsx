import { useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Music,
  Radio,
  FileText,
  DollarSign,
  Calendar,
  Package,
  MessageCircle,
  Contact,
  Megaphone,
  ChevronDown,
  ListChecks,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Upload,
  Shield,
  AlertTriangle,
  UserPlus,
  Briefcase,
  Share2,
  Receipt,
  Calculator,
  Eye,
  Target,
  CalendarDays,
  TrendingUp,
  FileEdit,
  Sparkles,
  User,
  Settings,
  LogOut,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface NavItem {
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { title: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Artistas", href: "/artistas", icon: Users },
  { title: "Projetos", href: "/projetos", icon: FolderKanban },
  {
    title: "Registro de Músicas",
    icon: Music,
    children: [
      { title: "Obras & Fonogramas", href: "/registro-musicas", icon: Music },
      { title: "Monitoramento", href: "/monitoramento", icon: Radio },
      { title: "Licenciamento", href: "/licenciamento", icon: Shield },
      { title: "Takedowns", href: "/takedowns", icon: AlertTriangle },
    ],
  },
  {
    title: "Lançamentos",
    icon: Radio,
    children: [
      { title: "Distribuição", href: "/lancamentos", icon: Upload },
      { title: "Gestão de Shares", href: "/gestao-shares", icon: Share2 },
    ],
  },
  { title: "Contratos", href: "/contratos", icon: FileText },
  {
    title: "Financeiro",
    icon: DollarSign,
    children: [
      { title: "Transações", href: "/financeiro", icon: DollarSign },
      { title: "Contabilidade", href: "/contabilidade", icon: Calculator },
      { title: "Nota Fiscal", href: "/nota-fiscal", icon: Receipt },
    ],
  },
  { title: "Agenda", href: "/agenda", icon: Calendar },
  { title: "Inventário", href: "/inventario", icon: Package },
  { title: "LanderZap", href: "/lander", icon: MessageCircle },
  { title: "CRM", href: "/crm", icon: Contact },
  { title: "Leads", href: "/leads", icon: UserPlus },
  { title: "Recursos Humanos", href: "/rh", icon: Briefcase },
  {
    title: "Marketing",
    icon: Megaphone,
    children: [
      { title: "Visão Geral", href: "/marketing/visao-geral", icon: Eye },
      { title: "Campanhas", href: "/marketing/campanhas", icon: Target },
      { title: "Calendário de Conteúdo", href: "/marketing/calendario", icon: CalendarDays },
      { title: "Métricas e Resultados", href: "/marketing/metricas", icon: TrendingUp },
      { title: "Central de Briefing", href: "/marketing/briefing", icon: FileEdit },
      { title: "Tarefas", href: "/marketing/tarefas", icon: ListChecks },
      { title: "IA Criativa", href: "/marketing/ia-criativa", icon: Sparkles },
    ],
  },
];

const bottomItems: NavItem[] = [];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const location = useLocation();

  const adminItems: NavItem[] = useMemo(
    () =>
      isAdmin
        ? [{ title: "Auditoria", href: "/auditoria", icon: ClipboardCheck }]
        : [],
    [isAdmin],
  );

  // Get user display info
  const userEmail = user?.email || "";
  const userFullName = user?.user_metadata?.full_name || "Usuário";
  const userInitials = userFullName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";
  // Comportamento acordeão: apenas um menu aberto por vez
  const toggleMenu = (title: string) => {
    setOpenMenus((prev) =>
      prev.includes(title) ? [] : [title]
    );
  };

  const isActive = (href: string) => location.pathname === href;
  const isChildActive = (children?: NavItem["children"]) =>
    children?.some((child) => location.pathname === child.href);

  const renderNavItem = (item: NavItem) => {
    if (item.children) {
      const isOpen = openMenus.includes(item.title);
      const hasActiveChild = isChildActive(item.children);

      return (
        <Collapsible key={item.title} open={isOpen} onOpenChange={() => toggleMenu(item.title)}>
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                hasActiveChild && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{item.title}</span>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </>
              )}
            </button>
          </CollapsibleTrigger>
          {!collapsed && (
            <CollapsibleContent className="pl-4 pt-1">
              {item.children.map((child) => (
                <Link
                  key={child.href}
                  to={child.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive(child.href) &&
                      "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <child.icon className="h-4 w-4 shrink-0" />
                  <span>{child.title}</span>
                </Link>
              ))}
            </CollapsibleContent>
          )}
        </Collapsible>
      );
    }

    return (
      <Link
        key={item.href}
        to={item.href!}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive(item.href!) &&
            "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
        data-testid={`nav-link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="flex-1">{item.title}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              L
            </div>
            <span className="font-bold text-lg">LANDER 360º</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map(renderNavItem)}
        {adminItems.length > 0 && (
          <>
            {!collapsed && (
              <p className="pt-3 pb-1 px-3 text-xs font-semibold uppercase text-muted-foreground">
                Administração
              </p>
            )}
            {adminItems.map(renderNavItem)}
          </>
        )}
      </nav>

      {/* User Menu */}
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}>
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.user_metadata?.avatar_url || ""} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 text-left overflow-hidden">
                  <p className="truncate font-medium">{userFullName}</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{userFullName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/perfil" className="cursor-pointer">
                <User className="h-4 w-4 mr-2" />
                Meu Perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/configuracoes" className="cursor-pointer">
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()} className="text-red-600 cursor-pointer">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </aside>
  );
}
