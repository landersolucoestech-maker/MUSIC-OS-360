import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { WORK_ORIGIN_BADGE_LABELS, type WorkOrigin } from "@/modules/catalog/constants/work-options";

interface WorkTypeSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (origin: WorkOrigin) => void;
}

export function WorkTypeSelectorModal({
  open,
  onOpenChange,
  onSelect,
}: WorkTypeSelectorModalProps) {
  const handleSelect = (origin: WorkOrigin) => {
    onSelect(origin);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="modal-work-origin-selector">
        <DialogHeader>
          <DialogTitle>Qual tipo de obra você está cadastrando?</DialogTitle>
          <DialogDescription className="sr-only">
            Selecione o tipo da obra antes de iniciar o cadastro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Obra Autoral</strong>: selecione
            esta opção quando a obra envolver artistas com{" "}
            <strong>contrato ativo</strong> com a empresa — seja por cessão de
            direitos ou por participação direta no corpo autoral. Este é o
            cadastro oficial da criação.
          </p>
          <p>
            <strong className="text-foreground">Obra por Referência</strong>:
            use esta opção quando a obra <strong>não</strong> envolver artistas
            com contrato ativo. Trata-se de um registro auxiliar (não oficial)
            que serve como apoio no cadastro de fonogramas e facilita a
            identificação futura da obra.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Button
            type="button"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => handleSelect("original")}
            data-testid="button-work-origin-original"
          >
            {WORK_ORIGIN_BADGE_LABELS.original}
          </Button>
          <Button
            type="button"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => handleSelect("reference")}
            data-testid="button-work-origin-reference"
          >
            {WORK_ORIGIN_BADGE_LABELS.reference}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
