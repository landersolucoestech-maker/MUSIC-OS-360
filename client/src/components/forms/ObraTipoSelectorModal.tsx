import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type TipoObra = "autoral" | "referencia";

interface ObraTipoSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (tipo: TipoObra) => void;
}

export function ObraTipoSelectorModal({
  open,
  onOpenChange,
  onSelect,
}: ObraTipoSelectorModalProps) {
  const handleSelect = (tipo: TipoObra) => {
    onSelect(tipo);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="modal-obra-tipo-selector">
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
            onClick={() => handleSelect("autoral")}
            data-testid="button-tipo-obra-autoral"
          >
            Obra Autoral
          </Button>
          <Button
            type="button"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => handleSelect("referencia")}
            data-testid="button-tipo-obra-referencia"
          >
            Obra por Referência
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
