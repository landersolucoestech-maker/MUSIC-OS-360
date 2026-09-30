/**
 * Marketing — Deliverables section.
 *
 * Rendered inside a task's view/edit modal. Files are produced here, in the
 * task that owns them: upload creates v1, re-uploading adds a version (history
 * preserved), and each deliverable has an approval lifecycle, comments and a
 * view/edit/download/duplicate/delete action menu. In read-only (view) mode the
 * mutating affordances are hidden but download/preview/history stay available.
 */

import { useRef, useState, type ChangeEvent } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  History,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Play,
  Plus,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { cn } from "@/shared/lib/utils";
import { getExpectedUpdatedAt } from "@/shared/hooks/useConcurrencyConflict";
import {
  DELIVERABLE_APPROVAL_LABEL,
  DELIVERABLE_APPROVAL_TONE,
  DELIVERABLE_TYPE_LABEL,
  DELIVERABLE_TYPE_OPTIONS,
} from "../constants/marketing.constants";
import {
  useAddDeliverableComment,
  useAddDeliverableVersion,
  useCreateDeliverable,
  useDeliverablesByTask,
  useDuplicateDeliverable,
  useRemoveDeliverable,
  useSetDeliverableApproval,
  useUpdateDeliverable,
} from "../hooks/useMarketingDeliverables";
import type {
  DeliverableType,
  MarketingDeliverable,
} from "../types/marketing.types";
import { MarketingBadge } from "./MarketingStatusBadge";

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName || "entregavel";
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function isImage(mime: string) {
  return mime.startsWith("image/");
}
function isVideo(mime: string) {
  return mime.startsWith("video/");
}

function DeliverableApprovalBadge({ value }: { value: MarketingDeliverable["approval"] }) {
  return <MarketingBadge tone={DELIVERABLE_APPROVAL_TONE[value]}>{DELIVERABLE_APPROVAL_LABEL[value]}</MarketingBadge>;
}

