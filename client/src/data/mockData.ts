const UID = "mock-user-00000000000000000000000001";
const OID = "mock-org-000000000000000000000000001";
const NOW = new Date().toISOString();

function d(offset: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().split("T")[0];
}

export const MOCK_USER_ID = UID;
export const MOCK_ORG_ID = OID;

const STORAGE_KEY = "lander_mock_data";

function buildSeedData(): Record<string, unknown[]> {
  return {
  artistas: [
    { id: "art-001", user_id: UID, nome_artistico: "Vitória Lunar", nome_civil: "Vitória Carvalho", tipo: "solo", status: "contratado", status_cadastro: "ativo", genero_musical: "Pop", email: "vitoria@landermusic.com.br", telefone: "(11) 99123-4567", cpf_cnpj: "123.456.789-01", foto_url: null, observacoes: "Artista em ascensão, foco em streaming", contrato_id: "ctr-001", created_at: NOW, updated_at: NOW },
    { id: "art-002", user_id: UID, nome_artistico: "Grupo Raiz Nordestina", nome_civil: null, tipo: "banda", status: "contratado", status_cadastro: "ativo", genero_musical: "Forró", email: "raiz@landermusic.com.br", telefone: "(81) 98765-4321", cpf_cnpj: "12.345.678/0001-90", foto_url: null, observacoes: "Banda consolidada no nordeste", contrato_id: "ctr-002", created_at: NOW, updated_at: NOW },
    { id: "art-003", user_id: UID, nome_artistico: "DJ Marcus Flow", nome_civil: "Marcus Oliveira", tipo: "solo", status: "contratado", status_cadastro: "ativo", genero_musical: "Eletrônico", email: "marcus@landermusic.com.br", telefone: "(21) 97654-3210", cpf_cnpj: "234.567.890-12", foto_url: null, observacoes: "DJ residente em São Paulo e Rio", contrato_id: "ctr-003", created_at: NOW, updated_at: NOW },
    { id: "art-004", user_id: UID, nome_artistico: "Ana Beatriz Santos", nome_civil: "Ana Beatriz Santos", tipo: "solo", status: "contratado", status_cadastro: "ativo", genero_musical: "Sertanejo", email: "anabeatriz@landermusic.com.br", telefone: "(67) 99887-6543", cpf_cnpj: "345.678.901-23", foto_url: null, observacoes: "Revelação do sertanejo universitário", contrato_id: "ctr-004", created_at: NOW, updated_at: NOW },
    { id: "art-005", user_id: UID, nome_artistico: "Trio Bossa Moderna", nome_civil: null, tipo: "banda", status: "contratado", status_cadastro: "ativo", genero_musical: "MPB/Bossa Nova", email: "trios@landermusic.com.br", telefone: "(11) 96543-2109", cpf_cnpj: "23.456.789/0001-01", foto_url: null, observacoes: "Projeto instrumental de alto nível", contrato_id: "ctr-005", created_at: NOW, updated_at: NOW },
    { id: "art-006", user_id: UID, nome_artistico: "Renan Costa", nome_civil: "Renan Costa Pereira", tipo: "solo", status: "em_negociacao", status_cadastro: "ativo", genero_musical: "Funk", email: "renan@email.com.br", telefone: "(21) 95432-1098", cpf_cnpj: "456.789.012-34", foto_url: null, observacoes: "Negociação em andamento", contrato_id: null, created_at: NOW, updated_at: NOW },
    { id: "art-007", user_id: UID, nome_artistico: "Larissa Voz", nome_civil: "Larissa Mendes", tipo: "solo", status: "contratado", status_cadastro: "ativo", genero_musical: "Gospel", email: "larissa@email.com.br", telefone: "(61) 94321-0987", cpf_cnpj: "567.890.123-45", foto_url: null, observacoes: "Cadastro recebido pelo formulário público", contrato_id: null, created_at: NOW, updated_at: NOW },
    { id: "art-008", user_id: UID, nome_artistico: "Pedro Breaks", nome_civil: "Pedro Alves", tipo: "solo", status: "contratado", status_cadastro: "ativo", genero_musical: "Hip-Hop", email: "pedro@landermusic.com.br", telefone: "(11) 93210-9876", cpf_cnpj: "678.901.234-56", foto_url: null, observacoes: "MC e produtor musical", contrato_id: "ctr-006", created_at: NOW, updated_at: NOW },
  ],

  clientes: [
    { id: "cli-001", user_id: UID, nome: "Sony Music Entertainment Brasil", tipo_pessoa: "pessoa_juridica", cpf_cnpj: "01.234.567/0001-89", responsavel: "Carlos Figueiredo", email: "comercial@sony.com.br", telefone: "(11) 3333-4444", endereco: "Av. Paulista, 1234", cidade: "São Paulo", estado: "SP", status: "ativo", observacoes: "Parceiro estratégico de distribuição", created_at: NOW, updated_at: NOW },
    { id: "cli-002", user_id: UID, nome: "Universal Music Brasil", tipo_pessoa: "pessoa_juridica", cpf_cnpj: "02.345.678/0001-78", responsavel: "Amanda Rocha", email: "licencas@universal.com.br", telefone: "(21) 2222-3333", endereco: "Rua Voluntários da Pátria, 45", cidade: "Rio de Janeiro", estado: "RJ", status: "ativo", observacoes: "Licenciamento de catálogo", created_at: NOW, updated_at: NOW },
    { id: "cli-003", user_id: UID, nome: "Globo Comunicações", tipo_pessoa: "pessoa_juridica", cpf_cnpj: "03.456.789/0001-67", responsavel: "Roberto Lima", email: "musical@globo.com", telefone: "(21) 2111-2222", endereco: "R. Von Martius, 0", cidade: "Rio de Janeiro", estado: "RJ", status: "ativo", observacoes: "Cliente de sincronização TV", created_at: NOW, updated_at: NOW },
    { id: "cli-004", user_id: UID, nome: "Brahma - Ambev", tipo_pessoa: "pessoa_juridica", cpf_cnpj: "04.567.890/0001-56", responsavel: "Fernanda Castro", email: "marketing@ambev.com.br", telefone: "(11) 4444-5555", endereco: "Rua Dr. Renato Paes de Barros, 1017", cidade: "São Paulo", estado: "SP", status: "ativo", observacoes: "Patrocínio de shows e festivais", created_at: NOW, updated_at: NOW },
    { id: "cli-005", user_id: UID, nome: "Festival Lollapalooza Brasil", tipo_pessoa: "pessoa_juridica", cpf_cnpj: "05.678.901/0001-45", responsavel: "Alexandre Torres", email: "booking@lollapalooza.com.br", telefone: "(11) 5555-6666", endereco: "Autódromo de Interlagos", cidade: "São Paulo", estado: "SP", status: "ativo", observacoes: "Parceiro de booking", created_at: NOW, updated_at: NOW },
    { id: "cli-006", user_id: UID, nome: "DistroKid BR", tipo_pessoa: "pessoa_juridica", cpf_cnpj: "06.789.012/0001-34", responsavel: "Patricia Neves", email: "br@distrokid.com", telefone: "(11) 6666-7777", endereco: "Rua Funchal, 418", cidade: "São Paulo", estado: "SP", status: "ativo", observacoes: "Plataforma de distribuição digital", created_at: NOW, updated_at: NOW },
    { id: "cli-007", user_id: UID, nome: "Spotify Brasil", tipo_pessoa: "pessoa_juridica", cpf_cnpj: "07.890.123/0001-23", responsavel: "Lucas Mendes", email: "artistrelations@spotify.com", telefone: "(11) 7777-8888", endereco: "Av. Brigadeiro Faria Lima, 3900", cidade: "São Paulo", estado: "SP", status: "ativo", observacoes: "Relações de artista", created_at: NOW, updated_at: NOW },
    { id: "cli-008", user_id: UID, nome: "João Promoter Eventos", tipo_pessoa: "pessoa_fisica", cpf_cnpj: "123.456.789-09", responsavel: null, email: "joao@promoter.com.br", telefone: "(41) 98888-9999", endereco: "Rua XV de Novembro, 1200", cidade: "Curitiba", estado: "PR", status: "ativo", observacoes: "Promoter regional Sul", created_at: NOW, updated_at: NOW },
    { id: "cli-009", user_id: UID, nome: "Rock in Rio Produções", tipo_pessoa: "pessoa_juridica", cpf_cnpj: "09.012.345/0001-01", responsavel: "Carla Viana", email: "booking@rockinrio.com.br", telefone: "(21) 9999-1111", endereco: "Parque Olímpico", cidade: "Rio de Janeiro", estado: "RJ", status: "prospect", observacoes: "Em negociação para 2027", created_at: NOW, updated_at: NOW },
    { id: "cli-010", user_id: UID, nome: "Vivo Telecom - Marketing", tipo_pessoa: "pessoa_juridica", cpf_cnpj: "10.123.456/0001-90", responsavel: "Marcelo Souza", email: "mkt@vivo.com.br", telefone: "(11) 1111-2222", endereco: "Av. Chucri Zaidan, 860", cidade: "São Paulo", estado: "SP", status: "lead", observacoes: "Interessado em patrocínio", created_at: NOW, updated_at: NOW },
  ],

  contratos: [
    { id: "ctr-001", user_id: UID, titulo: "Contrato Vitória Lunar - Exclusividade 2025-2027", tipo: "exclusividade", status: "assinado", artista_id: "art-001", cliente_id: null, data_inicio: "2025-01-15", data_fim: "2027-01-14", valor: 180000, exclusivo: true, observacoes: "Contrato de exclusividade completa", created_at: NOW, updated_at: NOW, artistas: { id: "art-001", nome_artistico: "Vitória Lunar" }, clientes: null },
    { id: "ctr-002", user_id: UID, titulo: "Contrato Raiz Nordestina - Gravação e Distribuição", tipo: "gravacao", status: "assinado", artista_id: "art-002", cliente_id: null, data_inicio: "2024-06-01", data_fim: "2026-05-31", valor: 95000, exclusivo: false, observacoes: "Contrato de gravação e distribuição nordeste", created_at: NOW, updated_at: NOW, artistas: { id: "art-002", nome_artistico: "Grupo Raiz Nordestina" }, clientes: null },
    { id: "ctr-003", user_id: UID, titulo: "Contrato DJ Marcus Flow - Distribuição Digital", tipo: "distribuicao", status: "assinado", artista_id: "art-003", cliente_id: null, data_inicio: "2025-03-01", data_fim: "2027-02-28", valor: 42000, exclusivo: false, observacoes: "Foco em plataformas digitais internacionais", created_at: NOW, updated_at: NOW, artistas: { id: "art-003", nome_artistico: "DJ Marcus Flow" }, clientes: null },
    { id: "ctr-004", user_id: UID, titulo: "Contrato Ana Beatriz - Gestão de Carreira", tipo: "gestao", status: "assinado", artista_id: "art-004", cliente_id: null, data_inicio: "2025-07-01", data_fim: "2027-06-30", valor: 120000, exclusivo: true, observacoes: "Gestão 360 graus da carreira", created_at: NOW, updated_at: NOW, artistas: { id: "art-004", nome_artistico: "Ana Beatriz Santos" }, clientes: null },
    { id: "ctr-005", user_id: UID, titulo: "Contrato Trio Bossa Moderna - Licenciamento", tipo: "licenciamento", status: "assinado", artista_id: "art-005", cliente_id: null, data_inicio: "2024-01-01", data_fim: d(200), valor: 35000, exclusivo: false, observacoes: "Licenciamento para publicidade e eventos", created_at: NOW, updated_at: NOW, artistas: { id: "art-005", nome_artistico: "Trio Bossa Moderna" }, clientes: null },
    { id: "ctr-006", user_id: UID, titulo: "Contrato Pedro Breaks - Produção Musical", tipo: "producao", status: "assinado", artista_id: "art-008", cliente_id: null, data_inicio: "2025-09-01", data_fim: "2027-08-31", valor: 68000, exclusivo: false, observacoes: "Produção de 2 álbuns", created_at: NOW, updated_at: NOW, artistas: { id: "art-008", nome_artistico: "Pedro Breaks" }, clientes: null },
    { id: "ctr-007", user_id: UID, titulo: "Parceria Sony Music - Distribuição Premium", tipo: "distribuicao", status: "assinado", artista_id: null, cliente_id: "cli-001", data_inicio: "2025-01-01", data_fim: "2025-12-31", valor: 250000, exclusivo: false, observacoes: "Acordo de distribuição física e digital", created_at: NOW, updated_at: NOW, artistas: null, clientes: { id: "cli-001", nome: "Sony Music Entertainment Brasil" } },
    { id: "ctr-008", user_id: UID, titulo: "Licença Globo - Sync TV", tipo: "licenciamento", status: "vigente", artista_id: null, cliente_id: "cli-003", data_inicio: d(-60), data_fim: d(120), valor: 85000, exclusivo: false, observacoes: "Uso em novelas e séries", created_at: NOW, updated_at: NOW, artistas: null, clientes: { id: "cli-003", nome: "Globo Comunicações" } },
    { id: "ctr-009", user_id: UID, titulo: "Patrocínio Brahma Shows 2026", tipo: "patrocinio", status: "em_analise", artista_id: null, cliente_id: "cli-004", data_inicio: d(30), data_fim: d(180), valor: 320000, exclusivo: false, observacoes: "Patrocínio master de turnê", created_at: NOW, updated_at: NOW, artistas: null, clientes: { id: "cli-004", nome: "Brahma - Ambev" } },
    { id: "ctr-010", user_id: UID, titulo: "Renan Costa - Pré-contrato Exclusividade", tipo: "exclusividade", status: "rascunho", artista_id: "art-006", cliente_id: null, data_inicio: d(15), data_fim: d(380), valor: 90000, exclusivo: true, observacoes: "Aguardando assinatura do artista", created_at: NOW, updated_at: NOW, artistas: { id: "art-006", nome_artistico: "Renan Costa" }, clientes: null },
  ],

  obras: [
    { id: "obra-001", user_id: UID, titulo: "Noite de Luz", compositor: "Vitória Carvalho", compositores: "Vitória Carvalho, Lucas Mendes", co_compositores: "Lucas Mendes", detentores: "Lander Music Publishing", editora: "Lander Music Publishing", isrc: "BRLND2500001", iswc: "T-123.456.789-0", cod_abramus: "ABR-001-2025", cod_ecad: "ECAD-0001-VL", tipo: "musica", genero: "Pop", status: "registrado", duracao: "3:42", origem_externa: "abramus", origem_externa_id: "ABR-001-2025", origem_externa_sincronizado_em: d(-2), created_at: NOW, updated_at: NOW },
    { id: "obra-002", user_id: UID, titulo: "Beira do Rio", compositor: "Grupo Raiz Nordestina", compositores: "Grupo Raiz Nordestina", co_compositores: null, detentores: "Lander Music Publishing", editora: "Lander Music Publishing", isrc: "BRLND2500002", iswc: "T-234.567.890-1", cod_abramus: "ABR-002-2025", cod_ecad: "ECAD-0002-RN", tipo: "musica", genero: "Forró", status: "registrado", duracao: "4:15", created_at: NOW, updated_at: NOW },
    { id: "obra-003", user_id: UID, titulo: "Frequência 440", compositor: "Marcus Oliveira", compositores: "Marcus Oliveira", co_compositores: null, detentores: "Marcus Flow Music", editora: "Marcus Flow Music", isrc: "BRLND2500003", iswc: "T-345.678.901-2", cod_abramus: "ABR-003-2025", cod_ecad: "ECAD-0003-MF", tipo: "musica", genero: "Eletrônico", status: "registrado", duracao: "5:30", created_at: NOW, updated_at: NOW },
    { id: "obra-004", user_id: UID, titulo: "Amor de Interior", compositor: "Ana Beatriz Santos", compositores: "Ana Beatriz Santos, Rodolfo Lima", co_compositores: "Rodolfo Lima", detentores: "Lander Music Publishing", editora: "Lander Music Publishing", isrc: "BRLND2500004", iswc: "T-456.789.012-3", cod_abramus: "ABR-004-2025", cod_ecad: "ECAD-0004-AB", tipo: "musica", genero: "Sertanejo", status: "registrado", duracao: "3:58", created_at: NOW, updated_at: NOW },
    { id: "obra-005", user_id: UID, titulo: "Suíte Brasileira nº 1", compositor: "Trio Bossa Moderna", compositores: "Trio Bossa Moderna", co_compositores: null, detentores: "Trio Bossa Moderna", editora: "Trio Bossa Moderna", isrc: "BRLND2500005", iswc: "T-567.890.123-4", cod_abramus: "ABR-005-2025", cod_ecad: "ECAD-0005-TB", tipo: "composicao", genero: "MPB", status: "registrado", duracao: "7:20", created_at: NOW, updated_at: NOW },
    { id: "obra-006", user_id: UID, titulo: "Cidade Mágica", compositor: "Vitória Carvalho", compositores: "Vitória Carvalho, Pedro Alves", co_compositores: "Pedro Alves", detentores: "Lander Music Publishing", editora: "Lander Music Publishing", isrc: "BRLND2500006", iswc: "T-678.901.234-5", cod_abramus: "ABR-006-2025", cod_ecad: "ECAD-0006-VL", tipo: "musica", genero: "Pop", status: "registrado", duracao: "3:25", created_at: NOW, updated_at: NOW },
    { id: "obra-007", user_id: UID, titulo: "Xote da Saudade", compositor: "Grupo Raiz Nordestina", compositores: "Grupo Raiz Nordestina", co_compositores: null, detentores: "Lander Music Publishing", editora: "Lander Music Publishing", isrc: "BRLND2500007", iswc: "T-789.012.345-6", cod_abramus: "ABR-007-2025", cod_ecad: "ECAD-0007-RN", tipo: "musica", genero: "Forró", status: "registrado", duracao: "4:02", created_at: NOW, updated_at: NOW },
    { id: "obra-008", user_id: UID, titulo: "Trap do Norte", compositor: "Pedro Alves", compositores: "Pedro Alves, Renan Costa Pereira", co_compositores: "Renan Costa Pereira", detentores: "Pedro Breaks / Lander", editora: "Pedro Breaks Music", isrc: "BRLND2500008", iswc: "T-890.123.456-7", cod_abramus: "ABR-008-2025", cod_ecad: "ECAD-0008-PB", tipo: "musica", genero: "Trap", status: "registrado", duracao: "2:58", created_at: NOW, updated_at: NOW },
    { id: "obra-009", user_id: UID, titulo: "Sonho Azul", compositor: "Ana Beatriz Santos", compositores: "Ana Beatriz Santos", co_compositores: null, detentores: "Lander Music Publishing", editora: "Lander Music Publishing", isrc: "BRLND2500009", iswc: "T-901.234.567-8", cod_abramus: "ABR-009-2025", cod_ecad: "ECAD-0009-AB", tipo: "musica", genero: "Sertanejo", status: "registrado", duracao: "4:30", created_at: NOW, updated_at: NOW },
    { id: "obra-010", user_id: UID, titulo: "Flow Noturno", compositor: "Marcus Oliveira", compositores: "Marcus Oliveira, DJ Set Crew", co_compositores: "DJ Set Crew", detentores: "Marcus Flow Music", editora: "Marcus Flow Music", isrc: "BRLND2500010", iswc: "T-012.345.678-9", cod_abramus: "ABR-010-2025", cod_ecad: "ECAD-0010-MF", tipo: "musica", genero: "Eletrônico", status: "registrado", duracao: "6:15", created_at: NOW, updated_at: NOW },
    { id: "obra-011", user_id: UID, titulo: "Recomeço", compositor: "Vitória Carvalho", compositores: "Vitória Carvalho", co_compositores: null, detentores: "Lander Music Publishing", editora: "Lander Music Publishing", isrc: "BRLND2500011", iswc: "T-112.345.678-0", cod_abramus: "ABR-011-2025", cod_ecad: "ECAD-0011-VL", tipo: "musica", genero: "Pop", status: "registrado", duracao: "3:55", created_at: NOW, updated_at: NOW },
    { id: "obra-012", user_id: UID, titulo: "Festa na Roça", compositor: "Grupo Raiz Nordestina", compositores: "Grupo Raiz Nordestina, Ana Beatriz Santos", co_compositores: "Ana Beatriz Santos", detentores: "Lander Music Publishing", editora: "Lander Music Publishing", isrc: "BRLND2500012", iswc: "T-212.345.678-1", cod_abramus: "ABR-012-2025", cod_ecad: "ECAD-0012-RN", tipo: "musica", genero: "Forró", status: "registrado", duracao: "3:40", created_at: NOW, updated_at: NOW },
    { id: "obra-013", user_id: UID, titulo: "Madrugada Eletrônica", compositor: "Marcus Oliveira", compositores: "Marcus Oliveira", co_compositores: null, detentores: "Marcus Flow Music", editora: "Marcus Flow Music", isrc: "BRLND2500013", iswc: "T-312.345.678-2", cod_abramus: "ABR-013-2025", cod_ecad: "ECAD-0013-MF", tipo: "musica", genero: "Eletrônico", status: "analise", duracao: "7:45", created_at: NOW, updated_at: NOW },
    { id: "obra-014", user_id: UID, titulo: "Saudade de Minas", compositor: "Ana Beatriz Santos", compositores: "Ana Beatriz Santos", co_compositores: null, detentores: "Lander Music Publishing", editora: "Lander Music Publishing", isrc: "BRLND2500014", iswc: "T-412.345.678-3", cod_abramus: "ABR-014-2025", cod_ecad: "ECAD-0014-AB", tipo: "musica", genero: "Sertanejo", status: "registrado", duracao: "4:12", created_at: NOW, updated_at: NOW },
    { id: "obra-015", user_id: UID, titulo: "Voo Livre", compositor: "Trio Bossa Moderna", compositores: "Trio Bossa Moderna", co_compositores: null, detentores: "Trio Bossa Moderna", editora: "Trio Bossa Moderna", isrc: "BRLND2500015", iswc: "T-512.345.678-4", cod_abramus: "ABR-015-2025", cod_ecad: "ECAD-0015-TB", tipo: "composicao", genero: "MPB", status: "registrado", duracao: "5:08", created_at: NOW, updated_at: NOW },
    { id: "obra-016", user_id: UID, titulo: "Rua do Futuro", compositor: "Pedro Alves", compositores: "Pedro Alves", co_compositores: null, detentores: "Pedro Breaks / Lander", editora: "Pedro Breaks Music", isrc: "BRLND2500016", iswc: null, cod_abramus: null, cod_ecad: null, tipo: "musica", genero: "Funk", status: "pendente", duracao: "3:10", created_at: NOW, updated_at: NOW },
    { id: "obra-017", user_id: UID, titulo: "Baião Moderno", compositor: "Grupo Raiz Nordestina", compositores: "Grupo Raiz Nordestina", co_compositores: null, detentores: "Lander Music Publishing", editora: "Lander Music Publishing", isrc: "BRLND2500017", iswc: "T-712.345.678-6", cod_abramus: "ABR-017-2025", cod_ecad: "ECAD-0017-RN", tipo: "musica", genero: "Forró", status: "registrado", duracao: "3:55", created_at: NOW, updated_at: NOW },
    { id: "obra-018", user_id: UID, titulo: "Estrela do Sul", compositor: "Vitória Carvalho", compositores: "Vitória Carvalho, Trio Bossa Moderna", co_compositores: "Trio Bossa Moderna", detentores: "Lander Music Publishing", editora: "Lander Music Publishing", isrc: "BRLND2500018", iswc: "T-812.345.678-7", cod_abramus: "ABR-018-2025", cod_ecad: "ECAD-0018-VL", tipo: "musica", genero: "MPB", status: "registrado", duracao: "4:40", created_at: NOW, updated_at: NOW },
    { id: "obra-019", user_id: UID, titulo: "Ritmo da Favela", compositor: "Pedro Alves", compositores: "Pedro Alves, Renan Costa Pereira", co_compositores: "Renan Costa Pereira", detentores: "Pedro Breaks / Lander", editora: "Pedro Breaks Music", isrc: "BRLND2500019", iswc: "T-912.345.678-8", cod_abramus: "ABR-019-2025", cod_ecad: "ECAD-0019-PB", tipo: "musica", genero: "Funk", status: "analise", duracao: "3:22", created_at: NOW, updated_at: NOW },
    { id: "obra-020", user_id: UID, titulo: "Chuva de Julho", compositor: "Ana Beatriz Santos", compositores: "Ana Beatriz Santos", co_compositores: null, detentores: "Lander Music Publishing", editora: "Lander Music Publishing", isrc: "BRLND2500020", iswc: "T-022.345.678-9", cod_abramus: "ABR-020-2025", cod_ecad: "ECAD-0020-AB", tipo: "musica", genero: "Sertanejo", status: "registrado", duracao: "4:05", created_at: NOW, updated_at: NOW },
  ],

  fonogramas: [
    { id: "fono-001", user_id: UID, titulo: "Noite de Luz", obra_id: "obra-001", artista_id: "art-001", isrc: "BRLND2500001", duracao: "3:42", tipo: "original", status: "registrado", compositores: "Vitória Carvalho, Lucas Mendes", interpretes: "Vitória Lunar", produtores: "Rafael Santana", gravadora: "Lander Records", cod_abramus: "ABR-001-2025", cod_ecad: "ECAD-0001-VL", origem_externa: "abramus", origem_externa_id: "ABR-001-2025", origem_externa_sincronizado_em: d(-2), created_at: NOW, updated_at: NOW },
    { id: "fono-002", user_id: UID, titulo: "Beira do Rio", obra_id: "obra-002", artista_id: "art-002", isrc: "BRLND2500002", duracao: "4:15", tipo: "original", status: "registrado", compositores: "Grupo Raiz Nordestina", interpretes: "Grupo Raiz Nordestina", produtores: "Rafael Santana", gravadora: "Lander Records", cod_abramus: "ABR-002-2025", cod_ecad: "ECAD-0002-RN", created_at: NOW, updated_at: NOW },
    { id: "fono-003", user_id: UID, titulo: "Frequência 440", obra_id: "obra-003", artista_id: "art-003", isrc: "BRLND2500003", duracao: "5:30", tipo: "original", status: "registrado", compositores: "Marcus Oliveira", interpretes: "DJ Marcus Flow", produtores: "Marcus Oliveira", gravadora: "Marcus Flow Music", cod_abramus: "ABR-003-2025", cod_ecad: "ECAD-0003-MF", created_at: NOW, updated_at: NOW },
    { id: "fono-004", user_id: UID, titulo: "Amor de Interior", obra_id: "obra-004", artista_id: "art-004", isrc: "BRLND2500004", duracao: "3:58", tipo: "original", status: "registrado", compositores: "Ana Beatriz Santos, Rodolfo Lima", interpretes: "Ana Beatriz Santos", produtores: "Rafael Santana", gravadora: "Lander Records", cod_abramus: "ABR-004-2025", cod_ecad: "ECAD-0004-AB", created_at: NOW, updated_at: NOW },
    { id: "fono-005", user_id: UID, titulo: "Suíte Brasileira nº 1", obra_id: "obra-005", artista_id: "art-005", isrc: "BRLND2500005", duracao: "7:20", tipo: "original", status: "registrado", compositores: "Trio Bossa Moderna", interpretes: "Trio Bossa Moderna", produtores: "Rafael Santana", gravadora: "Sony Music", cod_abramus: "ABR-005-2025", cod_ecad: "ECAD-0005-TB", created_at: NOW, updated_at: NOW },
    { id: "fono-006", user_id: UID, titulo: "Cidade Mágica", obra_id: "obra-006", artista_id: "art-001", isrc: "BRLND2500006", duracao: "3:25", tipo: "original", status: "pendente", compositores: "Vitória Carvalho, Pedro Alves", interpretes: "Vitória Lunar", produtores: "Rafael Santana", gravadora: "Lander Records", cod_abramus: null, cod_ecad: null, created_at: NOW, updated_at: NOW },
    { id: "fono-007", user_id: UID, titulo: "Xote da Saudade", obra_id: "obra-007", artista_id: "art-002", isrc: "BRLND2500007", duracao: "4:02", tipo: "original", status: "registrado", compositores: "Grupo Raiz Nordestina", interpretes: "Grupo Raiz Nordestina", produtores: "Rafael Santana", gravadora: "Lander Records", cod_abramus: "ABR-007-2025", cod_ecad: "ECAD-0007-RN", created_at: NOW, updated_at: NOW },
    { id: "fono-008", user_id: UID, titulo: "Trap do Norte", obra_id: "obra-008", artista_id: "art-008", isrc: "BRLND2500008", duracao: "2:58", tipo: "original", status: "registrado", compositores: "Pedro Alves, Renan Costa Pereira", interpretes: "Pedro Breaks feat. Renan Costa", produtores: "Pedro Alves", gravadora: "Lander Records", cod_abramus: "ABR-008-2025", cod_ecad: "ECAD-0008-PB", created_at: NOW, updated_at: NOW },
    { id: "fono-009", user_id: UID, titulo: "Sonho Azul", obra_id: "obra-009", artista_id: "art-004", isrc: "BRLND2500009", duracao: "4:30", tipo: "original", status: "analise", compositores: "Ana Beatriz Santos", interpretes: "Ana Beatriz Santos", produtores: "Rafael Santana", gravadora: "Lander Records", cod_abramus: "ABR-009-2025", cod_ecad: null, created_at: NOW, updated_at: NOW },
    { id: "fono-010", user_id: UID, titulo: "Flow Noturno", obra_id: "obra-010", artista_id: "art-003", isrc: "BRLND2500010", duracao: "6:15", tipo: "original", status: "registrado", compositores: "Marcus Oliveira, DJ Set Crew", interpretes: "DJ Marcus Flow", produtores: "Marcus Oliveira", gravadora: "Marcus Flow Music", cod_abramus: "ABR-010-2025", cod_ecad: "ECAD-0010-MF", created_at: NOW, updated_at: NOW },
    { id: "fono-011", user_id: UID, titulo: "Recomeço", obra_id: "obra-011", artista_id: "art-001", isrc: "BRLND2500011", duracao: "3:55", tipo: "original", status: "pendente", compositores: "Vitória Carvalho", interpretes: "Vitória Lunar", produtores: "Rafael Santana", gravadora: "Lander Records", cod_abramus: null, cod_ecad: null, created_at: NOW, updated_at: NOW },
    { id: "fono-012", user_id: UID, titulo: "Festa na Roça", obra_id: "obra-012", artista_id: "art-002", isrc: "BRLND2500012", duracao: "3:40", tipo: "original", status: "registrado", compositores: "Grupo Raiz Nordestina, Ana Beatriz Santos", interpretes: "Grupo Raiz Nordestina", produtores: "Rafael Santana", gravadora: "Lander Records", cod_abramus: "ABR-012-2025", cod_ecad: "ECAD-0012-RN", created_at: NOW, updated_at: NOW },
    { id: "fono-013", user_id: UID, titulo: "Madrugada Eletrônica", obra_id: "obra-013", artista_id: "art-003", isrc: "BRLND2500013", duracao: "7:45", tipo: "remix", status: "analise", compositores: "Marcus Oliveira", interpretes: "DJ Marcus Flow", produtores: "Marcus Oliveira", gravadora: "Marcus Flow Music", cod_abramus: "ABR-013-2025", cod_ecad: null, created_at: NOW, updated_at: NOW },
    { id: "fono-014", user_id: UID, titulo: "Saudade de Minas", obra_id: "obra-014", artista_id: "art-004", isrc: "BRLND2500014", duracao: "4:12", tipo: "original", status: "registrado", compositores: "Ana Beatriz Santos", interpretes: "Ana Beatriz Santos", produtores: "Rafael Santana", gravadora: "Lander Records", cod_abramus: "ABR-014-2025", cod_ecad: "ECAD-0014-AB", created_at: NOW, updated_at: NOW },
    { id: "fono-015", user_id: UID, titulo: "Voo Livre", obra_id: "obra-015", artista_id: "art-005", isrc: "BRLND2500015", duracao: "5:08", tipo: "original", status: "registrado", compositores: "Trio Bossa Moderna", interpretes: "Trio Bossa Moderna", produtores: "Rafael Santana", gravadora: "Sony Music", cod_abramus: "ABR-015-2025", cod_ecad: "ECAD-0015-TB", created_at: NOW, updated_at: NOW },
    { id: "fono-016", user_id: UID, titulo: "Rua do Futuro", obra_id: "obra-016", artista_id: "art-008", isrc: "BRLND2500016", duracao: "3:10", tipo: "original", status: "pendente", compositores: "Pedro Alves", interpretes: "Pedro Breaks", produtores: "Pedro Alves", gravadora: "Lander Records", cod_abramus: null, cod_ecad: null, created_at: NOW, updated_at: NOW },
    { id: "fono-017", user_id: UID, titulo: "Baião Moderno", obra_id: "obra-017", artista_id: "art-002", isrc: "BRLND2500017", duracao: "3:55", tipo: "original", status: "registrado", compositores: "Grupo Raiz Nordestina", interpretes: "Grupo Raiz Nordestina", produtores: "Rafael Santana", gravadora: "Lander Records", cod_abramus: "ABR-017-2025", cod_ecad: "ECAD-0017-RN", created_at: NOW, updated_at: NOW },
    { id: "fono-018", user_id: UID, titulo: "Estrela do Sul", obra_id: "obra-018", artista_id: "art-001", isrc: "BRLND2500018", duracao: "4:40", tipo: "original", status: "analise", compositores: "Vitória Carvalho, Trio Bossa Moderna", interpretes: "Vitória Lunar", produtores: "Rafael Santana", gravadora: "Lander Records", cod_abramus: "ABR-018-2025", cod_ecad: null, created_at: NOW, updated_at: NOW },
    { id: "fono-019", user_id: UID, titulo: "Ritmo da Favela", obra_id: "obra-019", artista_id: "art-008", isrc: "BRLND2500019", duracao: "3:22", tipo: "original", status: "registrado", compositores: "Pedro Alves, Renan Costa Pereira", interpretes: "Pedro Breaks feat. Renan Costa", produtores: "Pedro Alves", gravadora: "Lander Records", cod_abramus: "ABR-019-2025", cod_ecad: "ECAD-0019-PB", created_at: NOW, updated_at: NOW },
    { id: "fono-020", user_id: UID, titulo: "Chuva de Julho", obra_id: "obra-020", artista_id: "art-004", isrc: "BRLND2500020", duracao: "4:05", tipo: "original", status: "pendente", compositores: "Ana Beatriz Santos", interpretes: "Ana Beatriz Santos", produtores: "Rafael Santana", gravadora: "Lander Records", cod_abramus: null, cod_ecad: null, created_at: NOW, updated_at: NOW },
  ],

  lancamentos: [
    { id: "lanc-001", user_id: UID, titulo: "Noite de Luz - Single", tipo: "single", status: "ativo", artista_id: "art-001", data_lancamento: d(-90), distribuidora: "DistroKid BR", plataformas: ["Spotify", "Apple Music", "YouTube Music", "Deezer"], fonograma_ids: ["fono-001"], observacoes: "Single de trabalho do álbum debut", created_at: NOW, updated_at: NOW },
    { id: "lanc-002", user_id: UID, titulo: "Raiz do Nordeste - EP", tipo: "ep", status: "ativo", artista_id: "art-002", data_lancamento: d(-180), distribuidora: "DistroKid BR", plataformas: ["Spotify", "Apple Music", "Deezer"], fonograma_ids: ["fono-002", "fono-007", "fono-012", "fono-017"], observacoes: "EP com 4 faixas autorais", created_at: NOW, updated_at: NOW },
    { id: "lanc-003", user_id: UID, titulo: "Frequência - Álbum", tipo: "album", status: "ativo", artista_id: "art-003", data_lancamento: d(-120), distribuidora: "Believe Music", plataformas: ["Spotify", "Beatport", "SoundCloud", "Apple Music"], fonograma_ids: ["fono-003", "fono-010", "fono-013"], observacoes: "Álbum eletrônico completo", created_at: NOW, updated_at: NOW },
    { id: "lanc-004", user_id: UID, titulo: "Amor de Interior - Single", tipo: "single", status: "ativo", artista_id: "art-004", data_lancamento: d(-45), distribuidora: "DistroKid BR", plataformas: ["Spotify", "Apple Music", "YouTube Music"], fonograma_ids: ["fono-004"], observacoes: "Primeiro single da artista", created_at: NOW, updated_at: NOW },
    { id: "lanc-005", user_id: UID, titulo: "Bossa 2026 - Álbum", tipo: "album", status: "ativo", artista_id: "art-005", data_lancamento: d(-200), distribuidora: "Sony Music", plataformas: ["Spotify", "Apple Music", "Tidal", "Deezer"], fonograma_ids: ["fono-005", "fono-015"], observacoes: "Álbum instrumental premiado", created_at: NOW, updated_at: NOW },
    { id: "lanc-006", user_id: UID, titulo: "Cidade Mágica - Single", tipo: "single", status: "programado", artista_id: "art-001", data_lancamento: d(15), distribuidora: "DistroKid BR", plataformas: ["Spotify", "Apple Music", "YouTube Music", "Deezer", "Amazon Music"], fonograma_ids: ["fono-006"], observacoes: "Pre-save em andamento", created_at: NOW, updated_at: NOW },
    { id: "lanc-007", user_id: UID, titulo: "Trap do Norte - Single", tipo: "single", status: "ativo", artista_id: "art-008", data_lancamento: d(-30), distribuidora: "DistroKid BR", plataformas: ["Spotify", "YouTube Music", "Amazon Music"], fonograma_ids: ["fono-008"], observacoes: "Parceria com Renan Costa", created_at: NOW, updated_at: NOW },
    { id: "lanc-008", user_id: UID, titulo: "Sonho Azul - Single", tipo: "single", status: "analise", artista_id: "art-004", data_lancamento: d(45), distribuidora: "DistroKid BR", plataformas: ["Spotify", "Apple Music"], fonograma_ids: ["fono-009"], observacoes: "Mixagem em finalização", created_at: NOW, updated_at: NOW },
    { id: "lanc-009", user_id: UID, titulo: "Raiz 2 - EP", tipo: "ep", status: "programado", artista_id: "art-002", data_lancamento: d(90), distribuidora: "DistroKid BR", plataformas: ["Spotify", "Apple Music", "Deezer"], fonograma_ids: [], observacoes: "Segundo EP em planejamento", created_at: NOW, updated_at: NOW },
    { id: "lanc-010", user_id: UID, titulo: "Flow Noturno - EP", tipo: "ep", status: "ativo", artista_id: "art-003", data_lancamento: d(-270), distribuidora: "Believe Music", plataformas: ["Spotify", "Beatport", "Apple Music"], fonograma_ids: ["fono-010"], observacoes: "EP de deep house", created_at: NOW, updated_at: NOW },
  ],

  transacoes: [
    { id: "txn-001", user_id: UID, descricao: "Royalties Spotify - Vitória Lunar - Mar/2026", tipo: "receita", categoria: "royalties", valor: 12450.80, data: d(-30), status: "pago", artista_id: "art-001", cliente_id: "cli-007", venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-002", user_id: UID, descricao: "Royalties Apple Music - Raiz Nordestina - Mar/2026", tipo: "receita", categoria: "royalties", valor: 8230.50, data: d(-30), status: "pago", artista_id: "art-002", cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-003", user_id: UID, descricao: "Cachê show - Vitória Lunar - Festival Verão", tipo: "receita", categoria: "cachê", valor: 35000.00, data: d(-15), status: "pago", artista_id: "art-001", cliente_id: "cli-005", venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-004", user_id: UID, descricao: "Licença sync - Globo - Novela das 21h", tipo: "receita", categoria: "licenciamento", valor: 28500.00, data: d(-45), status: "pago", artista_id: null, cliente_id: "cli-003", venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-005", user_id: UID, descricao: "Adiantamento - Renan Costa (pré-contrato)", tipo: "despesa", categoria: "adiantamento_artista", valor: 15000.00, data: d(-10), status: "pago", artista_id: "art-006", cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-006", user_id: UID, descricao: "Produção estúdio - Álbum Pedro Breaks", tipo: "despesa", categoria: "producao_musical", valor: 22000.00, data: d(-20), status: "pago", artista_id: "art-008", cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-007", user_id: UID, descricao: "Campanha Meta Ads - Cidade Mágica", tipo: "despesa", categoria: "marketing_digital", valor: 8500.00, data: d(-5), status: "pago", artista_id: "art-001", cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-008", user_id: UID, descricao: "Royalties Deezer - Geral - Mar/2026", tipo: "receita", categoria: "royalties", valor: 3210.40, data: d(-25), status: "pago", artista_id: null, cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-009", user_id: UID, descricao: "Aluguel escritório São Paulo - Abr/2026", tipo: "despesa", categoria: "administrativo", valor: 7800.00, data: d(-1), status: "pago", artista_id: null, cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-010", user_id: UID, descricao: "Distribuição física - Sony Music - Q1 2026", tipo: "receita", categoria: "distribuicao", valor: 45000.00, data: d(-60), status: "pago", artista_id: null, cliente_id: "cli-001", venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-011", user_id: UID, descricao: "Royalties YouTube Music - Geral - Fev/2026", tipo: "receita", categoria: "royalties", valor: 9876.30, data: d(-60), status: "pago", artista_id: null, cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-012", user_id: UID, descricao: "Honorários jurídicos - Contratos Q1", tipo: "despesa", categoria: "juridico", valor: 12000.00, data: d(-30), status: "pago", artista_id: null, cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-013", user_id: UID, descricao: "Cachê DJ Marcus Flow - Evento Corporativo", tipo: "receita", categoria: "cachê", valor: 18000.00, data: d(-8), status: "pago", artista_id: "art-003", cliente_id: "cli-004", venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-014", user_id: UID, descricao: "Masterização - Sonho Azul EP", tipo: "despesa", categoria: "producao_musical", valor: 3500.00, data: d(-3), status: "pendente", artista_id: "art-004", cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-015", user_id: UID, descricao: "Royalties ECAD - Geral - Jan-Mar 2026", tipo: "receita", categoria: "royalties", valor: 15670.90, data: d(-40), status: "pago", artista_id: null, cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-016", user_id: UID, descricao: "Folha de pagamento - Março 2026", tipo: "despesa", categoria: "folha_pagamento", valor: 48500.00, data: d(-30), status: "pago", artista_id: null, cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-017", user_id: UID, descricao: "Cachê Raiz Nordestina - São João 2026", tipo: "receita", categoria: "cachê", valor: 42000.00, data: d(-7), status: "a_receber", artista_id: "art-002", cliente_id: "cli-008", venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-018", user_id: UID, descricao: "Fotografia e Videoclipe - Vitória Lunar", tipo: "despesa", categoria: "producao_audiovisual", valor: 18000.00, data: d(-15), status: "pago", artista_id: "art-001", cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-019", user_id: UID, descricao: "Patrocínio Brahma - Primeiro tranche", tipo: "receita", categoria: "patrocinio", valor: 80000.00, data: d(-50), status: "pago", artista_id: null, cliente_id: "cli-004", venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-020", user_id: UID, descricao: "Conta de energia elétrica - Studio", tipo: "despesa", categoria: "infraestrutura", valor: 2340.00, data: d(-1), status: "pago", artista_id: null, cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-021", user_id: UID, descricao: "Royalties Spotify - Raiz Nordestina - Abr/2026", tipo: "receita", categoria: "royalties", valor: 7890.60, data: d(0), status: "pendente", artista_id: "art-002", cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-022", user_id: UID, descricao: "Software DAW - renovação anual", tipo: "despesa", categoria: "software", valor: 1200.00, data: d(-5), status: "pago", artista_id: null, cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-023", user_id: UID, descricao: "Distribuição digital - DistroKid anual", tipo: "despesa", categoria: "distribuicao", valor: 2400.00, data: d(-20), status: "pago", artista_id: null, cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-024", user_id: UID, descricao: "Cachê Ana Beatriz - Rodeio Barretos", tipo: "receita", categoria: "cachê", valor: 55000.00, data: d(30), status: "a_receber", artista_id: "art-004", cliente_id: "cli-008", venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-025", user_id: UID, descricao: "Seguro equipamentos de estúdio", tipo: "despesa", categoria: "seguros", valor: 3600.00, data: d(-45), status: "pago", artista_id: null, cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-026", user_id: UID, descricao: "Royalties Amazon Music - Geral - Mar/2026", tipo: "receita", categoria: "royalties", valor: 2100.80, data: d(-30), status: "pago", artista_id: null, cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-027", user_id: UID, descricao: "Impressão material promocional - Turnê", tipo: "despesa", categoria: "marketing_offline", valor: 4500.00, data: d(-10), status: "pago", artista_id: null, cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-028", user_id: UID, descricao: "Licensamento instrumento Pedro Breaks - EP", tipo: "receita", categoria: "licenciamento", valor: 8000.00, data: d(-15), status: "pago", artista_id: "art-008", cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-029", user_id: UID, descricao: "Contabilidade mensal - Abr/2026", tipo: "despesa", categoria: "administrativo", valor: 1800.00, data: d(0), status: "pendente", artista_id: null, cliente_id: null, venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
    { id: "txn-030", user_id: UID, descricao: "Sync Vivo Comercial - 2026 - Bossa Moderna", tipo: "receita", categoria: "licenciamento", valor: 32000.00, data: d(-5), status: "pago", artista_id: "art-005", cliente_id: "cli-010", venda_id: null, origem: "manual", created_at: NOW, updated_at: NOW },
  ],

  funcionarios: [
    { id: "func-001", user_id: UID, nome_completo: "Mariana Oliveira", cargo: "Diretora de A&R", setor: "Artístico", salario_base: 12000.00, tipo_contrato: "clt", data_admissao: "2022-03-01", status: "ativo", email: "mariana@lander360.com.br", telefone: "(11) 99111-2222", cpf: "111.222.333-44", created_at: NOW, updated_at: NOW },
    { id: "func-002", user_id: UID, nome_completo: "Rafael Santana", cargo: "Produtor Musical", setor: "Produção", salario_base: 9500.00, tipo_contrato: "clt", data_admissao: "2021-06-15", status: "ativo", email: "rafael@lander360.com.br", telefone: "(11) 99222-3333", cpf: "222.333.444-55", created_at: NOW, updated_at: NOW },
    { id: "func-003", user_id: UID, nome_completo: "Camila Torres", cargo: "Gerente de Marketing", setor: "Marketing", salario_base: 8800.00, tipo_contrato: "clt", data_admissao: "2023-01-10", status: "ativo", email: "camila@lander360.com.br", telefone: "(11) 99333-4444", cpf: "333.444.555-66", created_at: NOW, updated_at: NOW },
    { id: "func-004", user_id: UID, nome_completo: "Diego Ferreira", cargo: "Analista Financeiro", setor: "Financeiro", salario_base: 7500.00, tipo_contrato: "clt", data_admissao: "2023-04-20", status: "ativo", email: "diego@lander360.com.br", telefone: "(11) 99444-5555", cpf: "444.555.666-77", created_at: NOW, updated_at: NOW },
    { id: "func-005", user_id: UID, nome_completo: "Amanda Pereira", cargo: "Coordenadora Jurídica", setor: "Jurídico", salario_base: 11000.00, tipo_contrato: "clt", data_admissao: "2020-11-08", status: "ativo", email: "amanda@lander360.com.br", telefone: "(11) 99555-6666", cpf: "555.666.777-88", created_at: NOW, updated_at: NOW },
    { id: "func-006", user_id: UID, nome_completo: "Bruno Machado", cargo: "Técnico de Estúdio", setor: "Produção", salario_base: 5800.00, tipo_contrato: "clt", data_admissao: "2024-02-14", status: "ativo", email: "bruno@lander360.com.br", telefone: "(11) 99666-7777", cpf: "666.777.888-99", created_at: NOW, updated_at: NOW },
  ],

  folha_pagamento: [
    { id: "fp-001", user_id: UID, funcionario_id: "func-001", periodo: "2026-03", salario_bruto: 12000.00, descontos: 2400.00, salario_liquido: 9600.00, status: "pago", observacoes: null, created_at: NOW, updated_at: NOW },
    { id: "fp-002", user_id: UID, funcionario_id: "func-002", periodo: "2026-03", salario_bruto: 9500.00, descontos: 1900.00, salario_liquido: 7600.00, status: "pago", observacoes: null, created_at: NOW, updated_at: NOW },
    { id: "fp-003", user_id: UID, funcionario_id: "func-003", periodo: "2026-03", salario_bruto: 8800.00, descontos: 1760.00, salario_liquido: 7040.00, status: "pago", observacoes: null, created_at: NOW, updated_at: NOW },
    { id: "fp-004", user_id: UID, funcionario_id: "func-004", periodo: "2026-03", salario_bruto: 7500.00, descontos: 1500.00, salario_liquido: 6000.00, status: "pago", observacoes: null, created_at: NOW, updated_at: NOW },
    { id: "fp-005", user_id: UID, funcionario_id: "func-005", periodo: "2026-03", salario_bruto: 11000.00, descontos: 2200.00, salario_liquido: 8800.00, status: "pago", observacoes: null, created_at: NOW, updated_at: NOW },
    { id: "fp-006", user_id: UID, funcionario_id: "func-006", periodo: "2026-03", salario_bruto: 5800.00, descontos: 1160.00, salario_liquido: 4640.00, status: "pago", observacoes: null, created_at: NOW, updated_at: NOW },
  ],

  ferias_ausencias: [
    { id: "fa-001", user_id: UID, funcionario_id: "func-001", tipo: "ferias", data_inicio: d(20), data_fim: d(34), status: "aprovado", motivo: "Férias anuais", observacoes: null, created_at: NOW, updated_at: NOW },
    { id: "fa-002", user_id: UID, funcionario_id: "func-003", tipo: "ausencia", data_inicio: d(-5), data_fim: d(-4), status: "aprovado", motivo: "Consulta médica", observacoes: null, created_at: NOW, updated_at: NOW },
    { id: "fa-003", user_id: UID, funcionario_id: "func-002", tipo: "ferias", data_inicio: d(60), data_fim: d(74), status: "pendente", motivo: "Férias de julho", observacoes: null, created_at: NOW, updated_at: NOW },
  ],

  documentos_funcionario: [
    { id: "doc-001", user_id: UID, funcionario_id: "func-001", tipo: "rg", nome_arquivo: "rg_mariana.pdf", url: "#", created_at: NOW },
    { id: "doc-002", user_id: UID, funcionario_id: "func-001", tipo: "contrato_trabalho", nome_arquivo: "contrato_mariana_2022.pdf", url: "#", created_at: NOW },
    { id: "doc-003", user_id: UID, funcionario_id: "func-002", tipo: "cpf", nome_arquivo: "cpf_rafael.pdf", url: "#", created_at: NOW },
  ],

  eventos: [
    { id: "evt-001", user_id: UID, titulo: "Show Vitória Lunar - Festival Verão SP", artista_id: "art-001", data_inicio: d(-15), data_fim: d(-15), horario_inicio: "21:00", horario_fim: "23:00", local: "Arena Anhembi", cidade: "São Paulo", estado: "SP", tipo_evento: "show", status: "realizado", valor_cache: 35000.00, capacidade_publico: 8000, descricao: "Festival de verão", created_at: NOW, updated_at: NOW },
    { id: "evt-002", user_id: UID, titulo: "DJ Marcus Flow - Evento Corporativo Ambev", artista_id: "art-003", data_inicio: d(-8), data_fim: d(-8), horario_inicio: "22:00", horario_fim: "03:00", local: "Hotel Unique", cidade: "São Paulo", estado: "SP", tipo_evento: "evento_corporativo", status: "realizado", valor_cache: 18000.00, capacidade_publico: 500, descricao: "Evento de confraternização", created_at: NOW, updated_at: NOW },
    { id: "evt-003", user_id: UID, titulo: "Raiz Nordestina - São João Caruaru 2026", artista_id: "art-002", data_inicio: d(7), data_fim: d(7), horario_inicio: "20:00", horario_fim: "00:00", local: "Pátio de Eventos", cidade: "Caruaru", estado: "PE", tipo_evento: "festival", status: "confirmado", valor_cache: 42000.00, capacidade_publico: 15000, descricao: "São João maior do mundo", created_at: NOW, updated_at: NOW },
    { id: "evt-004", user_id: UID, titulo: "Ana Beatriz - Rodeio Barretos 2026", artista_id: "art-004", data_inicio: d(30), data_fim: d(30), horario_inicio: "22:30", horario_fim: "00:30", local: "Parque do Peão", cidade: "Barretos", estado: "SP", tipo_evento: "rodeio", status: "confirmado", valor_cache: 55000.00, capacidade_publico: 35000, descricao: "Maior rodeio do mundo", created_at: NOW, updated_at: NOW },
    { id: "evt-005", user_id: UID, titulo: "Trio Bossa Moderna - Teatro Municipal", artista_id: "art-005", data_inicio: d(20), data_fim: d(20), horario_inicio: "19:30", horario_fim: "22:00", local: "Teatro Municipal de São Paulo", cidade: "São Paulo", estado: "SP", tipo_evento: "show_teatro", status: "confirmado", valor_cache: 28000.00, capacidade_publico: 1500, descricao: "Temporada de inverno", created_at: NOW, updated_at: NOW },
    { id: "evt-006", user_id: UID, titulo: "Vitória Lunar - Lançamento Cidade Mágica", artista_id: "art-001", data_inicio: d(16), data_fim: d(16), horario_inicio: "20:00", horario_fim: "23:30", local: "Casa de Shows Carioca", cidade: "Rio de Janeiro", estado: "RJ", tipo_evento: "lancamento", status: "confirmado", valor_cache: 20000.00, capacidade_publico: 2000, descricao: "Evento de lançamento do novo single", created_at: NOW, updated_at: NOW },
    { id: "evt-007", user_id: UID, titulo: "Pedro Breaks - Festival Hip-Hop SP", artista_id: "art-008", data_inicio: d(45), data_fim: d(45), horario_inicio: "18:00", horario_fim: "22:00", local: "Centro Cultural São Paulo", cidade: "São Paulo", estado: "SP", tipo_evento: "festival", status: "negociacao", valor_cache: 12000.00, capacidade_publico: 3000, descricao: "Festival anual de hip-hop", created_at: NOW, updated_at: NOW },
    { id: "evt-008", user_id: UID, titulo: "Vitória Lunar - Lollapalooza 2027", artista_id: "art-001", data_inicio: d(340), data_fim: d(341), horario_inicio: "17:00", horario_fim: "19:00", local: "Autódromo de Interlagos", cidade: "São Paulo", estado: "SP", tipo_evento: "festival", status: "negociacao", valor_cache: 120000.00, capacidade_publico: 100000, descricao: "Headliner confirmado", created_at: NOW, updated_at: NOW },
  ],

  campanhas: [
    { id: "camp-001", user_id: UID, nome: "Launch Campaign - Cidade Mágica", artista_id: "art-001", status: "ativo", tipo: "digital", data_inicio: d(-5), data_fim: d(25), orcamento: 45000, gasto: 18500, impressoes: 1240000, cliques: 48000, conversoes: 3200, observacoes: "Campanha de pré-save e lançamento", created_at: NOW, updated_at: NOW },
    { id: "camp-002", user_id: UID, nome: "São João Nordestino - Raiz", artista_id: "art-002", status: "ativo", tipo: "mista", data_inicio: d(-10), data_fim: d(15), orcamento: 28000, gasto: 15000, impressoes: 890000, cliques: 35000, conversoes: 2100, observacoes: "Campanha sazonal São João", created_at: NOW, updated_at: NOW },
    { id: "camp-003", user_id: UID, nome: "Electronic Nights - Marcus Flow", artista_id: "art-003", status: "pausado", tipo: "digital", data_inicio: d(-60), data_fim: d(-10), orcamento: 22000, gasto: 21500, impressoes: 560000, cliques: 22000, conversoes: 1800, observacoes: "Campanha encerrada - resultado positivo", created_at: NOW, updated_at: NOW },
    { id: "camp-004", user_id: UID, nome: "Sertanejo Summer - Ana Beatriz", artista_id: "art-004", status: "planejado", tipo: "digital", data_inicio: d(20), data_fim: d(80), orcamento: 35000, gasto: 0, impressoes: 0, cliques: 0, conversoes: 0, observacoes: "Campanha planejada para o lançamento", created_at: NOW, updated_at: NOW },
    { id: "camp-005", user_id: UID, nome: "Bossa Nova Revival - Trio Moderna", artista_id: "art-005", status: "concluido", tipo: "offline", data_inicio: d(-180), data_fim: d(-90), orcamento: 18000, gasto: 17200, impressoes: 320000, cliques: 12000, conversoes: 890, observacoes: "Campanha de mídia impressa e OOH", created_at: NOW, updated_at: NOW },
    { id: "camp-006", user_id: UID, nome: "Hip-Hop Awakening - Pedro Breaks", artista_id: "art-008", status: "ativo", tipo: "digital", data_inicio: d(-20), data_fim: d(40), orcamento: 15000, gasto: 8000, impressoes: 420000, cliques: 18000, conversoes: 1200, observacoes: "Focada em YouTube e TikTok", created_at: NOW, updated_at: NOW },
  ],

  leads: [
    { id: "lead-001", user_id: UID, nome: "Gabriel Rodrigues", email: "gabriel@emailrock.com", telefone: "(11) 98001-1111", origem: "instagram", servico_interesse: ["booking"], status_lead: "qualificado", prioridade: "alta", responsavel: "Mariana Oliveira", observacoes: "Banda de rock independente com 50k seguidores", tags: ["rock", "booking"], created_at: NOW, updated_at: NOW },
    { id: "lead-002", user_id: UID, nome: "Juliana Nascimento", email: "juliana@cantora.com.br", telefone: "(21) 97002-2222", origem: "website", servico_interesse: ["gestao_carreira", "distribuicao"], status_lead: "contato_realizado", prioridade: "alta", responsavel: "Mariana Oliveira", observacoes: "Cantora pop com 200k no Instagram", tags: ["pop", "carreira"], created_at: NOW, updated_at: NOW },
    { id: "lead-003", user_id: UID, nome: "Estúdio Vibe Records", email: "comercial@vibestudio.com.br", telefone: "(11) 3003-3333", origem: "indicacao", servico_interesse: ["producao_musical"], status_lead: "proposta_enviada", prioridade: "media", responsavel: "Rafael Santana", observacoes: "Estúdio parceiro para co-produção", tags: ["estudio", "parceria"], created_at: NOW, updated_at: NOW },
    { id: "lead-004", user_id: UID, nome: "Marco Tulio", email: "marco@producer.com.br", telefone: "(31) 96004-4444", origem: "facebook", servico_interesse: ["publishing"], status_lead: "novo", prioridade: "baixa", responsavel: null, observacoes: "Produtor buscando publisher", tags: ["producer", "publishing"], created_at: NOW, updated_at: NOW },
    { id: "lead-005", user_id: UID, nome: "Coletivo Afrobeat Brasil", email: "coletivo@afrobeat.com.br", telefone: "(21) 95005-5555", origem: "evento", servico_interesse: ["booking", "marketing_design"], status_lead: "negociacao", prioridade: "alta", responsavel: "Camila Torres", observacoes: "Grupo com grande apelo em festivais", tags: ["afrobeat", "festival"], created_at: NOW, updated_at: NOW },
    { id: "lead-006", user_id: UID, nome: "Sofia Alves", email: "sofia@sertanejo.com.br", telefone: "(64) 94006-6006", origem: "google", servico_interesse: ["gestao_carreira", "booking"], status_lead: "confirmado", prioridade: "alta", responsavel: "Mariana Oliveira", observacoes: "Dupla sertaneja com contrato pronto", tags: ["sertanejo", "dupla"], created_at: NOW, updated_at: NOW },
    { id: "lead-007", user_id: UID, nome: "Tech Music App", email: "parceria@techmusic.app", telefone: "(11) 93007-7777", origem: "linkedin", servico_interesse: ["distribuicao"], status_lead: "perdido", prioridade: "baixa", responsavel: "Diego Ferreira", observacoes: "App concorrente - não avançou", tags: ["tech", "app"], created_at: NOW, updated_at: NOW },
    { id: "lead-008", user_id: UID, nome: "DJ Fernanda Night", email: "fernanda@djnight.com.br", telefone: "(11) 92008-8888", origem: "instagram", servico_interesse: ["booking", "marketing_design"], status_lead: "contato_realizado", prioridade: "media", responsavel: "Camila Torres", observacoes: "DJ emergente do underground paulistano", tags: ["dj", "eletrônico"], created_at: NOW, updated_at: NOW },
    { id: "lead-009", user_id: UID, nome: "Banda Samba Urbano", email: "sambau@banda.com.br", telefone: "(21) 91009-9999", origem: "indicacao", servico_interesse: ["producao_musical", "distribuicao"], status_lead: "qualificado", prioridade: "media", responsavel: "Rafael Santana", observacoes: "Samba urbano com presença no Rio", tags: ["samba", "urbano"], created_at: NOW, updated_at: NOW },
    { id: "lead-010", user_id: UID, nome: "Festival Cultura Livre", email: "booking@culturalivro.com.br", telefone: "(61) 90010-0000", origem: "evento", servico_interesse: ["booking"], status_lead: "proposta_enviada", prioridade: "alta", responsavel: "Amanda Pereira", observacoes: "Festival cultural em Brasília", tags: ["festival", "cultura"], created_at: NOW, updated_at: NOW },
    { id: "lead-011", user_id: UID, nome: "Lucas Produtor", email: "lucas@beat.com.br", telefone: "(41) 98011-1100", origem: "website", servico_interesse: ["producao_musical"], status_lead: "arquivado", prioridade: "baixa", responsavel: null, observacoes: "Produtor iniciante sem projeto definido", tags: ["produtor"], created_at: NOW, updated_at: NOW },
    { id: "lead-012", user_id: UID, nome: "Agência Pulso Music", email: "comercial@pulso.com.br", telefone: "(11) 97012-1200", origem: "linkedin", servico_interesse: ["marketing_design", "distribuicao"], status_lead: "followup", prioridade: "media", responsavel: "Camila Torres", observacoes: "Agência buscando parceiro de distribuição", tags: ["agência", "marketing"], created_at: NOW, updated_at: NOW },
  ],

  contatos: [
    { id: "con-001", user_id: UID, nome: "Carlos Figueiredo", tipo_contato: "pessoa_juridica", email: "carlos@sony.com.br", telefone: "(11) 3333-4444", empresa: "Sony Music", cargo: "VP Comercial", status: "ativo", cidade: "São Paulo", estado: "SP", created_at: NOW, updated_at: NOW },
    { id: "con-002", user_id: UID, nome: "Amanda Rocha", tipo_contato: "pessoa_juridica", email: "amanda@universal.com.br", telefone: "(21) 2222-3333", empresa: "Universal Music", cargo: "Gerente de Licenças", status: "ativo", cidade: "Rio de Janeiro", estado: "RJ", created_at: NOW, updated_at: NOW },
    { id: "con-003", user_id: UID, nome: "Roberto Lima", tipo_contato: "pessoa_juridica", email: "roberto@globo.com", telefone: "(21) 2111-2222", empresa: "Globo Comunicações", cargo: "Diretor Musical", status: "ativo", cidade: "Rio de Janeiro", estado: "RJ", created_at: NOW, updated_at: NOW },
    { id: "con-004", user_id: UID, nome: "Fernanda Castro", tipo_contato: "pessoa_juridica", email: "fernanda@ambev.com.br", telefone: "(11) 4444-5555", empresa: "Ambev - Brahma", cargo: "Head de Marketing", status: "ativo", cidade: "São Paulo", estado: "SP", created_at: NOW, updated_at: NOW },
    { id: "con-005", user_id: UID, nome: "João Promoter", tipo_contato: "pessoa_fisica", email: "joao@promoter.com.br", telefone: "(41) 98888-9999", empresa: null, cargo: "Promoter Independente", status: "ativo", cidade: "Curitiba", estado: "PR", created_at: NOW, updated_at: NOW },
    { id: "con-006", user_id: UID, nome: "Alexandre Torres", tipo_contato: "pessoa_juridica", email: "alex@lollapalooza.com.br", telefone: "(11) 5555-6666", empresa: "Lollapalooza Brasil", cargo: "Booking Manager", status: "ativo", cidade: "São Paulo", estado: "SP", created_at: NOW, updated_at: NOW },
    { id: "con-007", user_id: UID, nome: "Patrícia Neves", tipo_contato: "pessoa_juridica", email: "patricia@distrokid.com", telefone: "(11) 6666-7777", empresa: "DistroKid BR", cargo: "Account Manager", status: "ativo", cidade: "São Paulo", estado: "SP", created_at: NOW, updated_at: NOW },
    { id: "con-008", user_id: UID, nome: "Lucas Mendes Spotify", tipo_contato: "pessoa_juridica", email: "lucas.mendes@spotify.com", telefone: "(11) 7777-8888", empresa: "Spotify Brasil", cargo: "Artist Relations", status: "ativo", cidade: "São Paulo", estado: "SP", created_at: NOW, updated_at: NOW },
    { id: "con-009", user_id: UID, nome: "Dr. Carlos Advocacia", tipo_contato: "pessoa_fisica", email: "carlos@advocacia.com.br", telefone: "(11) 3210-9876", empresa: "Carlos & Associados", cargo: "Advogado Sócio", status: "ativo", cidade: "São Paulo", estado: "SP", created_at: NOW, updated_at: NOW },
    { id: "con-010", user_id: UID, nome: "Beatriz Studio Foto", tipo_contato: "pessoa_fisica", email: "beatriz@foto.com.br", telefone: "(11) 98765-0000", empresa: null, cargo: "Fotógrafa e Videomaker", status: "ativo", cidade: "São Paulo", estado: "SP", created_at: NOW, updated_at: NOW },
    { id: "con-011", user_id: UID, nome: "Distribuidora Regional Sul", tipo_contato: "pessoa_juridica", email: "vendas@distrsul.com.br", telefone: "(51) 3456-7890", empresa: "Distribuidora Sul LTDA", cargo: "Vendas", status: "prospect", cidade: "Porto Alegre", estado: "RS", created_at: NOW, updated_at: NOW },
    { id: "con-012", user_id: UID, nome: "Carla Viana Rock Rio", tipo_contato: "pessoa_juridica", email: "carla@rockinrio.com.br", telefone: "(21) 9999-1111", empresa: "Rock in Rio", cargo: "Diretora de Booking", status: "prospect", cidade: "Rio de Janeiro", estado: "RJ", created_at: NOW, updated_at: NOW },
  ],

  projetos: [
    { id: "proj-001", user_id: UID, titulo: "Álbum Debut Vitória Lunar", descricao: "Produção e lançamento do primeiro álbum completo da artista", artista_id: "art-001", status: "em_andamento", data_inicio: "2025-10-01", data_fim: d(90), orcamento: 180000, created_at: NOW, updated_at: NOW },
    { id: "proj-002", user_id: UID, titulo: "Turnê Nacional 2026 - Ana Beatriz", descricao: "Turnê de 15 cidades pelo Brasil", artista_id: "art-004", status: "em_andamento", data_inicio: d(-30), data_fim: d(150), orcamento: 320000, created_at: NOW, updated_at: NOW },
    { id: "proj-003", user_id: UID, titulo: "Compilação Lander 10 Anos", descricao: "Álbum comemorativo com artistas do catálogo", artista_id: null, status: "planejado", data_inicio: d(60), data_fim: d(180), orcamento: 85000, created_at: NOW, updated_at: NOW },
    { id: "proj-004", user_id: UID, titulo: "Parceria Sony Premium Distribution", descricao: "Implementação de nova estrutura de distribuição com Sony", artista_id: null, status: "em_andamento", data_inicio: d(-60), data_fim: d(30), orcamento: 0, created_at: NOW, updated_at: NOW },
    { id: "proj-005", user_id: UID, titulo: "Raiz Nordestina - EP Volume 2", descricao: "Segundo EP do grupo com gravação no nordeste", artista_id: "art-002", status: "planejado", data_inicio: d(45), data_fim: d(120), orcamento: 65000, created_at: NOW, updated_at: NOW },
  ],

  licencas: [
    { id: "lic-001", user_id: UID, titulo: "Licença Globo - Noite de Luz - Novela das 21h", obra_id: "obra-001", cliente_id: "cli-003", tipo: "sync_tv", status: "ativo", data_inicio: d(-60), data_fim: d(120), valor: 28500, observacoes: "Uso em cenas da novela", created_at: NOW, updated_at: NOW },
    { id: "lic-002", user_id: UID, titulo: "Licença Vivo - Bossa Moderna - Comercial 2026", obra_id: "obra-005", cliente_id: "cli-010", tipo: "publicidade", status: "ativo", data_inicio: d(-5), data_fim: d(180), valor: 32000, observacoes: "Comercial TV e digital", created_at: NOW, updated_at: NOW },
    { id: "lic-003", user_id: UID, titulo: "Licença Streaming - Catálogo Lander - DistroKid", obra_id: null, cliente_id: "cli-006", tipo: "streaming", status: "ativo", data_inicio: "2025-01-01", data_fim: d(240), valor: 0, observacoes: "Contrato de distribuição streaming", created_at: NOW, updated_at: NOW },
    { id: "lic-004", user_id: UID, titulo: "Licença Brahma - Amor de Interior - Promo", obra_id: "obra-004", cliente_id: "cli-004", tipo: "publicidade", status: "negociando", data_inicio: d(30), data_fim: d(150), valor: 45000, observacoes: "Em aprovação jurídica", created_at: NOW, updated_at: NOW },
    { id: "lic-005", user_id: UID, titulo: "Licença Jogos - Frequência 440 - GameBR", obra_id: "obra-003", cliente_id: null, tipo: "jogo_eletronico", status: "expirado", data_inicio: d(-365), data_fim: d(-1), valor: 12000, observacoes: "Licença anual encerrada", created_at: NOW, updated_at: NOW },
  ],

  inventario: [
    { id: "inv-001", user_id: UID, nome: "Microfone Neumann U87", categoria: "Áudio", quantidade: 3, valor_unitario: 12000, localizacao: "Estúdio 1", status: "disponivel", responsavel: "Bruno Machado", setor: "Produção", dataEntrada: "2023-05-10", observacoes: "Microfone condensador para gravações vocais", created_at: NOW, updated_at: NOW },
    { id: "inv-002", user_id: UID, nome: "Interface SSL 2+", categoria: "Áudio", quantidade: 5, valor_unitario: 2800, localizacao: "Estúdio 2", status: "disponivel", responsavel: "Bruno Machado", setor: "Produção", dataEntrada: "2023-08-20", observacoes: "Interface de áudio USB para home studio", created_at: NOW, updated_at: NOW },
    { id: "inv-003", user_id: UID, nome: "Computador Apple Mac Studio", categoria: "Computador", quantidade: 4, valor_unitario: 18000, localizacao: "Escritório", status: "em_uso", responsavel: "Rafael Santana", setor: "Produção", dataEntrada: "2024-01-15", observacoes: "Estação de trabalho principal para produção musical", created_at: NOW, updated_at: NOW },
    { id: "inv-004", user_id: UID, nome: "CDJ Pioneer 3000", categoria: "Áudio", quantidade: 2, valor_unitario: 22000, localizacao: "Estoque", status: "disponivel", responsavel: "Bruno Machado", setor: "Produção", dataEntrada: "2022-11-05", observacoes: "CDJ profissional para performances ao vivo", created_at: NOW, updated_at: NOW },
    { id: "inv-005", user_id: UID, nome: "Câmera Sony A7 IV", categoria: "Vídeo", quantidade: 2, valor_unitario: 15000, localizacao: "Estoque", status: "em_uso", responsavel: "Camila Torres", setor: "Marketing", dataEntrada: "2024-03-22", observacoes: "Câmera mirrorless para produções audiovisuais", created_at: NOW, updated_at: NOW },
    { id: "inv-006", user_id: UID, nome: "Monitor Focal Alpha 80", categoria: "Áudio", quantidade: 4, valor_unitario: 4500, localizacao: "Estúdio 1", status: "disponivel", responsavel: "Bruno Machado", setor: "Produção", dataEntrada: "2023-02-28", observacoes: "Monitor de estúdio para mixagem profissional", created_at: NOW, updated_at: NOW },
    { id: "inv-007", user_id: UID, nome: "Teclado Midi Arturia KeyLab 61", categoria: "Áudio", quantidade: 2, valor_unitario: 3200, localizacao: "Estúdio 2", status: "disponivel", responsavel: "Rafael Santana", setor: "Produção", dataEntrada: "2023-09-14", observacoes: "Controlador MIDI para composição e arranjo", created_at: NOW, updated_at: NOW },
    { id: "inv-008", user_id: UID, nome: "Drone DJI Air 3", categoria: "Vídeo", quantidade: 1, valor_unitario: 8000, localizacao: "Estoque", status: "manutencao", responsavel: "Camila Torres", setor: "Marketing", dataEntrada: "2024-06-01", observacoes: "Drone para captação de imagens aéreas em shows", created_at: NOW, updated_at: NOW },
    { id: "inv-009", user_id: UID, nome: "Mesa de Som Yamaha CL5", categoria: "Áudio", quantidade: 1, valor_unitario: 85000, localizacao: "Estúdio 1", status: "em_uso", responsavel: "Bruno Machado", setor: "Produção", dataEntrada: "2022-06-15", observacoes: "Console digital para shows ao vivo e estúdio", created_at: NOW, updated_at: NOW },
    { id: "inv-010", user_id: UID, nome: "Iluminação LED PAR 64", categoria: "Iluminação", quantidade: 20, valor_unitario: 800, localizacao: "Estoque", status: "disponivel", responsavel: "Camila Torres", setor: "Produção", dataEntrada: "2023-11-10", observacoes: "Refletores LED para iluminação de palco", created_at: NOW, updated_at: NOW },
    { id: "inv-011", user_id: UID, nome: "Notebook Dell XPS 15", categoria: "Computador", quantidade: 3, valor_unitario: 9500, localizacao: "Escritório", status: "em_uso", responsavel: "Diego Ferreira", setor: "Administrativo", dataEntrada: "2023-07-20", observacoes: "Notebooks para equipe administrativa e financeira", created_at: NOW, updated_at: NOW },
    { id: "inv-012", user_id: UID, nome: "Truss de Alumínio Q30", categoria: "Estrutura", quantidade: 15, valor_unitario: 1200, localizacao: "Estoque", status: "disponivel", responsavel: "Bruno Machado", setor: "Produção", dataEntrada: "2021-08-30", observacoes: "Estrutura de treliça para suporte de iluminação e equipamentos", created_at: NOW, updated_at: NOW },
  ],

  notas_fiscais: [
    { id: "nf-001", user_id: UID, numero: "000001", serie: "1", tipo_nota: "nfs-e", status: "emitida", tomador_nome: "Globo Comunicações", tomador_cnpj: "03.456.789/0001-67", valor_total: 28500.00, valor_servicos: 28500.00, valor_iss: 712.50, data_emissao: d(-45), data_vencimento: d(-15), descricao_servico: "Licença de uso musical - sync TV", created_at: NOW, updated_at: NOW },
    { id: "nf-002", user_id: UID, numero: "000002", serie: "1", tipo_nota: "nfs-e", status: "emitida", tomador_nome: "Ambev - Brahma", tomador_cnpj: "04.567.890/0001-56", valor_total: 18000.00, valor_servicos: 18000.00, valor_iss: 450.00, data_emissao: d(-10), data_vencimento: d(20), descricao_servico: "Cachê artístico - DJ Marcus Flow - Evento", created_at: NOW, updated_at: NOW },
    { id: "nf-003", user_id: UID, numero: "000003", serie: "1", tipo_nota: "nfs-e", status: "emitida", tomador_nome: "Sony Music Entertainment Brasil", tomador_cnpj: "01.234.567/0001-89", valor_total: 45000.00, valor_servicos: 45000.00, valor_iss: 1125.00, data_emissao: d(-60), data_vencimento: d(-30), descricao_servico: "Distribuição física e digital - Q1 2026", created_at: NOW, updated_at: NOW },
    { id: "nf-004", user_id: UID, numero: "000004", serie: "1", tipo_nota: "nfs-e", status: "pendente", tomador_nome: "Vivo Telecom - Marketing", tomador_cnpj: "10.123.456/0001-90", valor_total: 32000.00, valor_servicos: 32000.00, valor_iss: 800.00, data_emissao: d(-5), data_vencimento: d(25), descricao_servico: "Licença musical - Comercial 2026 - Bossa Moderna", created_at: NOW, updated_at: NOW },
    { id: "nf-005", user_id: UID, numero: "000005", serie: "1", tipo_nota: "nfs-e", status: "cancelada", tomador_nome: "Festival Cultura Livre", tomador_cnpj: "11.234.567/0001-89", valor_total: 15000.00, valor_servicos: 15000.00, valor_iss: 375.00, data_emissao: d(-90), data_vencimento: d(-60), descricao_servico: "Cachê artístico - cancelado", created_at: NOW, updated_at: NOW },
  ],

  shares: [
    { id: "sha-001", user_id: UID, obra_id: "obra-001", artista_id: "art-001", percentual: 70, tipo: "composicao", created_at: NOW },
    { id: "sha-002", user_id: UID, obra_id: "obra-001", artista_id: null, percentual: 30, tipo: "composicao", detentor: "Lander Music Publishing", created_at: NOW },
    { id: "sha-003", user_id: UID, obra_id: "obra-002", artista_id: "art-002", percentual: 60, tipo: "composicao", created_at: NOW },
    { id: "sha-004", user_id: UID, obra_id: "obra-002", artista_id: null, percentual: 40, tipo: "composicao", detentor: "Lander Music Publishing", created_at: NOW },
    { id: "sha-005", user_id: UID, obra_id: "obra-003", artista_id: "art-003", percentual: 100, tipo: "composicao", created_at: NOW },
    { id: "sha-006", user_id: UID, obra_id: "obra-004", artista_id: "art-004", percentual: 50, tipo: "composicao", created_at: NOW },
    { id: "sha-007", user_id: UID, obra_id: "obra-004", artista_id: null, percentual: 50, tipo: "composicao", detentor: "Lander Music Publishing", created_at: NOW },
    { id: "sha-008", user_id: UID, obra_id: "obra-005", artista_id: "art-005", percentual: 100, tipo: "composicao", created_at: NOW },
    { id: "sha-009", user_id: UID, obra_id: "obra-006", artista_id: "art-001", percentual: 60, tipo: "composicao", created_at: NOW },
    { id: "sha-010", user_id: UID, obra_id: "obra-006", artista_id: "art-008", percentual: 40, tipo: "composicao", created_at: NOW },
    { id: "sha-011", user_id: UID, obra_id: "obra-008", artista_id: "art-008", percentual: 60, tipo: "composicao", created_at: NOW },
    { id: "sha-012", user_id: UID, obra_id: "obra-008", artista_id: null, percentual: 40, tipo: "composicao", detentor: "Lander Music Publishing", created_at: NOW },
    { id: "sha-013", user_id: UID, obra_id: "obra-010", artista_id: "art-003", percentual: 70, tipo: "composicao", created_at: NOW },
    { id: "sha-014", user_id: UID, obra_id: "obra-010", artista_id: null, percentual: 30, tipo: "composicao", detentor: "DJ Set Crew", created_at: NOW },
    { id: "sha-015", user_id: UID, obra_id: "obra-018", artista_id: "art-001", percentual: 50, tipo: "composicao", created_at: NOW },
  ],

  briefings: [
    { id: "bri-001", user_id: UID, titulo: "Briefing Lançamento Cidade Mágica", tipo: "lancamento", status: "aprovado", prioridade: "alta", artista_id: "art-001", cliente: "Lander Records", prazo: d(10), orcamento: 45000, publico_alvo: "18-35 anos, fãs de pop brasileiro", objetivos: "Alcançar 1M de streams na primeira semana", descricao: "Campanha integrada de lançamento do single Cidade Mágica incluindo conteúdo para todas as plataformas", observacoes: "Aprovado pela diretora de A&R", created_at: NOW, updated_at: NOW },
    { id: "bri-002", user_id: UID, titulo: "Briefing Show Turnê Nacional", tipo: "show", status: "em_producao", prioridade: "alta", artista_id: "art-004", cliente: "Ana Beatriz Management", prazo: d(25), orcamento: 320000, publico_alvo: "Fãs de sertanejo 16-45 anos", objetivos: "15 shows em 15 cidades", descricao: "Organização completa da turnê nacional", observacoes: "Aprovação pendente de 3 locais", created_at: NOW, updated_at: NOW },
    { id: "bri-003", user_id: UID, titulo: "Briefing Festival São João", tipo: "evento", status: "aprovado", prioridade: "media", artista_id: "art-002", cliente: "Festival São João Caruaru", prazo: d(5), orcamento: 28000, publico_alvo: "Público nordestino, todas as idades", objetivos: "Máxima exposição regional", descricao: "Ativação completa no maior São João do mundo", observacoes: null, created_at: NOW, updated_at: NOW },
    { id: "bri-004", user_id: UID, titulo: "Briefing Campanha Hip-Hop", tipo: "marketing", status: "aguardando", prioridade: "media", artista_id: "art-008", cliente: "Lander Records", prazo: d(30), orcamento: 15000, publico_alvo: "18-30 anos, fãs de hip-hop e trap", objetivos: "Crescer 100% seguidores em 60 dias", descricao: "Campanha digital focada em TikTok e YouTube", observacoes: "Aguardando aprovação do orçamento", created_at: NOW, updated_at: NOW },
    { id: "bri-005", user_id: UID, titulo: "Briefing Parceria Comercial Vivo", tipo: "comercial", status: "revisao", prioridade: "alta", artista_id: "art-005", cliente: "Vivo Telecom", prazo: d(-5), orcamento: 32000, publico_alvo: "Consumidores Vivo premium", objetivos: "Licenciar música para campanha TV/Digital", descricao: "Negociação de sync para campanha nacional Vivo", observacoes: "Em revisão jurídica", created_at: NOW, updated_at: NOW },
  ],

  conteudos: [
    { id: "cnt-001", user_id: UID, titulo: "Reels - Bastidores gravação Cidade Mágica", plataforma: ["Instagram", "TikTok"], tipo_conteudo: ["Reels/TikTok"], formato: ["Vertical 9:16"], status: "publicado", campanha_relacionada: "camp-001", descricao: "Vídeo dos bastidores da gravação no estúdio", data_publicacao: d(-10), horario_publicacao: "18:00", lancamento_id: "lanc-006", created_at: NOW, updated_at: NOW },
    { id: "cnt-002", user_id: UID, titulo: "Post - Anúncio pré-save Cidade Mágica", plataforma: ["Instagram", "Facebook"], tipo_conteudo: ["Post Feed"], formato: ["Quadrado 1:1"], status: "publicado", campanha_relacionada: "camp-001", descricao: "Post de anúncio do pré-save", data_publicacao: d(-7), horario_publicacao: "12:00", lancamento_id: "lanc-006", created_at: NOW, updated_at: NOW },
    { id: "cnt-003", user_id: UID, titulo: "Story - Countdown lançamento", plataforma: ["Instagram"], tipo_conteudo: ["Stories"], formato: ["Vertical 9:16"], status: "agendado", campanha_relacionada: "camp-001", descricao: "Stories de contagem regressiva", data_publicacao: d(14), horario_publicacao: "09:00", lancamento_id: "lanc-006", created_at: NOW, updated_at: NOW },
    { id: "cnt-004", user_id: UID, titulo: "YouTube - Lyric Video Noite de Luz", plataforma: ["YouTube"], tipo_conteudo: ["Vídeo"], formato: ["Horizontal 16:9"], status: "publicado", campanha_relacionada: null, descricao: "Lyric video oficial", data_publicacao: d(-88), horario_publicacao: "15:00", lancamento_id: "lanc-001", created_at: NOW, updated_at: NOW },
    { id: "cnt-005", user_id: UID, titulo: "TikTok - Raiz challenge São João", plataforma: ["TikTok"], tipo_conteudo: ["Reels/TikTok"], formato: ["Vertical 9:16"], status: "publicado", campanha_relacionada: "camp-002", descricao: "Challenge de dança para o São João", data_publicacao: d(-8), horario_publicacao: "19:00", lancamento_id: null, created_at: NOW, updated_at: NOW },
    { id: "cnt-006", user_id: UID, titulo: "Post - Novo lançamento Pedro Breaks", plataforma: ["Instagram", "Facebook", "Twitter"], tipo_conteudo: ["Post Feed"], formato: ["Quadrado 1:1"], status: "em_producao", campanha_relacionada: "camp-006", descricao: "Post de lançamento do single Trap do Norte", data_publicacao: d(5), horario_publicacao: "10:00", lancamento_id: "lanc-007", created_at: NOW, updated_at: NOW },
    { id: "cnt-007", user_id: UID, titulo: "Email marketing - Newsletter mensal", plataforma: ["Email"], tipo_conteudo: ["Newsletter"], formato: ["HTML"], status: "rascunho", campanha_relacionada: null, descricao: "Newsletter mensal com updates do catálogo", data_publicacao: d(7), horario_publicacao: "09:00", lancamento_id: null, created_at: NOW, updated_at: NOW },
    { id: "cnt-008", user_id: UID, titulo: "Spotify - Canvas Noite de Luz", plataforma: ["Spotify"], tipo_conteudo: ["Canvas/Loop"], formato: ["Vertical 9:16"], status: "publicado", campanha_relacionada: null, descricao: "Canvas animado para o single", data_publicacao: d(-89), horario_publicacao: "08:00", lancamento_id: "lanc-001", created_at: NOW, updated_at: NOW },
    { id: "cnt-009", user_id: UID, titulo: "LinkedIn - Case Sony Partnership", plataforma: ["LinkedIn"], tipo_conteudo: ["Post Feed"], formato: ["Horizontal 16:9"], status: "agendado", campanha_relacionada: null, descricao: "Post sobre a parceria com a Sony", data_publicacao: d(3), horario_publicacao: "08:00", lancamento_id: null, created_at: NOW, updated_at: NOW },
    { id: "cnt-010", user_id: UID, titulo: "Facebook - Anúncio Show Ana Beatriz Barretos", plataforma: ["Facebook"], tipo_conteudo: ["Anúncio/Ad"], formato: ["Horizontal 16:9", "Quadrado 1:1"], status: "publicado", campanha_relacionada: "camp-004", descricao: "Anúncio do show em Barretos", data_publicacao: d(-20), horario_publicacao: "10:00", lancamento_id: null, created_at: NOW, updated_at: NOW },
  ],

  tarefas_marketing: [
    { id: "tar-001", user_id: UID, titulo: "Criar arte para Instagram - Cidade Mágica", campanha_id: "camp-001", artista_id: "art-001", responsavel: "Camila Torres", status: "em_andamento", prioridade: "alta", data_entrega: d(5), descricao: "Pack de artes para feed e stories", created_at: NOW, updated_at: NOW },
    { id: "tar-002", user_id: UID, titulo: "Configurar Meta Ads - Pré-save", campanha_id: "camp-001", artista_id: "art-001", responsavel: "Camila Torres", status: "concluido", prioridade: "alta", data_entrega: d(-5), descricao: "Campanha de tráfego para pré-save", created_at: NOW, updated_at: NOW },
    { id: "tar-003", user_id: UID, titulo: "Roteiro vídeo bastidores São João", campanha_id: "camp-002", artista_id: "art-002", responsavel: "Camila Torres", status: "concluido", prioridade: "media", data_entrega: d(-8), descricao: "Roteiro para vídeo de bastidores no nordeste", created_at: NOW, updated_at: NOW },
    { id: "tar-004", user_id: UID, titulo: "Pitch editorial Spotify - Cidade Mágica", campanha_id: "camp-001", artista_id: "art-001", responsavel: "Mariana Oliveira", status: "em_andamento", prioridade: "alta", data_entrega: d(10), descricao: "Enviar pitch para curadoria do Spotify", created_at: NOW, updated_at: NOW },
    { id: "tar-005", user_id: UID, titulo: "Press kit atualizado - Vitória Lunar", campanha_id: null, artista_id: "art-001", responsavel: "Camila Torres", status: "pendente", prioridade: "media", data_entrega: d(15), descricao: "Atualizar press kit com novas fotos e bio", created_at: NOW, updated_at: NOW },
    { id: "tar-006", user_id: UID, titulo: "Entrevista coletiva imprensa - Lançamento", campanha_id: "camp-001", artista_id: "art-001", responsavel: "Mariana Oliveira", status: "pendente", prioridade: "alta", data_entrega: d(12), descricao: "Organizar coletiva de imprensa", created_at: NOW, updated_at: NOW },
    { id: "tar-007", user_id: UID, titulo: "Canal YouTube - Otimização SEO", campanha_id: null, artista_id: null, responsavel: "Camila Torres", status: "em_andamento", prioridade: "baixa", data_entrega: d(20), descricao: "Otimizar títulos e descrições dos vídeos", created_at: NOW, updated_at: NOW },
    { id: "tar-008", user_id: UID, titulo: "Contato distribuidoras regionais", campanha_id: null, artista_id: "art-002", responsavel: "Diego Ferreira", status: "pendente", prioridade: "media", data_entrega: d(30), descricao: "Negociar distribuição física no nordeste", created_at: NOW, updated_at: NOW },
    { id: "tar-009", user_id: UID, titulo: "Relatório mensal marketing - Março 2026", campanha_id: null, artista_id: null, responsavel: "Camila Torres", status: "concluido", prioridade: "alta", data_entrega: d(-1), descricao: "Consolidar métricas de todas as campanhas", created_at: NOW, updated_at: NOW },
    { id: "tar-010", user_id: UID, titulo: "Contato influenciadores - Lançamento Pedro Breaks", campanha_id: "camp-006", artista_id: "art-008", responsavel: "Camila Torres", status: "em_andamento", prioridade: "media", data_entrega: d(8), descricao: "Enviar kit para influenciadores de hip-hop", created_at: NOW, updated_at: NOW },
    { id: "tar-011", user_id: UID, titulo: "Planejamento TikTok - Raiz Nordestina", campanha_id: "camp-002", artista_id: "art-002", responsavel: "Camila Torres", status: "pendente", prioridade: "media", data_entrega: d(18), descricao: "Estratégia de conteúdo para TikTok", created_at: NOW, updated_at: NOW },
    { id: "tar-012", user_id: UID, titulo: "Campanha Email Marketing - Base Fãs Vitória", campanha_id: "camp-001", artista_id: "art-001", responsavel: "Camila Torres", status: "pendente", prioridade: "alta", data_entrega: d(3), descricao: "Newsletter para base de fãs cadastrados", created_at: NOW, updated_at: NOW },
    { id: "tar-013", user_id: UID, titulo: "Análise ROI campanha Marcus Flow - Q1", campanha_id: "camp-003", artista_id: "art-003", responsavel: "Diego Ferreira", status: "concluido", prioridade: "baixa", data_entrega: d(-10), descricao: "Relatório de retorno da campanha de inverno", created_at: NOW, updated_at: NOW },
    { id: "tar-014", user_id: UID, titulo: "Foto e vídeo - Ensaio Ana Beatriz Santos", campanha_id: null, artista_id: "art-004", responsavel: "Camila Torres", status: "em_andamento", prioridade: "alta", data_entrega: d(25), descricao: "Produção de fotos e vídeo para release", created_at: NOW, updated_at: NOW },
    { id: "tar-015", user_id: UID, titulo: "Monitoramento imprensa - Bossa Moderna", campanha_id: "camp-005", artista_id: "art-005", responsavel: "Mariana Oliveira", status: "em_andamento", prioridade: "baixa", data_entrega: d(35), descricao: "Clipping de mídia espontânea em veículos culturais", created_at: NOW, updated_at: NOW },
  ],

  metas_artistas: [
    { id: "meta-001", user_id: UID, artista_id: "art-001", titulo: "1 Milhão de Streams - Cidade Mágica", tipo: "streaming", valor_meta: 1000000, valor_atual: 0, data_inicio: d(15), data_fim: d(45), status: "pendente", created_at: NOW, updated_at: NOW },
    { id: "meta-002", user_id: UID, artista_id: "art-001", titulo: "Alcançar 500k seguidores Instagram", tipo: "redes_sociais", valor_meta: 500000, valor_atual: 382000, data_inicio: "2026-01-01", data_fim: d(90), status: "em_andamento", created_at: NOW, updated_at: NOW },
    { id: "meta-003", user_id: UID, artista_id: "art-002", titulo: "10 Shows no São João 2026", tipo: "shows", valor_meta: 10, valor_atual: 7, data_inicio: "2026-03-01", data_fim: d(60), status: "em_andamento", created_at: NOW, updated_at: NOW },
    { id: "meta-004", user_id: UID, artista_id: "art-003", titulo: "500k plays Beatport", tipo: "streaming", valor_meta: 500000, valor_atual: 342000, data_inicio: "2026-01-01", data_fim: d(120), status: "em_andamento", created_at: NOW, updated_at: NOW },
    { id: "meta-005", user_id: UID, artista_id: "art-004", titulo: "15 Cidades na Turnê Nacional", tipo: "shows", valor_meta: 15, valor_atual: 12, data_inicio: d(-30), data_fim: d(150), status: "em_andamento", created_at: NOW, updated_at: NOW },
    { id: "meta-006", user_id: UID, artista_id: "art-008", titulo: "Lançar 3 Singles em 2026", tipo: "lancamentos", valor_meta: 3, valor_atual: 1, data_inicio: "2026-01-01", data_fim: "2026-12-31", status: "em_andamento", created_at: NOW, updated_at: NOW },
  ],

  templates_contratos: [
    { id: "tmpl-001", user_id: UID, nome: "Template - Contrato de Exclusividade", tipo: "exclusividade", ativo: true, conteudo: "CONTRATO DE EXCLUSIVIDADE\n\nPor este instrumento particular, as partes...", header_image_url: null, footer_image_url: null, created_at: NOW, updated_at: NOW },
    { id: "tmpl-002", user_id: UID, nome: "Template - Contrato de Distribuição Digital", tipo: "distribuicao", ativo: true, conteudo: "CONTRATO DE DISTRIBUIÇÃO DIGITAL\n\nPor este instrumento...", header_image_url: null, footer_image_url: null, created_at: NOW, updated_at: NOW },
    { id: "tmpl-003", user_id: UID, nome: "Template - Licença de Uso Musical", tipo: "licenciamento", ativo: true, conteudo: "LICENÇA DE USO MUSICAL\n\nAutorizamos o uso da obra...", header_image_url: null, footer_image_url: null, created_at: NOW, updated_at: NOW },
  ],

  deteccoes: [
    { id: "det-001", user_id: UID, obra_id: "obra-001", plataforma: "Spotify", periodo: "2026-03", quantidade: 842300, valor: 4211.50, status: "confirmado", created_at: NOW, updated_at: NOW },
    { id: "det-002", user_id: UID, obra_id: "obra-002", plataforma: "Spotify", periodo: "2026-03", quantidade: 521000, valor: 2605.00, status: "confirmado", created_at: NOW, updated_at: NOW },
    { id: "det-003", user_id: UID, obra_id: "obra-004", plataforma: "Apple Music", periodo: "2026-03", quantidade: 312000, valor: 1872.00, status: "confirmado", created_at: NOW, updated_at: NOW },
    { id: "det-004", user_id: UID, obra_id: "obra-001", plataforma: "YouTube Music", periodo: "2026-03", quantidade: 1200000, valor: 3600.00, status: "confirmado", created_at: NOW, updated_at: NOW },
    { id: "det-005", user_id: UID, obra_id: "obra-003", plataforma: "Beatport", periodo: "2026-03", quantidade: 45000, valor: 675.00, status: "pendente", created_at: NOW, updated_at: NOW },
  ],

  takedowns: [
    { id: "take-001", user_id: UID, obra_id: "obra-001", plataforma: "SoundCloud", motivo: "Uso não autorizado sem licença", status: "concluido", data_solicitacao: d(-60), data_conclusao: d(-55), observacoes: "Conteúdo removido com sucesso", created_at: NOW, updated_at: NOW },
    { id: "take-002", user_id: UID, obra_id: "obra-004", plataforma: "YouTube", motivo: "Cover não licenciado", status: "em_andamento", data_solicitacao: d(-10), data_conclusao: null, observacoes: "Aguardando resposta do YouTube", created_at: NOW, updated_at: NOW },
    { id: "take-003", user_id: UID, obra_id: "obra-002", plataforma: "TikTok", motivo: "Uso indevido em conteúdo comercial", status: "pendente", data_solicitacao: d(-2), data_conclusao: null, observacoes: "Solicitação enviada", created_at: NOW, updated_at: NOW },
  ],

  relatorios_ecad: [
    { id: "ecad-001", user_id: UID, periodo: "2026-Q1", valor_total: 15670.90, status: "recebido", data_referencia: "2026-03-31", observacoes: "Royalties de execução pública Q1/2026", created_at: NOW, updated_at: NOW },
    { id: "ecad-002", user_id: UID, periodo: "2025-Q4", valor_total: 12450.00, status: "recebido", data_referencia: "2025-12-31", observacoes: "Royalties de execução pública Q4/2025", created_at: NOW, updated_at: NOW },
    { id: "ecad-003", user_id: UID, periodo: "2025-Q3", valor_total: 9870.50, status: "recebido", data_referencia: "2025-09-30", observacoes: "Royalties de execução pública Q3/2025", created_at: NOW, updated_at: NOW },
    { id: "ecad-004", user_id: UID, periodo: "2026-Q2", valor_total: 0, status: "pendente", data_referencia: d(60), observacoes: "Aguardando apuração", created_at: NOW, updated_at: NOW },
  ],

  regras: [
    { id: "reg-001", user_id: UID, nome: "Royalty Split Padrão - Composição", descricao: "Divisão padrão: 70% artista / 30% publisher", tipo: "royalty", ativo: true, parametros: { artista: 70, publisher: 30 }, created_at: NOW, updated_at: NOW },
    { id: "reg-002", user_id: UID, nome: "Comissão Booking - Shows Nacionais", descricao: "15% sobre cachê para shows nacionais", tipo: "comissao", ativo: true, parametros: { percentual: 15, tipo: "nacional" }, created_at: NOW, updated_at: NOW },
  ],

  lead_interactions: [
    { id: "li-001", user_id: UID, lead_id: "lead-001", tipo: "email", descricao: "Primeiro contato por email", data: d(-20), responsavel: "Mariana Oliveira", created_at: NOW },
    { id: "li-002", user_id: UID, lead_id: "lead-001", tipo: "ligacao", descricao: "Ligação de apresentação da Lander", data: d(-15), responsavel: "Mariana Oliveira", created_at: NOW },
    { id: "li-003", user_id: UID, lead_id: "lead-002", tipo: "reuniao", descricao: "Reunião virtual de apresentação", data: d(-10), responsavel: "Mariana Oliveira", created_at: NOW },
    { id: "li-004", user_id: UID, lead_id: "lead-005", tipo: "proposta", descricao: "Envio de proposta comercial", data: d(-5), responsavel: "Camila Torres", created_at: NOW },
    { id: "li-005", user_id: UID, lead_id: "lead-006", tipo: "reuniao", descricao: "Reunião presencial em SP", data: d(-3), responsavel: "Mariana Oliveira", created_at: NOW },
  ],

  vendas: [],
  catalogo: [],
  company_settings: [],
  fechamentos_contabeis: [],
  profiles: [],
  user_settings: [],
  roles: [],
  permissions: [],
  };
}

function loadMockData(): Record<string, unknown[]> {
  const seed = buildSeedData();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      const merged: Record<string, unknown[]> = { ...seed };
      for (const key of Object.keys(seed)) {
        const val = parsed[key];
        if (Array.isArray(val)) {
          merged[key] = val;
        }
      }
      return merged;
    }
  } catch {
  }
  return seed;
}

