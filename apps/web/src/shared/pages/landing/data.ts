import {
  Music,
  Users,
  Library,
  Rocket,
  Share2,
  ListChecks,
  FileText,
  DollarSign,
  Megaphone,
  ShieldCheck,
  Calendar,
  Video,
  Contact,
  FolderKanban,
  FileSignature,
  Send,
  Wallet,
  FileCheck2,
  Database,
  CloudUpload,
  Headset,
  Building2,
  UserCog,
  Briefcase,
} from "lucide-react";

// ─── Conteúdo estático (institucional) — não comercial/dinâmico ───────────────
// Módulos reais do produto (alinhados ao painel). Sem métricas/valores falsos.

export const MODULES = [
  { icon: Users, title: "Gestão de Artistas", desc: "Cadastre artistas, perfis, contatos, documents, responsáveis e informações operacionais." },
  { icon: Library, title: "Catálogo Musical", desc: "Organize obras, fonogramas, ISRC, ISWC, splits, compositores, intérpretes, editoras e licenças." },
  { icon: Rocket, title: "Lançamentos", desc: "Planeje lançamentos, acompanhe status, etapas, responsáveis, prazos e entregas." },
  { icon: Share2, title: "Distribuição Musical", desc: "Centralize o processo de distribuição digital através das integrações com distribuidoras parceiras, acompanhando metadados, entregas e status operacionais." },
  { icon: ListChecks, title: "Tarefas Operacionais", desc: "Distribua e conclua tarefas entre setores como produção musical, design, marketing, audiovisual, financeiro e administrativo." },
  { icon: FileText, title: "Contratos e Documentos", desc: "Gerencie contratos, documentos, vencimentos, assinaturas e histórico vinculado a artistas, obras e projetos." },
  { icon: DollarSign, title: "Financeiro Operacional", desc: "Controle entradas, saídas, contas a pagar, contas a receber, categorias, relatórios e movimentações." },
  { icon: Megaphone, title: "Marketing e Mídia", desc: "Organize campanhas, conteúdos, calendário de marketing, briefings, tarefas e ações de divulgação." },
  { icon: ShieldCheck, title: "Direitos Autorais e ECAD", desc: "Controle obras, dados autorais, monitoramento, relatórios, registros e informações de direitos." },
  { icon: Calendar, title: "Agenda", desc: "Organize compromissos como sessões, reuniões, entrevistas, gravações, ensaios, fotos e eventos." },
  { icon: Video, title: "Audiovisual", desc: "Acompanhe produções audiovisuais — clipes, teasers, reels, shorts e visualizers — com tarefas e aprovações." },
  { icon: Contact, title: "CRM", desc: "Acompanhe contatos estratégicos, leads comerciais, interações e relacionamento da operação." },
] as const;

export const TRUST_BAR = [
  { icon: FileCheck2, title: "Relatórios completos", desc: "Indicadores para toda a operação musical" },
  { icon: Database, title: "Dados integrados", desc: "Tudo conectado em um só lugar" },
  { icon: CloudUpload, title: "Backup na nuvem", desc: "Seus dados protegidos e disponíveis" },
  { icon: Headset, title: "Suporte especializado", desc: "Time pronto para ajudar sua operação" },
] as const;

export const HOW_IT_WORKS = [
  { title: "Cadastre sua empresa", desc: "Adicione informações básicas, usuários e configure sua operação." },
  { title: "Organize seu catálogo", desc: "Cadastre artistas, projetos, obras e fonogramas em um só lugar." },
  { title: "Planeje e execute", desc: "Vincule contratos, planeje lançamentos e distribua tarefas entre setores." },
  { title: "Acompanhe resultados", desc: "Centralize entregas, distribuição musical, financeiro e direitos autorais." },
  { title: "Cresça com dados", desc: "Decida com mais clareza a partir de uma operação centralizada e organizada." },
] as const;

export const AUDIENCE = [
  { icon: Music, title: "Gravadoras", desc: "Organize catálogo, lançamentos, contratos, distribuições e métricas com mais controle." },
  { icon: Library, title: "Editoras Musicais", desc: "Gerencie obras, direitos, contratos e pagamentos com eficiência e segurança." },
  { icon: Video, title: "Produtoras Musicais", desc: "Acompanhe projetos, orçamentos, equipes e resultados em tempo real." },
  { icon: Building2, title: "Escritórios Artísticos", desc: "Organize agenda, contratos e a operação dos artistas representados." },
  { icon: UserCog, title: "Gestão de Carreira", desc: "Centralize decisões, tarefas e resultados da carreira do artista." },
  { icon: Briefcase, title: "Agências de Marketing Musical", desc: "Gerencie campanhas, conteúdos e demandas com organização e visão estratégica." },
] as const;

// Prévia neutra do produto (sem dados/métricas/gráficos falsos).
export const PREVIEW_NAV = [
  { icon: FolderKanban, label: "Artistas" },
  { icon: Library, label: "Catálogo" },
  { icon: Rocket, label: "Lançamentos" },
  { icon: FileSignature, label: "Contratos" },
  { icon: Send, label: "Distribuição" },
  { icon: Wallet, label: "Financeiro" },
] as const;

export const NAV_LINKS = [
  { href: "#modulos", label: "Módulos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#publico", label: "Para quem é" },
  { href: "#planos", label: "Planos" },
] as const;
