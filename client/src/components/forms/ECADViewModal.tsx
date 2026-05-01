import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, CheckCircle, AlertTriangle, Clock } from "lucide-react";

interface ECADViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodo?: any;
}

// Detalhes ECAD - será preenchido via backend
const detalhesEcad: { id: number; obra: string; isrc: string; execucoes: number; valorEcad: string; status: string }[] = [];

export function ECADViewModal({ open, onOpenChange, periodo }: ECADViewModalProps) {
  if (!periodo) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Conciliado":
        return <Badge className="bg-green-600 hover:bg-green-600 text-white"><CheckCircle className="h-3 w-3 mr-1" />{status}</Badge>;
      case "Pendente":
        return <Badge className="bg-amber-500 hover:bg-amber-500 text-white"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
      case "Divergência":
        return <Badge className="bg-red-600 hover:bg-red-600 text-white"><AlertTriangle className="h-3 w-3 mr-1" />{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5" />
            Detalhes da Conciliação ECAD
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-6 pr-4">
            {/* Período e Status */}
            <div>
              <h2 className="text-xl font-bold text-foreground">Período: {periodo.periodo}</h2>
              <p className="text-muted-foreground">Relatório de conciliação ECAD</p>
            </div>

            {/* Badges */}
            <div className="flex gap-2">
              <Badge className="bg-amber-500 hover:bg-amber-500 text-white">
                {periodo.status}
              </Badge>
            </div>

            {/* Grid de Estatísticas */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-foreground">{periodo.registros}</p>
                <p className="text-sm text-muted-foreground">Registros</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-500">{periodo.matches}</p>
                <p className="text-sm text-muted-foreground">Matches</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-500">{periodo.divergencias}</p>
                <p className="text-sm text-muted-foreground">Divergências</p>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-foreground">
                  {periodo.registros > 0 ? ((periodo.matches / periodo.registros) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Taxa de Match</p>
              </div>
            </div>

            {/* Tabela de Detalhes */}
            <div>
              <p className="text-sm text-muted-foreground mb-3">Detalhes das Execuções</p>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-foreground">Obra</TableHead>
                      <TableHead className="text-foreground">ISRC</TableHead>
                      <TableHead className="text-foreground">Execuções</TableHead>
                      <TableHead className="text-foreground">Valor ECAD</TableHead>
                      <TableHead className="text-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalhesEcad.length > 0 ? (
                      detalhesEcad.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-foreground">{item.obra}</TableCell>
                          <TableCell className="font-mono text-sm text-foreground">{item.isrc}</TableCell>
                          <TableCell className="text-foreground">{item.execucoes}</TableCell>
                          <TableCell className="text-foreground">{item.valorEcad}</TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          Nenhum detalhe de execução disponível
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
