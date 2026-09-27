import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api-client";
import { Link } from "react-router-dom";
import { AppSidebar } from "./layout/AppSidebar";
import { cn } from "@/shared/lib/utils";
import { compareTableValues, isActionsColumn } from "@/shared/lib/table-sort";
import { useAuth } from "@/app/providers/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
import {
  Bell,
  HelpCircle,
  ChevronDown,
  User,
  Settings,
  LogOut,
  CheckCheck,
} from "lucide-react";
import { useSyncTenantFromJWT } from "@/app/providers/TenantContext";
import { TrialBanner } from "@/shared/components/TrialBanner";

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  noPadding?: boolean;
}

// Stable reference — see shared/hooks/useDataQuery.ts for the reason.
const EMPTY_NOTIFICATIONS: Array<{ id: string; title: string; body: string | null; read_at: string | null; created_at: string }> = [];

const ROLE_LABEL: Record<string, string> = {
  owner:        "Proprietário",
  tenant_owner: "Proprietário",
  admin:        "Administrador",
  manager:      "Gerente",
  editor:       "Editor",
  viewer:       "Visualizador",
};

function normalizeNativeTableSortIndicators(table: HTMLTableElement, activeTh: HTMLTableCellElement, direction: "asc" | "desc") {
  table.querySelectorAll("th[data-native-sortable='true']").forEach((header) => {
    const th = header as HTMLTableCellElement;
    const indicator = th.querySelector<HTMLElement>("[data-sort-indicator='true']");
    if (th === activeTh) {
      th.dataset.sortDirection = direction;
      if (indicator) indicator.textContent = direction === "asc" ? "↑" : "↓";
      return;
    }
    delete th.dataset.sortDirection;
    if (indicator) indicator.textContent = "↕";
  });
}

function prepareNativeTableHead(th: HTMLTableCellElement) {
  if (th.dataset.nativeSortable === "true") return;
  const label = th.textContent?.trim() ?? "";
  if (!label || isActionsColumn(label) || th.querySelector('[role="checkbox"], input, button, [data-no-sort="true"]')) return;

  th.dataset.nativeSortable = "true";
  th.classList.add("cursor-pointer", "select-none");
  if (!th.querySelector("[data-sort-indicator='true']")) {
    const indicator = document.createElement("span");
    indicator.dataset.sortIndicator = "true";
    indicator.textContent = "↕";
    indicator.className = "ml-1.5 inline-block text-[11px] opacity-55";
    th.appendChild(indicator);
  }
}

function sortNativeTable(table: HTMLTableElement, th: HTMLTableCellElement) {
  const tbody = table.tBodies[0];
  if (!tbody) return;

  const index = th.cellIndex;
  const current = th.dataset.sortDirection;
  const direction: "asc" | "desc" = current === "asc" ? "desc" : "asc";
  const rows = Array.from(tbody.rows);

  rows.sort((a, b) => {
    const aValue = a.cells[index]?.textContent?.trim() ?? "";
    const bValue = b.cells[index]?.textContent?.trim() ?? "";
    return compareTableValues(aValue, bValue) * (direction === "asc" ? 1 : -1);
  });

  rows.forEach((row) => tbody.appendChild(row));
  normalizeNativeTableSortIndicators(table, th, direction);
}

function TopbarUserMenu() {
  const { user, signOut } = useAuth();

  const userFullName = (user?.user_metadata?.full_name as string) || "Usuário";
  const userEmail = user?.email ?? "";
  const userRole = (user?.user_metadata?.role as string) || (user as Record<string, unknown>)?.role as string || "";
  const roleLabel = ROLE_LABEL[userRole] || "Usuário";
  const userInitials = userFullName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";
  const avatarUrl = (user?.user_metadata?.avatar_url as string) || "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="button-topbar-user-menu"
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5",
            "text-foreground/80 transition-colors duration-100",
            "hover:bg-muted hover:text-foreground",
            "border border-transparent hover:border-border/50",
            "focus:outline-none",
          )}
        >
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="text-left hidden sm:block">
            <p className="text-[12px] font-semibold leading-none text-foreground">
              {userFullName}
            </p>
            <p className="text-[10px] text-muted-foreground leading-none mt-[3px]">
              {roleLabel}
            </p>
          </div>
          <ChevronDown className="h-3 w-3 text-muted-foreground/60 shrink-0 hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-2">
          <p className="text-[12px] font-semibold">{userFullName}</p>
          <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/perfil" className="cursor-pointer text-sm">
            <User className="h-3.5 w-3.5 mr-2 opacity-60" />
            Meu Perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/configuracoes" className="cursor-pointer text-sm">
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
  );
}

