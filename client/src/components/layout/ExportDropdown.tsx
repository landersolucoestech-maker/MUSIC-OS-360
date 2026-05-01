import { useState } from "react";
import { toast } from "sonner";
import {
  Download,
  DollarSign,
  Users,
  Music,
  Disc,
  Radio,
  FileSignature,
  Package,
  UserCheck,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useArtistas } from "@/hooks/useArtistas";
import { useObras } from "@/hooks/useObras";
import { useFonogramas } from "@/hooks/useFonogramas";
import { useLancamentos } from "@/hooks/useLancamentos";
import { useContratos } from "@/hooks/useContratos";
import { useTransacoes } from "@/hooks/useTransacoes";
import { useContatos } from "@/hooks/useContatos";
import { useInventario } from "@/hooks/useInventario";
import { useLeads } from "@/hooks/useLeads";

const getXLSX = () => import("xlsx");

interface ReportConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  sheetName: string;
}

const reports: ReportConfig[] = [
  { id: "financeiro", label: "Financeiro", icon: DollarSign, sheetName: "Financeiro" },
  { id: "artistas", label: "Artistas", icon: Users, sheetName: "Artistas" },
  { id: "obras", label: "Obras Musicais", icon: Music, sheetName: "Obras" },
  { id: "fonogramas", label: "Fonogramas", icon: Disc, sheetName: "Fonogramas" },
  { id: "lancamentos", label: "Lançamentos", icon: Radio, sheetName: "Lancamentos" },
  { id: "contratos", label: "Contratos", icon: FileSignature, sheetName: "Contratos" },
  { id: "inventario", label: "Inventário", icon: Package, sheetName: "Inventario" },
  { id: "crm", label: "Contatos CRM", icon: UserCheck, sheetName: "CRM" },
  { id: "leads", label: "Leads", icon: Users, sheetName: "Leads" },
];

interface ExportDropdownProps {
  collapsed?: boolean;
}

