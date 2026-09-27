import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

/**
 * Badge — SINGLE source of styling for the app's badges/tags/chips/status.
 *
 * Only 5 canonical variants (success | info | warning | danger | neutral),
 * with a default palette and guaranteed contrast (light background → dark text).
 * No screen should apply badge color classes manually — always go
 * through here (via `variant`) or through the `StatusBadge` semantic resolver.
 *
 * The legacy names (default/secondary/destructive/outline/muted) are kept
 * as aliases of the 5 canonical ones so existing calls do not break.
 */
const badgeVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md border border-transparent px-2 py-0.5 text-xs font-medium leading-none transition-colors",
  {
    variants: {
      variant: {
        // ── 5 canonical variants ──────────────────────────────────────────
        success: "bg-success-soft text-success",
        info: "bg-info-soft text-info",
        warning: "bg-warning-soft text-warning",
        danger: "bg-destructive-soft text-destructive",
        neutral: "bg-muted text-muted-foreground",
        // ── Legacy aliases (mapped to the canonical ones) ──────────────────
        destructive: "bg-destructive-soft text-destructive",
        default: "bg-muted text-muted-foreground",
        secondary: "bg-muted text-muted-foreground",
        outline: "bg-muted text-muted-foreground",
        muted: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

/** The 5 canonical variants allowed for badges/status. */
export type BadgeVariant = "success" | "info" | "warning" | "danger" | "neutral";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
