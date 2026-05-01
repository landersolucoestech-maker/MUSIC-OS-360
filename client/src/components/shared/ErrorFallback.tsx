import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

interface ErrorFallbackProps {
  error?: Error | null;
  onRetry?: () => void;
  onGoHome?: () => void;
}

export function ErrorFallback({ error, onRetry, onGoHome }: ErrorFallbackProps) {
  const isDev = import.meta.env.DEV;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-6">
        <AlertTriangle className="h-12 w-12 text-destructive" />
      </div>
      
      <h2 className="text-2xl font-semibold text-foreground mb-2">
        Algo deu errado
      </h2>
      
      <p className="text-muted-foreground mb-6 max-w-md">
        Ocorreu um erro inesperado. Você pode tentar novamente ou voltar ao início.
      </p>

      {isDev && error && (
        <div className="bg-muted/50 border border-border rounded-lg p-4 mb-6 max-w-lg text-left">
          <p className="text-sm font-mono text-destructive break-all">
            {error.message}
          </p>
          {error.stack && (
            <pre className="text-xs text-muted-foreground mt-2 overflow-auto max-h-32">
              {error.stack}
            </pre>
          )}
        </div>
      )}

      <div className="flex gap-3">
        {onRetry && (
          <Button onClick={onRetry} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        )}
        {onGoHome && (
          <Button onClick={onGoHome} variant="outline">
            <Home className="h-4 w-4 mr-2" />
            Ir para o início
          </Button>
        )}
      </div>
    </div>
  );
}
