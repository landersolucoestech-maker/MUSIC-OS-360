import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Regra {
  id: number;
  keywords: string;
  category: string;
  type: string;
  origin: string;
}

interface RegraViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regra?: Regra;
  onEdit?: () => void;
}

export function RegraViewModal({ open, onOpenChange, regra, onEdit }: RegraViewModalProps) {
  if (!regra) return null;

  const keywords = regra.keywords.split(',').map(k => k.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Detalhes da Regra</DialogTitle>
          <DialogDescription>Informações completas da regra de categorização</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Categoria</label>
            <p className="text-lg font-semibold">{regra.category}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Tipo</label>
            <div>
              <Badge variant={regra.type === "Receita" ? "default" : "secondary"}>
                {regra.type}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Origem</label>
            <div>
              <Badge variant="outline">{regra.origin}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Palavras-chave</label>
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword, index) => (
                <Badge key={index} variant="outline" className="font-mono text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          {onEdit && regra.origin !== "Sistema" && (
            <Button onClick={onEdit}>Editar</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