function NotificationsPopover() {
  // Real backend notifications (/notifications). No fictitious data:
  // error or unavailable backend ⇒ empty list (true state).
  const queryClient = useQueryClient();
  const { data: rawNotifications = EMPTY_NOTIFICATIONS } = useQuery({
    queryKey: ["notifications", "topbar"],
    queryFn: async () => {
      const res = await api.get<{ data?: Array<{ id: string; title: string; body: string | null; read_at: string | null; created_at: string }> } | Array<{ id: string; title: string; body: string | null; read_at: string | null; created_at: string }>>("/notifications?limit=10");
      return Array.isArray(res) ? res : res?.data ?? [];
    },
    staleTime: 60_000,
    retry: false,
  });
  const notifications = rawNotifications.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body ?? "",
    time: new Date(n.created_at).toLocaleString("pt-BR"),
    read: n.read_at != null,
  }));
  const unread = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all", {});
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch {
      // erro real é reportado pelo interceptor do api-client
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-testid="button-topbar-notifications"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-[13px] font-semibold">Notificações</p>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <CheckCheck className="h-3 w-3" />
              Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="divide-y divide-border">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 px-4 py-3 transition-colors",
                !n.read && "bg-primary/[0.04]",
              )}
            >
              {!n.read && (
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              )}
              {n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium leading-none">{n.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{n.body}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">{n.time}</p>
              </div>
            </div>
          ))}
        </div>
        {notifications.length === 0 && (
          <p className="text-[12px] text-muted-foreground text-center py-6">
            Nenhuma notificação
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function MainLayout({
  children,
  title,
  description,
  actions,
  noPadding = false,
}: MainLayoutProps) {
  const { user } = useAuth();
  const userEmail = user?.email ?? "";
  useSyncTenantFromJWT(userEmail || undefined);

  useEffect(() => {
    if (window.location.pathname.includes("/artistas")) return;

    const tables = Array.from(document.querySelectorAll<HTMLTableElement>("table:not([data-shared-table='true'])"));
    tables.forEach((table) => {
      Array.from(table.tHead?.rows[0]?.cells ?? []).forEach(prepareNativeTableHead);
    });

    const handleClick = (event: MouseEvent) => {
      const th = (event.target as HTMLElement | null)?.closest("th[data-native-sortable='true']");
      if (!th) return;
      const table = th.closest("table");
      if (!table || table.dataset.sharedTable === "true") return;
      sortNativeTable(table, th as HTMLTableCellElement);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [children]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">

        {/* ── Global Topbar ──────────────────────────────────────────────── */}
        <header className={cn(
          "flex h-[52px] items-center gap-3 shrink-0 px-4",
          "border-b border-border/70",
          "bg-background/95 ",
          "sticky top-0 z-[200]",
        )}>
          {/* Left: page title/description */}
          <div className="flex-1 min-w-0 flex items-center">
            {(title || description) ? (
              <div className="min-w-0 flex flex-col justify-center">
                {title && (
                  <h1 className="text-[13px] font-semibold tracking-tight text-foreground leading-none">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="text-[11px] text-muted-foreground leading-none mt-1 truncate">
                    {description}
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {/* Right: actions + notifications + help + user */}
          <div className="flex items-center gap-1 shrink-0">
            {actions && (
              <>
                <div className="flex items-center gap-2 mr-2">{actions}</div>
                <div className="w-px h-5 bg-border/60 mx-1" />
              </>
            )}

            <NotificationsPopover />

            <Link to="/support">
              <Button
                variant="ghost"
                size="icon"
                data-testid="button-topbar-help"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Suporte"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </Link>

            <div className="w-px h-5 bg-border/60 mx-1" />

            <TopbarUserMenu />
          </div>
        </header>

        <TrialBanner />

        {/* ── Content ────────────────────────────────────────────────────── */}
        <main className={cn(
          "flex-1 overflow-y-auto bg-muted/30",
          !noPadding && "px-5 py-5 md:px-6 md:py-6",
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}
