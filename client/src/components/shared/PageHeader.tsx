import { Button } from "@/components/ui/button";
import { Download, Upload, Plus } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: {
    import?: boolean;
    export?: boolean;
    onImport?: () => void;
    onExport?: () => void;
    new?: { label: string; onClick?: () => void };
    custom?: React.ReactNode;
  };
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">
          {actions.import && (
            <Button variant="outline" size="sm" onClick={actions.onImport}>
              <Upload className="mr-2 h-4 w-4" />
              Importar
            </Button>
          )}
          {actions.export && (
            <Button variant="outline" size="sm" onClick={actions.onExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          )}
          {actions.custom}
          {actions.new && (
            <Button size="sm" onClick={actions.new.onClick}>
              <Plus className="mr-2 h-4 w-4" />
              {actions.new.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