export const MOCK_DATA: Record<string, unknown[]> = loadMockData();

export function saveMockData(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_DATA));
  } catch {
  }
}

export function resetMockData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
  window.location.reload();
}

export const MOCK_COMPANY_SETTINGS = {
  id: "cs-001",
  user_id: UID,
  org_id: OID,
  company_name: "Lander Records LTDA",
  fantasy_name: "LANDER 360°",
  cnpj: "12.345.678/0001-99",
  inscricao_estadual: "123.456.789.000",
  inscricao_municipal: "12345678",
  logradouro: "Av. Paulista",
  numero: "1000",
  complemento: "12º andar",
  cep: "01310-100",
  cidade: "São Paulo",
  estado: "SP",
  banco: "Itaú Unibanco",
  agencia: "0001",
  conta: "12345-6",
};

export const MOCK_FECHAMENTOS = [
  { id: "fech-001", user_id: UID, org_id: OID, periodo: "2026-03", status: "fechado", data_fechamento: d(-1), receitas: 218307.50, despesas: 128600.00, resultado: 89707.50, observacoes: "Mês de março encerrado", created_at: NOW },
  { id: "fech-002", user_id: UID, org_id: OID, periodo: "2026-02", status: "fechado", data_fechamento: d(-32), receitas: 198450.00, despesas: 115200.00, resultado: 83250.00, observacoes: "Fevereiro encerrado", created_at: NOW },
  { id: "fech-003", user_id: UID, org_id: OID, periodo: "2026-01", status: "fechado", data_fechamento: d(-62), receitas: 175320.00, despesas: 102500.00, resultado: 72820.00, observacoes: "Janeiro encerrado", created_at: NOW },
  { id: "fech-004", user_id: UID, org_id: OID, periodo: "2025-12", status: "fechado", data_fechamento: d(-122), receitas: 312000.00, despesas: 189000.00, resultado: 123000.00, observacoes: "Dezembro - melhor mês do ano", created_at: NOW },
  { id: "fech-005", user_id: UID, org_id: OID, periodo: "2025-11", status: "fechado", data_fechamento: d(-152), receitas: 165400.00, despesas: 98700.00, resultado: 66700.00, observacoes: "Novembro encerrado", created_at: NOW },
  { id: "fech-006", user_id: UID, org_id: OID, periodo: "2025-10", status: "fechado", data_fechamento: d(-182), receitas: 189600.00, despesas: 112400.00, resultado: 77200.00, observacoes: "Outubro encerrado", created_at: NOW },
];

export const MOCK_ARTISTAS_ASSINADOS = (MOCK_DATA.artistas as Array<Record<string, unknown>>).filter(
  (a) => a.status === "contratado"
);

export const MOCK_USER = {
  id: UID,
  email: "admin@lander360.com",
  app_metadata: {},
  user_metadata: { full_name: "Admin Lander" },
  aud: "authenticated",
  created_at: NOW,
  role: "authenticated",
} as unknown;

export const MOCK_SESSION = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: MOCK_USER,
} as unknown;