export function ExportDropdown({ collapsed = false }: ExportDropdownProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const { artistas } = useArtistas();
  const { obras } = useObras();
  const { fonogramas } = useFonogramas();
  const { lancamentos } = useLancamentos();
  const { contratos } = useContratos();
  const { transacoes } = useTransacoes();
  const { contatos } = useContatos();
  const { inventario } = useInventario();
  const { leads } = useLeads();

  const getDataForReport = (reportId: string): any[] => {
    switch (reportId) {
      case "financeiro":
        return transacoes.map((t: any) => ({
          Descrição: t.descricao || "",
          Tipo: t.tipo || "",
          Valor: t.valor || 0,
          Data: t.data || "",
          Categoria: t.categoria || "",
          Status: t.status || "",
          Origem: t.origem || "",
        }));
      case "artistas":
        return artistas.map((a: any) => ({
          Nome: a.nome || "",
          "Gênero Musical": a.genero_musical || "",
          Email: a.email || "",
          Telefone: a.telefone || "",
          Status: a.status || "",
          Gravadora: a.gravadora || "",
        }));
      case "obras":
        return obras.map((o: any) => ({
          Título: o.titulo || "",
          ISWC: o.iswc || "",
          Compositores: o.compositores || "",
          Editora: o.editora || "",
          Gênero: o.genero || "",
          Status: o.status_registro || "",
        }));
      case "fonogramas":
        return fonogramas.map((f: any) => ({
          Título: f.titulo || "",
          ISRC: f.isrc || "",
          Artista: f.artista_nome || "",
          Duração: f.duracao || "",
          Status: f.status_registro || "",
        }));
      case "lancamentos":
        return lancamentos.map((l: any) => ({
          Título: l.titulo || "",
          Tipo: l.tipo || "",
          "Data Lançamento": l.data_lancamento || "",
          Plataformas: l.plataformas || "",
          Status: l.status || "",
        }));
      case "contratos":
        return contratos.map((c: any) => ({
          Título: c.titulo || "",
          Tipo: c.tipo || "",
          Status: c.status || "",
          "Data Início": c.data_inicio || "",
          "Data Fim": c.data_fim || "",
          Valor: c.valor || 0,
        }));
      case "inventario":
        return inventario.map((i: any) => ({
          Nome: i.nome || "",
          Categoria: i.categoria || "",
          Status: i.status || "",
          Quantidade: i.quantidade || 0,
          Localização: i.localizacao || "",
        }));
      case "crm":
        return contatos.map((c: any) => ({
          Nome: c.nome || "",
          Email: c.email || "",
          Telefone: c.telefone || "",
          Empresa: c.empresa || "",
          "Tipo Pessoa": c.tipo_pessoa || "",
          Responsável: c.responsavel || "",
        }));
      case "leads":
        return leads.map((l: any) => ({
          Nome: l.nome_contratante || "",
          Email: l.email || "",
          Telefone: l.telefone || "",
          Artista: l.artista_interesse || "",
          "Tipo Evento": l.tipo_evento || "",
          "Data Evento": l.data_evento || "",
          Cidade: l.cidade_evento || "",
          Estado: l.estado_evento || "",
          Local: l.nome_local_evento || "",
          Orçamento: l.orcamento_estimado || 0,
          Cachê: l.valor_estimado_cache || 0,
          Status: l.status_lead || "",
          Prioridade: l.prioridade || "",
          Probabilidade: l.probabilidade_fechamento || 0,
          Origem: l.origem_lead || "",
          Empresa: l.nome_empresa || "",
          "Tipo Contrato": l.tipo_contrato || "",
        }));
      default:
        return [];
    }
  };

  const handleExport = async (report: ReportConfig) => {
    setExporting(report.id);
    try {
      const data = getDataForReport(report.id);
      if (data.length === 0) {
        toast.error(`Nenhum dado disponível para exportar em "${report.label}"`);
        return;
      }
      const XLSX = await getXLSX();
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, report.sheetName);
      const dateStr = new Date().toISOString().split("T")[0];
      XLSX.writeFile(workbook, `${report.sheetName.toLowerCase()}_${dateStr}.xlsx`);
      toast.success(`Relatório "${report.label}" exportado com sucesso!`);
    } catch {
      toast.error(`Erro ao exportar "${report.label}"`);
    } finally {
      setExporting(null);
    }
  };

  const handleExportAll = async () => {
    setExporting("all");
    try {
      const XLSX = await getXLSX();
      const workbook = XLSX.utils.book_new();
      let hasData = false;

      for (const report of reports) {
        const data = getDataForReport(report.id);
        if (data.length > 0) {
          const worksheet = XLSX.utils.json_to_sheet(data);
          XLSX.utils.book_append_sheet(workbook, worksheet, report.sheetName);
          hasData = true;
        }
      }

      if (!hasData) {
        toast.error("Nenhum dado disponível para exportar");
        return;
      }

      const dateStr = new Date().toISOString().split("T")[0];
      XLSX.writeFile(workbook, `lander360_completo_${dateStr}.xlsx`);
      toast.success("Relatório completo exportado com sucesso!");
    } catch {
      toast.error("Erro ao exportar relatório completo");
    } finally {
      setExporting(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          data-testid="button-export-excel"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Download className="h-4 w-4 shrink-0" />
          )}
          {!collapsed && <span>Exportar Excel</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-56">
        <DropdownMenuLabel>Relatórios para exportar</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {reports.map((report) => (
          <DropdownMenuItem
            key={report.id}
            onClick={() => handleExport(report)}
            disabled={!!exporting}
            className="cursor-pointer gap-2"
            data-testid={`button-export-${report.id}`}
          >
            <report.icon className="h-4 w-4" />
            <span>{report.label}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleExportAll}
          disabled={!!exporting}
          className="cursor-pointer gap-2 font-medium"
          data-testid="button-export-all"
        >
          <Download className="h-4 w-4" />
          <span>Exportar Tudo</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
