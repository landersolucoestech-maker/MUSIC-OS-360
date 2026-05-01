import { useState, useRef, useCallback } from "react";
import { Upload, X, FileText, Image, Music, File, Loader2, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useStorage } from "@/hooks/useStorage";
import { toast } from "sonner";

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  path: string;
  url?: string;
  preview?: string;
}

interface FileUploadProps {
  folder?: string;
  accept?: string;
  maxSize?: number; // in MB
  multiple?: boolean;
  disabled?: boolean;
  circular?: boolean; // Para avatar/foto circular
  onUploadComplete?: (files: UploadedFile[]) => void;
  onUploadError?: (error: string) => void;
  value?: UploadedFile[];
  onChange?: (files: UploadedFile[]) => void;
  className?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const getFileIcon = (type: string, fileName?: string): LucideIcon => {
  const ext = fileName?.split(".").pop()?.toLowerCase() || "";
  if (type.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return Image;
  if (type.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg"].includes(ext)) return Music;
  if (type.includes("pdf") || ext === "pdf") return FileText;
  return File;
};

// Verifica se o arquivo é válido baseado em tipo MIME ou extensão
const isFileTypeValid = (file: File, accept: string): boolean => {
  const acceptedTypes = accept.split(",").map((t) => t.trim().toLowerCase());
  const fileExt = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
  const mimeType = file.type.toLowerCase();

  return acceptedTypes.some((type) => {
    // Wildcard: image/*, audio/*
    if (type.endsWith("/*")) {
      const prefix = type.replace("/*", "/");
      if (mimeType && mimeType.startsWith(prefix)) return true;
      // Fallback por extensão se MIME estiver vazio
      if (!mimeType || mimeType === "application/octet-stream") {
        if (type === "image/*") {
          return [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"].includes(fileExt);
        }
        if (type === "audio/*") {
          return [".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac"].includes(fileExt);
        }
      }
      return false;
    }
    
    // Tipo MIME específico
    if (type.includes("/")) {
      if (mimeType === type) return true;
      // Fallback por extensão para tipos comuns
      if (!mimeType || mimeType === "application/octet-stream") {
        if (type === "application/pdf") return fileExt === ".pdf";
        if (type.includes("word") || type.includes("document")) {
          return [".doc", ".docx"].includes(fileExt);
        }
      }
      return false;
    }
    
    // Extensão direta (ex: .pdf, .jpg)
    if (type.startsWith(".")) {
      return fileExt === type;
    }
    
    // Fallback: verificar se extensão corresponde ao tipo
    return fileExt === `.${type}`;
  });
};

const getAcceptedTypesText = (accept?: string): string => {
  if (!accept) return "Todos os tipos";
  const types = accept.split(",").map((t) => {
    t = t.trim();
    if (t === "image/*") return "Imagens";
    if (t === "audio/*") return "Áudio";
    if (t === "application/pdf") return "PDF";
    if (t.includes("word")) return "Word";
    return t.replace(".", "").toUpperCase();
  });
  return types.join(", ");
};

export function FileUpload({
  folder = "geral",
  accept,
  maxSize = 50,
  multiple = false,
  disabled = false,
  circular = false,
  onUploadComplete,
  onUploadError,
  value = [],
  onChange,
  className,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, number>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, getPublicUrl } = useStorage();

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const files = Array.from(fileList);
      const validFiles: File[] = [];

      // Validate files
      for (const file of files) {
        // Check size
        if (file.size > maxSize * 1024 * 1024) {
          toast.error(`${file.name}: Arquivo muito grande (máx. ${maxSize}MB)`);
          onUploadError?.(`${file.name}: Arquivo muito grande`);
          continue;
        }

        // Check type if accept is specified
        if (accept) {
          if (!isFileTypeValid(file, accept)) {
            toast.error(`${file.name}: Tipo de arquivo não permitido`);
            onUploadError?.(`${file.name}: Tipo não permitido`);
            continue;
          }
        }

        validFiles.push(file);
      }

      if (!multiple && validFiles.length > 1) {
        validFiles.splice(1);
      }

      // Upload files
      const uploadedFiles: UploadedFile[] = [...value];

      for (const file of validFiles) {
        const fileId = `${file.name}-${Date.now()}`;
        setUploadingFiles((prev) => new Map(prev).set(fileId, 0));

        try {
          const result = await uploadFile(file, {
            folder,
            onProgress: (progress) => {
              setUploadingFiles((prev) => new Map(prev).set(fileId, progress));
            },
          });

          if (result) {
            const uploadedFile: UploadedFile = {
              name: file.name,
              size: file.size,
              type: file.type,
              path: result.path,
              url: getPublicUrl(result.path),
            };

            // Generate preview for images
            if (file.type.startsWith("image/")) {
              uploadedFile.preview = URL.createObjectURL(file);
            }

            if (!multiple) {
              uploadedFiles.length = 0;
            }
            uploadedFiles.push(uploadedFile);
          }
        } catch (error: any) {
          onUploadError?.(error.message);
        } finally {
          setUploadingFiles((prev) => {
            const next = new Map(prev);
            next.delete(fileId);
            return next;
          });
        }
      }

      onChange?.(uploadedFiles);
      if (uploadedFiles.length > value.length) {
        onUploadComplete?.(uploadedFiles);
      }
    },
    [accept, folder, maxSize, multiple, onChange, onUploadComplete, onUploadError, uploadFile, value]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (!disabled) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [disabled, handleFiles]
  );

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...value];
    const removed = newFiles.splice(index, 1)[0];
    
    // Revoke preview URL to free memory
    if (removed.preview) {
      URL.revokeObjectURL(removed.preview);
    }
    
    onChange?.(newFiles);
  };

