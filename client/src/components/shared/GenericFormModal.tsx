import { ReactNode, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type FieldType = "text" | "email" | "tel" | "number" | "date" | "select" | "textarea" | "custom";

export type FormField = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  render?: (value: unknown, onChange: (value: unknown) => void) => ReactNode;
  gridCols?: 1 | 2; // For spanning columns
  mask?: (value: string) => string;
  validate?: (value: unknown) => string | undefined;
};

type GenericFormModalProps<T> = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: T) => Promise<void> | void;
  title: string;
  fields: FormField[];
  initialData?: Partial<T>;
  isLoading?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
};

export function GenericFormModal<T extends Record<string, unknown>>({
  open,
  onClose,
  onSubmit,
  title,
  fields,
  initialData = {},
  isLoading = false,
  submitLabel = "Salvar",
  cancelLabel = "Cancelar",
}: GenericFormModalProps<T>) {
  const [formData, setFormData] = useState<Record<string, unknown>>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (key: string, value: unknown, field: FormField) => {
    let processedValue = value;
    
    if (field.mask && typeof value === "string") {
      processedValue = field.mask(value);
    }

    setFormData((prev) => ({ ...prev, [key]: processedValue }));
    
    // Clear error when field changes
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    fields.forEach((field) => {
      const value = formData[field.key];
      
      // Required validation
      if (field.required && (value === undefined || value === null || value === "")) {
        newErrors[field.key] = `${field.label} é obrigatório`;
        return;
      }

      // Custom validation
      if (field.validate && value) {
        const error = field.validate(value);
        if (error) {
          newErrors[field.key] = error;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData as T);
      onClose();
      setFormData({});
    } catch (error) {
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({});
    setErrors({});
    onClose();
  };

  const renderField = (field: FormField) => {
    const value = formData[field.key];
    const error = errors[field.key];

    switch (field.type) {
      case "select":
        return (
          <Select
            value={String(value || "")}
            onValueChange={(v) => handleChange(field.key, v, field)}
          >
            <SelectTrigger className={cn(error && "border-destructive")}>
              <SelectValue placeholder={field.placeholder || `Selecione ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "date":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !value && "text-muted-foreground",
                  error && "border-destructive"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {value ? format(new Date(value as string), "PPP", { locale: ptBR }) : "Selecione uma data"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value ? new Date(value as string) : undefined}
                onSelect={(date) => handleChange(field.key, date?.toISOString().split("T")[0], field)}
                locale={ptBR}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );

      case "textarea":
        return (
          <Textarea
            value={String(value || "")}
            onChange={(e) => handleChange(field.key, e.target.value, field)}
            placeholder={field.placeholder}
            className={cn("min-h-[80px]", error && "border-destructive")}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            value={value !== undefined ? String(value) : ""}
            onChange={(e) => handleChange(field.key, parseFloat(e.target.value) || 0, field)}
            placeholder={field.placeholder}
            className={cn(error && "border-destructive")}
            step="0.01"
          />
        );

      case "custom":
        return field.render?.(value, (v) => handleChange(field.key, v, field));

      default:
        return (
          <Input
            type={field.type}
            value={String(value || "")}
            onChange={(e) => handleChange(field.key, e.target.value, field)}
            placeholder={field.placeholder}
            className={cn(error && "border-destructive")}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {fields.map((field) => (
              <div
                key={field.key}
                className={cn(
                  "space-y-2",
                  field.gridCols === 2 && "col-span-2"
                )}
              >
                <Label htmlFor={field.key}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
                {renderField(field)}
                {errors[field.key] && (
                  <p className="text-xs text-destructive">{errors[field.key]}</p>
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {(isSubmitting || isLoading) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
