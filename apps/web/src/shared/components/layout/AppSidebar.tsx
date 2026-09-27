import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthContext";
import { useTenant } from "@/app/providers/TenantContext";
import { PLAN_LABEL } from "@/app/providers/tenant-labels";
import { useIsAdmin } from "@/shared/hooks/useIsAdmin";
import { useCurrentRole } from "@/shared/hooks/useHasRole";
import { formatPersonName } from "@/shared/lib/format-name";
import {
  LayoutDashboard,
  Users,
  Folder,
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
  PanelLeftClose,
  PanelLeft,
  Upload,
  Shield,
  AlertTriangle,
  Briefcase,
  Share2,
  Receipt,
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
  ChevronsUpDown,
  CheckCircle2,
  Activity,
  HeadphonesIcon,
  MessagesSquare,
  BookOpen,
  ServerCrash,
  Mic2,
  Video,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { CompanyLogo } from "@/shared/ui/company-logo";
import { SystemLogo } from "@/shared/ui/system-logo";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";

import type { FeatureFlags } from "@/shared/lib/feature-flags";

interface NavItem {
  title: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** If set, the item only shows when this feature flag is active. */
  featureFlag?: keyof FeatureFlags;
  children?: {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    featureFlag?: keyof FeatureFlags;
  }[];
}

const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard",    href: "/dashboard",  icon: LayoutDashboard },
  { title: "Artistas",        href: "/artists",   icon: Users,        featureFlag: "moduleArtists" },
  {
    title: "Catálogo",
    icon: Music,
    featureFlag: "moduleCatalog",
    children: [
      { title: "Projetos",           href: "/projects",          icon: Folder, featureFlag: "moduleProjects" },
      { title: "Obras & Fonogramas", href: "/music-registration",   icon: Music },
      { title: "Monitoramento",      href: "/rights-monitoring",  icon: Radio,         featureFlag: "moduleMonitoring" },
      { title: "Licenciamento",      href: "/licensing",      icon: Shield,        featureFlag: "moduleLicensing" },
      { title: "Takedowns",          href: "/takedowns",          icon: AlertTriangle, featureFlag: "moduleMonitoring" },
    ],
  },
  {
    title: "Lançamentos",
    icon: Radio,
    featureFlag: "moduleReleases",
    children: [
      { title: "Distribuição",    href: "/releases",   icon: Upload },
      { title: "Gestão de Shares", href: "/shares", icon: Share2 },
    ],
  },
  { title: "Contratos", href: "/contracts", icon: FileText, featureFlag: "moduleContracts" },
  { title: "Audiovisual", href: "/audiovisual", icon: Video },
  {
    title: "Financeiro",
    icon: DollarSign,
    featureFlag: "moduleAccounting",
    children: [
      { title: "Transações",   href: "/accounting",                  icon: DollarSign },
      { title: "Contabilidade", href: "/accounting/profit-and-loss",   icon: BookOpen },
      { title: "Nota Fiscal",  href: "/accounting/invoices",      icon: Receipt },
    ],
  },
  { title: "Agenda",           href: "/agenda",     icon: Calendar,      featureFlag: "moduleEvents" },
  { title: "Inventário",       href: "/inventory", icon: Package,       featureFlag: "moduleInventory" },
  { title: "MusicChat",        href: "/chat",       icon: MessageCircle },
  { title: "CRM", href: "/leads", icon: Contact, featureFlag: "moduleCrm" },
  { title: "RH",               href: "/hr",         icon: Briefcase,     featureFlag: "moduleRh" },
  {
    title: "Marketing",
    icon: Megaphone,
    featureFlag: "moduleMarketing",
    children: [
      { title: "Visão Geral",          href: "/marketing/overview", icon: Eye },
      { title: "Campanhas",            href: "/marketing/campaigns",   icon: Target },
      { title: "Calendário de Conteúdo", href: "/marketing/calendar", icon: CalendarDays },
      { title: "Tarefas",              href: "/marketing/tasks",     icon: ListChecks },
      { title: "Métricas",             href: "/marketing/metrics",    icon: TrendingUp },
      { title: "Briefing",             href: "/marketing/briefing",    icon: FileEdit },
      { title: "IA Criativa",          href: "/marketing/creative-ai", icon: Sparkles },
    ],
  },
  { title: "Relatórios",       href: "/reports", icon: Activity },
  { title: "Suporte", href: "/support", icon: HeadphonesIcon },
];

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { tenant, isFeatureEnabled } = useTenant();
  const { isAdmin } = useIsAdmin();
  const currentRole = useCurrentRole();
  const isSuperAdmin = currentRole === "super_admin" || currentRole === "owner" || currentRole === "tenant_owner";
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const location = useLocation();


  const visibleNavItems = useMemo(
    () => NAV_ITEMS.flatMap((item) => {
      if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) return [];
      if (!item.children) return [item];
      const visibleChildren = item.children.filter(
        (c) => !c.featureFlag || isFeatureEnabled(c.featureFlag),
      );
      if (visibleChildren.length === 0) return [];
      return [{ ...item, children: visibleChildren }];
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isFeatureEnabled],
  );

  const adminItems: NavItem[] = useMemo(
    () => {
      const items: NavItem[] = [];
      if (isSuperAdmin) items.push({ title: "Painel Admin", href: "/admin/dashboard", icon: Shield });
      return items;
    },
    [isAdmin, isSuperAdmin],
  );

  const sidebarNavItems = useMemo(() => {
    const canShowAudit =
      isAdmin;
    if (!canShowAudit) return visibleNavItems;

    const auditItem: NavItem = {
      title: "Auditoria",
      href: "/audit",
      icon: ClipboardCheck,
    };
    const supportIndex = visibleNavItems.findIndex(
      (item) => item.href === "/support",
    );
    if (supportIndex < 0) return [...visibleNavItems, auditItem];

    return [
      ...visibleNavItems.slice(0, supportIndex),
      auditItem,
      ...visibleNavItems.slice(supportIndex),
    ];
  }, [visibleNavItems, isAdmin]);

  const userFullName = formatPersonName(user?.user_metadata?.full_name as string, "Usuário");
  const userEmail = user?.email ?? "";
  const userInitials =
    userFullName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  // Auto-expand group when a child route is active
  useEffect(() => {
    const activeGroup = NAV_ITEMS.find(
      (item) =>
        item.children?.some((c) => location.pathname.startsWith(c.href ?? "")),
    );
    if (activeGroup) {
      setOpenMenus((prev) =>
        prev.includes(activeGroup.title) ? prev : [...prev, activeGroup.title],
      );
    }
  }, [location.pathname]);

  const toggleMenu = (title: string) =>
    setOpenMenus((prev) => (prev.includes(title) ? [] : [title]));

  const isActive = (href: string) => location.pathname === href;
  const isChildActive = (children?: NavItem["children"]) =>
    children?.some((c) => location.pathname === c.href);

  const renderNavItem = (item: NavItem) => {
    if (item.children) {
      const isOpen = openMenus.includes(item.title);
      const hasActive = isChildActive(item.children);

      return (
        <Collapsible
          key={item.title}
          open={isOpen}
          onOpenChange={() => toggleMenu(item.title)}
        >
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-[5px]",
                "text-[12px] font-medium transition-colors duration-100",
                "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                hasActive && "text-sidebar-foreground/90",
              )}
            >
              <item.icon
                className={cn(
                  "h-[15px] w-[15px] shrink-0",
                  hasActive ? "text-sidebar-primary" : "opacity-60",
                )}
              />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{item.title}</span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 opacity-40 transition-transform duration-150",
                      isOpen && "rotate-180",
                    )}
                  />
                </>
              )}
            </button>
          </CollapsibleTrigger>

          {!collapsed && (
            <CollapsibleContent className="mt-0.5 space-y-px">
              <div className="ml-[23px] border-l border-sidebar-border/70 pl-2.5 space-y-px">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    to={child.href}
                    className={cn(
                      "flex items-center gap-2 rounded-[5px] px-2 py-[5px]",
                      "text-[12px] transition-colors duration-100",
                      isActive(child.href)
                        ? "bg-sidebar-active text-sidebar-active-foreground font-semibold"
                        : "text-sidebar-foreground/55 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                    )}
                  >
                    <child.icon
                      className={cn(
                        "h-[13px] w-[13px] shrink-0",
                        isActive(child.href)
                          ? "text-sidebar-primary"
                          : "opacity-50",
                      )}
                    />
                    <span>{child.title}</span>
                    {isActive(child.href) && (
                      <span className="ml-auto h-1.5 w-1.5 bg-sidebar-primary shrink-0" />
                    )}
                  </Link>
                ))}
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      );
    }

    const active = isActive(item.href!);
    return (
      <Link
        key={item.href}
        to={item.href!}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-[5px]",
          "text-[12px] font-medium transition-colors duration-100",
          active
            ? "bg-sidebar-active text-sidebar-active-foreground font-semibold"
            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
        )}
        data-testid={`nav-link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <item.icon
          className={cn(
            "h-[15px] w-[15px] shrink-0",
            active ? "text-sidebar-primary" : "opacity-55",
          )}
        />
        {!collapsed && (
          <>
            <span className="flex-1">{item.title}</span>
            {active && (
              <span className="h-1.5 w-1.5 bg-sidebar-primary shrink-0" />
            )}
          </>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen flex-col bg-sidebar",
        "border-r border-sidebar-border",
        "transition-[width] duration-200 ease-out shrink-0",
        collapsed ? "w-[52px]" : "w-[232px]",
      )}
    >
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border px-3",
          collapsed
            ? "h-[52px] justify-center"
            : "h-[64px] justify-between gap-2",
        )}
      >
        <div className="flex min-w-0 items-center">
          <SystemLogo
            collapsed={collapsed}
            subtitle="ERP OPERACIONAL MUSICAL"
            markClassName={collapsed ? "h-7" : "h-8"}
          />
        </div>

        {!collapsed && (
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(true)}
              className="h-7 w-7 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              data-testid="button-sidebar-collapse"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(false)}
            className="h-7 w-7 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            data-testid="button-sidebar-expand"
          >
            <PanelLeft className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {!collapsed && (
        <div className="px-2.5 pt-1.5 pb-2 border-b border-sidebar-border">
          <p className="text-[8px] font-semibold text-sidebar-foreground/30  tracking-[0.14em] px-1 pb-1">Organização</p>
          <div
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5",
              "bg-sidebar-secondary border border-sidebar-border/60",
              "cursor-default select-none",
            )}
          >
            <CompanyLogo
              name={tenant.name}
              logoUrl={tenant.config.logoUrl}
              className="h-6 w-6 rounded border-primary/15 shrink-0"
              textClassName="text-[9px]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-sidebar-foreground leading-none truncate">
                {tenant.name}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-[9px] font-bold  tracking-[0.08em]",
                    "px-1 py-px rounded-sm",
                    tenant.plan === "enterprise"
                      ? "bg-primary/80 text-primary-foreground border border-primary-foreground/20"
                      : tenant.plan === "professional"
                        ? "bg-primary/12 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  <CheckCircle2 className="h-2 w-2" />
                  {PLAN_LABEL[tenant.plan]}
                </span>
              </div>
            </div>
            <ChevronsUpDown className="h-3 w-3 text-sidebar-foreground/25 shrink-0" />
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-px">
        {sidebarNavItems.map(renderNavItem)}
        {adminItems.length > 0 && (
          <>
            <div className="my-2 mx-1 border-t border-sidebar-border/60" />
            {adminItems.map(renderNavItem)}
          </>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5",
                "text-sidebar-foreground/60 transition-colors duration-100",
                "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed && "justify-center",
              )}
            >
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarImage
                  src={(user?.user_metadata?.avatar_url as string) || ""}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold border border-primary/15">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-[12px] font-medium truncate leading-none text-sidebar-foreground">
                    {userFullName}
                  </p>
                  <p className="text-[10px] text-sidebar-foreground/38 truncate leading-none mt-0.5">
                    {userEmail}
                  </p>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-52">
            <div className="px-2 py-2">
              <p className="text-[12px] font-semibold">{userFullName}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {userEmail}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" className="cursor-pointer text-sm">
                <User className="h-3.5 w-3.5 mr-2 opacity-60" />
                Meu Perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer text-sm">
                <Settings className="h-3.5 w-3.5 mr-2 opacity-60" />
                Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-destructive cursor-pointer focus:text-destructive text-sm"
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
