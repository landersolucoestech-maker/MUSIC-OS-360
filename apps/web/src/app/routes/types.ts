/**
 * Types shared by the modular routing system.
 */
import type { ReactNode } from "react";

/** Componente wrapper de Suspense/ErrorBoundary usado nas route configs. */
export type SuspenseRouteComponent = React.ComponentType<{ children: ReactNode }>;