export function MarketingDeliverableSection({
  taskId,
  readOnly = false,
}: {
  taskId: string;
  readOnly?: boolean;
}) {
  const { data: deliverables = [], isLoading } = useDeliverablesByTask(taskId);

  const createDeliverable = useCreateDeliverable();
  const removeDeliverable = useRemoveDeliverable();
  const duplicateDeliverable = useDuplicateDeliverable();

  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<DeliverableType>("cover_art");
  const [newFile, setNewFile] = useState<File | null>(null);

  const [previewTarget, setPreviewTarget] = useState<MarketingDeliverable | null>(null);
  const [editTarget, setEditTarget] = useState<MarketingDeliverable | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MarketingDeliverable | null>(null);

  const resetAdd = () => {
    setAdding(false);
    setNewTitle("");
    setNewType("cover_art");
    setNewFile(null);
  };

  const submitNew = () => {
    if (!newFile || !newTitle.trim()) return;
    createDeliverable.mutate(
      {
        taskId,
        title: newTitle,
        type: newType,
        file: { url: URL.createObjectURL(newFile), name: newFile.name, mimeType: newFile.type, size: newFile.size },
      },
      { onSuccess: resetAdd },
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    removeDeliverable.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Entregáveis</h3>
          <span className="text-[11px] text-muted-foreground">{deliverables.length}</span>
        </div>
        {!readOnly && (
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setAdding((v) => !v)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Enviar entregável
          </Button>
        )}
      </div>

      {!readOnly && adding && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-medium">Título *</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ex: Capa oficial do single" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo *</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as DeliverableType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERABLE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Arquivo *</Label>
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground hover:border-primary/60">
                <Upload className="h-3.5 w-3.5" />
                <span className="truncate">{newFile ? newFile.name : "Selecionar arquivo"}</span>
                <input
                  type="file"
                  className="sr-only"
                  onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={resetAdd}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={submitNew}
              disabled={!newFile || !newTitle.trim() || createDeliverable.isPending}
            >
              {createDeliverable.isPending ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Carregando entregáveis...</p>
      ) : deliverables.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
          Nenhum entregável ainda. {readOnly ? "" : "Envie o primeiro arquivo desta tarefa."}
        </p>
      ) : (
        <div className="space-y-2">
          {deliverables.map((d) => (
            <DeliverableCard
              key={d.id}
              deliverable={d}
              readOnly={readOnly}
              onPreview={() => setPreviewTarget(d)}
              onEdit={() => setEditTarget(d)}
              onDelete={() => setDeleteTarget(d)}
              onDuplicate={() => duplicateDeliverable.mutate(d.id)}
            />
          ))}
        </div>
      )}

      <PreviewDialog deliverable={previewTarget} onClose={() => setPreviewTarget(null)} />
      <EditDialog deliverable={editTarget} onClose={() => setEditTarget(null)} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir entregável?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O entregável
              {deleteTarget ? ` "${deleteTarget.title}"` : ""} e todo o histórico de versões serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeDeliverable.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={removeDeliverable.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeDeliverable.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function DeliverableCard({
  deliverable: d,
  readOnly,
  onPreview,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  deliverable: MarketingDeliverable;
  readOnly: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState("");
  const versionInput = useRef<HTMLInputElement | null>(null);

  const setApproval = useSetDeliverableApproval();
  const addVersion = useAddDeliverableVersion();
  const addComment = useAddDeliverableComment();

  const onPickVersion = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    addVersion.mutate({
      id: d.id,
      file: { url: URL.createObjectURL(file), name: file.name, mimeType: file.type, size: file.size },
      expectedUpdatedAt: getExpectedUpdatedAt(d),
    });
  };

  const submitComment = () => {
    if (!comment.trim()) return;
    addComment.mutate({ id: d.id, message: comment }, { onSuccess: () => setComment("") });
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {isImage(d.mimeType) ? (
            <img src={d.fileUrl} alt={d.title} className="h-full w-full object-cover" />
          ) : isVideo(d.mimeType) ? (
            <Play className="h-5 w-5 text-muted-foreground" />
          ) : (
            <FileText className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{d.title}</p>
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              v{d.version}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <MarketingBadge tone="info">{DELIVERABLE_TYPE_LABEL[d.type]}</MarketingBadge>
            <DeliverableApprovalBadge value={d.approval} />
            <span className="truncate text-[11px] text-muted-foreground">
              {d.fileName} · {formatSize(d.fileSize)}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações do entregável">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onPreview}>
              <Play className="mr-2 h-4 w-4" /> Ver
            </DropdownMenuItem>
            {!readOnly && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => triggerDownload(d.fileUrl, d.fileName)}>
              <Download className="mr-2 h-4 w-4" /> Baixar
            </DropdownMenuItem>
            {!readOnly && (
              <DropdownMenuItem onClick={onDuplicate}>
                <Paperclip className="mr-2 h-4 w-4" /> Duplicar
              </DropdownMenuItem>
            )}
            {!readOnly && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!readOnly && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            disabled={setApproval.isPending || d.approval === "approved"}
            onClick={() => setApproval.mutate({ id: d.id, approval: "approved" })}
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" /> Aprovar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-[11px]"
            disabled={setApproval.isPending || d.approval === "rejected"}
            onClick={() => setApproval.mutate({ id: d.id, approval: "rejected" })}
          >
            <XCircle className="mr-1 h-3.5 w-3.5 text-red-600" /> Rejeitar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={() => versionInput.current?.click()}
            disabled={addVersion.isPending}
          >
            <Upload className="mr-1 h-3.5 w-3.5" /> Nova versão
          </Button>
          <input ref={versionInput} type="file" className="sr-only" onChange={onPickVersion} />
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-1">
          <History className="h-3.5 w-3.5" /> {d.versions.length} versão(ões)
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" /> {d.comments.length} comentário(s)
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground">Histórico de versões</p>
            {[...d.versions].reverse().map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <span className="font-medium">v{v.version}</span>{" "}
                  <span className="text-muted-foreground">
                    {v.fileName} · {formatSize(v.fileSize)} · {formatDateTime(v.createdAt)} · {v.createdBy}
                  </span>
                  {v.note && <span className="block truncate text-[11px] text-muted-foreground">{v.note}</span>}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => triggerDownload(v.fileUrl, v.fileName)}
                  aria-label={`Baixar versão ${v.version}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground">Comentários</p>
            {d.comments.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Nenhum comentário.</p>
            ) : (
              d.comments.map((c) => (
                <div key={c.id} className="rounded-md bg-muted/40 p-2 text-xs">
                  <p className="font-medium">
                    {c.author}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                  </p>
                  <p className="text-muted-foreground">{c.message}</p>
                </div>
              ))
            )}
            {!readOnly && (
              <div className="flex gap-2">
                <Input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Escreva um comentário..."
                  className="h-8"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitComment();
                    }
                  }}
                />
                <Button type="button" size="sm" className="h-8" onClick={submitComment} disabled={!comment.trim() || addComment.isPending}>
                  Enviar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewDialog({ deliverable, onClose }: { deliverable: MarketingDeliverable | null; onClose: () => void }) {
  return (
    <Dialog open={!!deliverable} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{deliverable?.title}</DialogTitle>
          <DialogDescription>
            {deliverable ? `${DELIVERABLE_TYPE_LABEL[deliverable.type]} · v${deliverable.version} · ${deliverable.fileName}` : ""}
          </DialogDescription>
        </DialogHeader>
        {deliverable && (
          <div className="flex items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
            {isImage(deliverable.mimeType) ? (
              <img src={deliverable.fileUrl} alt={deliverable.title} className="max-h-[60vh] w-full object-contain" />
            ) : isVideo(deliverable.mimeType) ? (
              <video src={deliverable.fileUrl} controls className="max-h-[60vh] w-full" />
            ) : (
              <div className="flex flex-col items-center gap-2 p-10 text-muted-foreground">
                <FileText className="h-10 w-10" />
                <span className="text-xs">Pré-visualização indisponível para este formato.</span>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          {deliverable && (
            <Button type="button" variant="outline" onClick={() => triggerDownload(deliverable.fileUrl, deliverable.fileName)}>
              <Download className="mr-2 h-4 w-4" /> Baixar
            </Button>
          )}
          <Button type="button" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ deliverable, onClose }: { deliverable: MarketingDeliverable | null; onClose: () => void }) {
  const update = useUpdateDeliverable();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<DeliverableType>("cover_art");
  const [description, setDescription] = useState("");

  // Sync local form whenever a new deliverable is opened.
  const [syncedId, setSyncedId] = useState<string | null>(null);
  if (deliverable && deliverable.id !== syncedId) {
    setSyncedId(deliverable.id);
    setTitle(deliverable.title);
    setType(deliverable.type);
    setDescription(deliverable.description);
  }

  const save = () => {
    if (!deliverable || !title.trim()) return;
    update.mutate(
      {
        id: deliverable.id,
        patch: { title: title.trim(), type, description: description.trim() },
        expectedUpdatedAt: getExpectedUpdatedAt(deliverable),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog
      open={!!deliverable}
      onOpenChange={(o) => {
        if (!o) {
          setSyncedId(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar entregável</DialogTitle>
          <DialogDescription>Atualize os dados do entregável.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tipo *</Label>
            <Select value={type} onValueChange={(v) => setType(v as DeliverableType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELIVERABLE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={!title.trim() || update.isPending}>
            {update.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
