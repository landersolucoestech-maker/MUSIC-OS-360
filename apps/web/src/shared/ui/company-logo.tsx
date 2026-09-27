import { cn } from "@/shared/lib/utils";

/**
 * CompanyLogo — the organization's visual identity with automatic fallback.
 *
 * - If `logoUrl` exists: renders the image with object-contain (no cropping /
 *   no distortion / keeps the aspect ratio).
 * - Otherwise: renders the company name initials (placeholder).
 *
 * Used in public and private areas that depend on the company identity.
 */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

interface CompanyLogoProps {
  name: string;
  logoUrl?: string | null;
  /** Container classes (size/radius/etc). */
  className?: string;
  /** Fallback text classes (initials). */
  textClassName?: string;
}

export function CompanyLogo({ name, logoUrl, className, textClassName }: CompanyLogoProps) {
  const base =
    "flex items-center justify-center overflow-hidden rounded-xl border border-primary/20 bg-primary/10";

  if (logoUrl) {
    return (
      <div className={cn(base, className)}>
        <img
          src={logoUrl}
          alt={name}
          className="h-full w-full object-contain"
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className={cn(base, className)}>
      <span className={cn("font-bold tracking-tight text-primary", textClassName)}>
        {initialsOf(name)}
      </span>
    </div>
  );
}
