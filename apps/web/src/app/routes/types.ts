/**
 * Types shared by the modular routing system.
 */
import type { ReactNode } from "react";

/** Suspense/ErrorBoundary wrapper component used in the route configs. */
export type SuspenseRouteComponent = React.ComponentType<{ children: ReactNode }>;
