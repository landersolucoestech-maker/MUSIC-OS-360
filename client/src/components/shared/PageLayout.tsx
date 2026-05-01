import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { LucideIcon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type PageLayoutProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
  actions?: ReactNode;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
};

export function PageLayout({
  title,
  description,
  icon: Icon,
  children,
  actions,
  onRefresh,
  isRefreshing,
  className,
}: PageLayoutProps) {
  return (
    <MainLayout>
      <div className={cn("p-4 space-y-4 animate-fade-in", className)}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="shrink-0"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            )}
            {actions}
          </div>
        </div>

        {children}
      </div>
    </MainLayout>
  );
}

// Section component for consistent spacing
type SectionProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
};

export function Section({ title, description, children, className, actions }: SectionProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {(title || description || actions) && (
        <div className="flex items-center justify-between">
          <div>
            {title && <h2 className="text-lg font-semibold text-foreground">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}
