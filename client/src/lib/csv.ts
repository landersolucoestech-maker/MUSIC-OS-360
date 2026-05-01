// CSV Import/Export utilities
import { toast } from "sonner";

export interface CSVColumn {
  key: string;
  label: string;
}

// Export data to CSV
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: CSVColumn[],
  filename: string
): void {
  if (data.length === 0) {
    toast.error("Nenhum dado para exportar");
    return;
  }

  // Create header row
  const headers = columns.map(col => col.label).join(";");
  
  // Create data rows
  const rows = data.map(item => 
    columns.map(col => {
      const value = item[col.key];
      // Handle values that might contain semicolons or quotes
      if (value === null || value === undefined) return "";
      const stringValue = String(value);
      if (stringValue.includes(";") || stringValue.includes('"') || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(";")
  );

  // Combine headers and rows
  const csvContent = [headers, ...rows].join("\n");
  
  // Add BOM for Excel compatibility with UTF-8
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  
  // Create download link
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  toast.success(`${data.length} registro(s) exportado(s) com sucesso!`);
}

// Parse CSV file
export function parseCSV(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length < 2) {
          reject(new Error("Arquivo CSV deve ter pelo menos um cabeçalho e uma linha de dados"));
          return;
        }
        
        // Parse header - support both comma and semicolon as delimiter
        const delimiter = lines[0].includes(";") ? ";" : ",";
        const headers = parseCSVLine(lines[0], delimiter);
        
        // Parse data rows
        const data: Record<string, string>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i], delimiter);
          const row: Record<string, string> = {};
          headers.forEach((header, index) => {
            row[header.trim()] = values[index]?.trim() || "";
          });
          data.push(row);
        }
        
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
    reader.readAsText(file);
  });
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  
  result.push(current);
  return result;
}

// Import CSV with file picker
export function importCSV(
  onImport: (data: Record<string, string>[]) => void | Promise<void>,
  acceptedHeaders?: string[]
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv";
  
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    
    try {
      const data = await parseCSV(file);
      
      if (data.length === 0) {
        toast.error("Arquivo CSV está vazio");
        return;
      }
      
      if (acceptedHeaders && acceptedHeaders.length > 0) {
        const fileHeaders = Object.keys(data[0]);
        const missingHeaders = acceptedHeaders.filter(h => !fileHeaders.includes(h));
        if (missingHeaders.length > 0) {
          toast.warning(`Colunas faltando: ${missingHeaders.join(", ")}`);
        }
      }
      
      await onImport(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao importar CSV");
    }
  };
  
  input.click();
}