  const isUploading = uploadingFiles.size > 0;

  // Modo circular com layout horizontal
  if (circular) {
    return (
      <div className={cn("flex items-center gap-4", className)}>
        {/* Círculo do upload ou preview */}
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative flex items-center justify-center w-24 h-24 rounded-full border-2 border-dashed transition-colors cursor-pointer flex-shrink-0",
            isDragOver && "border-primary bg-primary/5",
            !isDragOver && !disabled && "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
            disabled && "cursor-not-allowed opacity-50 bg-muted/20",
            isUploading && "pointer-events-none"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleInputChange}
            className="hidden"
            disabled={disabled}
          />

          {value.length > 0 && value[0].preview ? (
            <>
              <img
                src={value[0].preview}
                alt={value[0].name}
                className="w-full h-full rounded-full object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-1 -right-1 h-6 w-6 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(0);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          ) : isUploading ? (
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          ) : (
            <Upload className={cn("h-8 w-8", isDragOver ? "text-primary" : "text-muted-foreground")} />
          )}
        </div>

        {/* Texto e botão ao lado */}
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-sm font-medium text-foreground">
              Clique para adicionar a foto do artista
            </p>
            <p className="text-xs text-muted-foreground">
              Formatos aceitos: {getAcceptedTypesText(accept)} (máx. {maxSize}MB)
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClick}
            disabled={disabled || isUploading}
            className="w-fit"
          >
            <Upload className="h-4 w-4 mr-2" />
            Escolher Imagem
          </Button>
          
          {/* Upload progress */}
          {isUploading && (
            <div className="w-full max-w-xs">
              {Array.from(uploadingFiles.entries()).map(([id, progress]) => (
                <div key={id} className="space-y-1">
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">{progress}%</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop zone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 border-2 border-dashed transition-colors cursor-pointer rounded-lg p-6",
          isDragOver && "border-primary bg-primary/5",
          !isDragOver && !disabled && "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          disabled && "cursor-not-allowed opacity-50 bg-muted/20",
          isUploading && "pointer-events-none"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        {isUploading ? (
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
        ) : (
          <Upload className={cn("h-10 w-10", isDragOver ? "text-primary" : "text-muted-foreground")} />
        )}

        <div className="text-center">
          <p className={cn("text-sm font-medium", isDragOver ? "text-primary" : "text-foreground")}>
            {isUploading
              ? "Enviando..."
              : isDragOver
              ? "Solte os arquivos aqui"
              : "Clique para fazer upload ou arraste arquivos aqui"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {getAcceptedTypesText(accept)} (máx. {maxSize}MB)
            {multiple && " • Múltiplos arquivos"}
          </p>
        </div>

        {/* Upload progress */}
        {isUploading && (
          <div className="w-full max-w-xs mt-2">
            {Array.from(uploadingFiles.entries()).map(([id, progress]) => (
              <div key={id} className="space-y-1">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-center text-muted-foreground">{progress}%</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Uploaded files list */}
      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((file, index) => {
            const FileIcon = getFileIcon(file.type, file.name);
            
            return (
              <div
                key={`${file.path}-${index}`}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                {/* Preview or icon */}
                {file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>

                {/* Remove button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
