import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import { cn } from "@/shared/lib/utils";

/**
 * Reusable accordion built on the Radix Collapsible that already exists in the
 * project. Each `AccordionItem` is independent (several can be open at the
 * same time, each with its own toggle). Closed content is unmounted
 * by the Collapsible — the desired behavior for a large number of items.
 *
 * It can be used controlled (`open` + `onOpenChange`) or
 * uncontrolled (`defaultOpen`).
 */

function Accordion({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-3", className)} {...props} />;
}

interface AccordionItemContextValue {
  open: boolean;
}

const AccordionItemContext = React.createContext<AccordionItemContextValue>({ open: false });

interface AccordionItemProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: React.ReactNode;
}

function AccordionItem({ open, defaultOpen, onOpenChange, className, children }: AccordionItemProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const handleOpenChange = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <AccordionItemContext.Provider value={{ open: isOpen }}>
      <Collapsible
        open={isOpen}
        onOpenChange={handleOpenChange}
        className={cn("rounded-lg border border-border bg-card", className)}
      >
        {children}
      </Collapsible>
    </AccordionItemContext.Provider>
  );
}

const AccordionTrigger = React.forwardRef<HTMLButtonElement, React.HTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => {
    const { open } = React.useContext(AccordionItemContext);
    return (
      <CollapsibleTrigger asChild>
        <button
          ref={ref}
          type="button"
          className={cn(
            "flex w-full items-center justify-between gap-4 rounded-lg p-4 text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            className,
          )}
          {...props}
        >
          <div className="min-w-0 flex-1">{children}</div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      </CollapsibleTrigger>
    );
  },
);
AccordionTrigger.displayName = "AccordionTrigger";

function AccordionContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <CollapsibleContent className={cn("overflow-hidden", className)} {...props}>
      <div className="border-t border-border p-4">{children}</div>
    </CollapsibleContent>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
