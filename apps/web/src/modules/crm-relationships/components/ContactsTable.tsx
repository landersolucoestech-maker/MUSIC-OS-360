import { useEffect, useState } from "react";
import { Eye, Mail, MapPin, MoreHorizontal, Pencil, Phone, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Checkbox } from "@/shared/ui/checkbox";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { TablePagination } from "@/shared/ui/table-pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { contactStatusOptions, contactTypeOptions, labelFor } from "../constants";
import type { Contact } from "../types";

type Props = {
  contacts: Contact[];
  onView?: (contact: Contact) => void;
  onEdit?: (contact: Contact) => void;
  onDelete?: (contact: Contact) => void;
  onBulkDelete?: (contacts: Contact[]) => void;
};

export function ContactsTable({ contacts, onView, onEdit, onDelete, onBulkDelete }: Props) {
  const { page, pageSize, total, pageItems, setPage, setPageSize } = usePagination(contacts, 10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const ids = new Set(contacts.map((c) => c.id));
    setSelectedIds((cur) => cur.filter((id) => ids.has(id)));
  }, [contacts]);

  const allSelected = contacts.length > 0 && selectedIds.length === contacts.length;
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : contacts.map((c) => c.id));
  const toggleSelect = (id: string) =>
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const handleBulkDelete = () => {
    if (!selectedIds.length) return;
    onBulkDelete?.(contacts.filter((c) => selectedIds.includes(c.id)));
    setSelectedIds([]);
  };

  return (
    <Card data-testid="contatos-table">
      <CardContent className="pt-0">
      <ListSectionHeader
        title="Lista de Contatos"
        count={contacts.length}
        description="Acompanhe contatos, segmentos, canais e responsáveis comerciais"
        action={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Selecionar todos os contatos" />
            <span className="text-xs text-muted-foreground">
              {selectedIds.length > 0 ? `${selectedIds.length} selecionado(s)` : "Selecionar todos"}
            </span>
            {selectedIds.length > 0 && (
              <Button variant="destructive" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleBulkDelete} disabled={!onBulkDelete} data-testid="button-bulk-delete-contatos">
                <Trash2 className="h-3.5 w-3.5" /> Excluir ({selectedIds.length})
              </Button>
            )}
          </div>
        }
      />
      <Table className="min-w-[920px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[36px]"></TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Segmento</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>Cidade</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageItems.map((contact) => {
            const phone = contact.phone ?? "";
            const legalName = contact.personType === "company" && contact.legalName && contact.legalName !== contact.name ? contact.legalName : "";
            const city = [contact.city, contact.state].filter(Boolean).join(" / ");
            return (
              <TableRow key={contact.id} className={selectedIds.includes(contact.id) ? "bg-primary/5" : ""} data-testid={`contato-row-${contact.id}`}>
                <TableCell>
                  <Checkbox checked={selectedIds.includes(contact.id)} onCheckedChange={() => toggleSelect(contact.id)} aria-label="Selecionar contato" />
                </TableCell>
                <TableCell>
                  <p className="font-medium text-foreground">{contact.name}</p>
                  {legalName && <p className="text-xs text-muted-foreground">{legalName}</p>}
                </TableCell>
                <TableCell className="text-muted-foreground">{labelFor(contactTypeOptions, contact.category)}</TableCell>
                <TableCell>
                  <p className="flex items-center gap-2 text-sm text-foreground">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {phone || "-"}
                  </p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {contact.email ?? "-"}
                  </p>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {city || "-"}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{contact.responsibleName ?? "-"}</TableCell>
                <TableCell className="text-muted-foreground">{labelFor(contactStatusOptions, contact.status)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Ações"
                        data-testid={`contato-actions-${contact.id}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView?.(contact)} data-testid={`contato-action-view-${contact.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit?.(contact)} data-testid={`contato-action-edit-${contact.id}`}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete?.(contact)}
                        className="text-destructive focus:text-destructive"
                        data-testid={`contato-action-delete-${contact.id}`}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {contacts.length > 0 && (
        <TablePagination
          total={total}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="contatos"
        />
      )}
      </CardContent>
    </Card>
  );
}
