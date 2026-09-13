import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { FieldError } from "@/shared/components/FormField";

interface Option {
  value: string;
  label: string;
}

interface FormSelectFieldProps {
  label:       string;
  value:       string;
  onChange:    (value: string) => void;
  options:     Option[];
  placeholder?: string;
  error?:      string;
  disabled?:   boolean;
  required?:   boolean;
}

export function FormSelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled,
  required,
}: FormSelectFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">
        {label}
        {required && " *"}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={error ? "border-destructive" : ""}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError error={error} />
    </div>
  );
}
