import { Label } from "@/shared/ui/label";
import { DatePickerField } from "@/shared/ui/date-picker-field";
import { FieldError } from "@/shared/components/FormField";

interface FormDateFieldProps {
  label:       string;
  value:       string;
  onChange:    (iso: string) => void;
  error?:      string;
  disabled?:   boolean;
  required?:   boolean;
  placeholder?: string;
  "data-testid"?: string;
}

export function FormDateField({
  label,
  value,
  onChange,
  error,
  disabled,
  required,
  placeholder,
  "data-testid": testId,
}: FormDateFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">
        {label}
        {required && " *"}
      </Label>
      <DatePickerField
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className={error ? "border-destructive" : ""}
        data-testid={testId}
      />
      <FieldError error={error} />
    </div>
  );
}
