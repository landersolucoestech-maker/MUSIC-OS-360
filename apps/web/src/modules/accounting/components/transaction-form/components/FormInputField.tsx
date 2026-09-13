import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { FieldError } from "@/shared/components/FormField";
import { cn } from "@/shared/lib/utils";

interface FormInputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label:        string;
  error?:       string;
  required?:    boolean;
  hint?:        string;
  colSpan?:     "full" | "half";
}

export function FormInputField({
  label,
  error,
  required,
  hint,
  colSpan,
  className,
  ...inputProps
}: FormInputFieldProps) {
  return (
    <div className={cn("space-y-2", colSpan === "full" && "md:col-span-2")}>
      <Label className="text-sm">
        {label}
        {required && " *"}
      </Label>
      <Input
        className={cn(error ? "border-destructive" : "", className)}
        {...inputProps}
      />
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      <FieldError error={error} />
    </div>
  );
}
