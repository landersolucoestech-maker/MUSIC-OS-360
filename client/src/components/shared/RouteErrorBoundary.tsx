import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ErrorBoundary } from "./ErrorBoundary";
import { ErrorFallback } from "./ErrorFallback";

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

export function RouteErrorBoundary({ children }: RouteErrorBoundaryProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate("/");
  };

  return (
    <ErrorBoundary
      key={location.pathname}
      fallback={
        <div className="flex-1 p-6">
          <ErrorFallback
            onRetry={() => window.location.reload()}
            onGoHome={handleGoHome}
          />
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
