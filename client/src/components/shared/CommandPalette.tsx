import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Music,
  Radio,
  FileText,
  DollarSign,
  Calendar,
  Package,
  MessageCircle,
  UserCog,
  Contact,
  Megaphone,
  Settings,
  Palette,
  Shield,
  AlertTriangle,
  Share2,
  Receipt,
  Calculator,
  Eye,
  Target,
  CalendarDays,
  TrendingUp,
  FileEdit,
  Sparkles,
  ShoppingCart,
  Upload,
  Search,
  Plus,
} from "lucide-react";
import { useArtistas } from "@/hooks/useArtistas";
import { useClientes } from "@/hooks/useClientes";
import { useContratos } from "@/hooks/useContratos";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const pages = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, keywords: ["inicio", "home", "visão geral"] },
  { name: "Artistas", href: "/artistas", icon: Users, keywords: ["artista", "banda", "cantor"] },
  { name: "Projetos", href: "/projetos", icon: FolderKanban, keywords: ["projeto", "album"] },
  { name: "Obras & Fonogramas", href: "/registro-musicas", icon: Music, keywords: ["musica", "obra", "fonograma", "isrc"] },
  { name: "Monitoramento", href: "/monitoramento", icon: Radio, keywords: ["monitor", "detecção"] },
  { name: "Licenciamento", href: "/licenciamento", icon: Shield, keywords: ["licença", "sync"] },
  { name: "Takedowns", href: "/takedowns", icon: AlertTriangle, keywords: ["takedown", "remoção", "pirataria"] },
  { name: "Lançamentos", href: "/lancamentos", icon: Upload, keywords: ["lançamento", "release", "distribuição"] },
  { name: "Gestão de Shares", href: "/gestao-shares", icon: Share2, keywords: ["share", "participação", "royalty"] },
  { name: "Contratos", href: "/contratos", icon: FileText, keywords: ["contrato", "acordo"] },
  { name: "Templates de Contratos", href: "/contratos/templates", icon: FileEdit, keywords: ["template", "modelo"] },
  { name: "Financeiro", href: "/financeiro", icon: DollarSign, keywords: ["financeiro", "transação", "receita", "despesa"] },
  { name: "Contabilidade", href: "/contabilidade", icon: Calculator, keywords: ["contabilidade", "fiscal"] },
  { name: "Notas Fiscais", href: "/nota-fiscal", icon: Receipt, keywords: ["nota", "nf", "fiscal"] },
  { name: "Agenda", href: "/agenda", icon: Calendar, keywords: ["agenda", "evento", "show"] },
  { name: "Inventário", href: "/inventario", icon: Package, keywords: ["inventario", "equipamento", "estoque"] },
  { name: "LanderZap", href: "/lander", icon: MessageCircle, keywords: ["whatsapp", "zap", "mensagem"] },
  { name: "Usuários", href: "/usuarios", icon: UserCog, keywords: ["usuario", "permissão", "acesso"] },
  { name: "CRM", href: "/crm", icon: Contact, keywords: ["crm", "cliente", "lead", "contato"] },
  { name: "Marketing - Visão Geral", href: "/marketing/visao-geral", icon: Eye, keywords: ["marketing", "visão"] },
  { name: "Marketing - Campanhas", href: "/marketing/campanhas", icon: Target, keywords: ["campanha", "ads"] },
  { name: "Marketing - Calendário", href: "/marketing/calendario", icon: CalendarDays, keywords: ["calendario", "conteudo"] },
  { name: "Marketing - Métricas", href: "/marketing/metricas", icon: TrendingUp, keywords: ["metrica", "spotify", "youtube"] },
  { name: "Marketing - Briefing", href: "/marketing/briefing", icon: FileEdit, keywords: ["briefing", "brief"] },
  { name: "Marketing - IA Criativa", href: "/marketing/ia-criativa", icon: Sparkles, keywords: ["ia", "ai", "criativo", "gerar"] },
  { name: "Marketing - Tarefas", href: "/marketing/tarefas", icon: Megaphone, keywords: ["tarefa", "task"] },
  { name: "Configurações", href: "/configuracoes", icon: Settings, keywords: ["config", "configuração"] },
  { name: "Aparência", href: "/aparencia", icon: Palette, keywords: ["tema", "dark", "light", "aparencia"] },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { artistas } = useArtistas();
  const { clientes } = useClientes();
  const { contratos } = useContratos();

  const [search, setSearch] = useState("");

  const runCommand = useCallback((command: () => void) => {
    onOpenChange(false);
    command();
  }, [onOpenChange]);

  // Filter pages based on search
  const filteredPages = useMemo(() => {
    if (!search) return pages;
    const searchLower = search.toLowerCase();
    return pages.filter(page => 
      page.name.toLowerCase().includes(searchLower) ||
      page.keywords.some(k => k.includes(searchLower))
    );
  }, [search]);

  // Filter entities based on search
  const filteredArtistas = useMemo(() => {
    if (!search || search.length < 2) return [];
    const searchLower = search.toLowerCase();
    return artistas
      .filter(a => a.nome_artistico.toLowerCase().includes(searchLower))
      .slice(0, 5);
  }, [search, artistas]);

  const filteredClientes = useMemo(() => {
    if (!search || search.length < 2) return [];
    const searchLower = search.toLowerCase();
    return clientes
      .filter(c => c.nome.toLowerCase().includes(searchLower))
      .slice(0, 5);
  }, [search, clientes]);

  const filteredContratos = useMemo(() => {
    if (!search || search.length < 2) return [];
    const searchLower = search.toLowerCase();
    return contratos
      .filter(c => c.titulo.toLowerCase().includes(searchLower))
      .slice(0, 5);
  }, [search, contratos]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Buscar páginas, artistas, clientes, contratos..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        
        {/* Quick Actions */}
        <CommandGroup heading="Ações Rápidas">
          <CommandItem onSelect={() => runCommand(() => navigate("/artistas?action=new"))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Novo Artista</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/vendas?action=new"))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Nova Venda</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/financeiro?action=new"))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Nova Transação</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => navigate("/contratos?action=new"))}>
            <Plus className="mr-2 h-4 w-4" />
            <span>Novo Contrato</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Pages */}
        <CommandGroup heading="Páginas">
          {filteredPages.slice(0, 10).map((page) => (
            <CommandItem
              key={page.href}
              onSelect={() => runCommand(() => navigate(page.href))}
            >
              <page.icon className="mr-2 h-4 w-4" />
              <span>{page.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* Artistas */}
        {filteredArtistas.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Artistas">
              {filteredArtistas.map((artista) => (
                <CommandItem
                  key={artista.id}
                  onSelect={() => runCommand(() => navigate(`/artistas?view=${artista.id}`))}
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span>{artista.nome_artistico}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {artista.genero_musical || "Artista"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Clientes */}
        {filteredClientes.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Clientes">
              {filteredClientes.map((cliente) => (
                <CommandItem
                  key={cliente.id}
                  onSelect={() => runCommand(() => navigate(`/crm?view=${cliente.id}`))}
                >
                  <Contact className="mr-2 h-4 w-4" />
                  <span>{cliente.nome}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {cliente.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Contratos */}
        {filteredContratos.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Contratos">
              {filteredContratos.map((contrato) => (
                <CommandItem
                  key={contrato.id}
                  onSelect={() => runCommand(() => navigate(`/contratos?view=${contrato.id}`))}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{contrato.titulo}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {contrato.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

// Hook for keyboard shortcut
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return { open, setOpen };
}
