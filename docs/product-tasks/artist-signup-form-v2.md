# Reformular Formulário Público de Cadastro de Artista

## What & Why
Reorganizar e ampliar o formulário de `/signup/artista/:orgSlug` conforme especificação:
novos campos, multi-select para Tipo de Perfil, campo Gênero (sexo), Data de Nascimento,
lista completa de gêneros musicais ordenada alfabeticamente, campo Deezer, seção de
distribuidoras na Aba 2, e seção Resumo com dados do artista na Aba 3.
Mantém identidade visual, responsividade e estrutura de 3 abas.

## Done looks like

**Aba 1 — Dados Básicos** (em ordem):
- Nome Artístico
- Nome Civil
- Tipo de Perfil — grupo de checkboxes com múltipla seleção: DJ · DJ/Produtor · Compositor/Autor · Intérprete · Produtor (ao menos 1 obrigatório para avançar)
- Gênero — select ou radio com: Masculino / Feminino
- Gênero Musical — lista completa ordenada alfabeticamente
- E-mail (obrigatório)
- Telefone / WhatsApp (obrigatório)
- CPF
- Data de Nascimento (date picker ou input tipo date)

**Aba 2 — Links e Redes**:
- Instagram, TikTok, YouTube, Spotify, Apple Music, Deezer (novo), SoundCloud
- Link do Presskit
- Seção "Distribuidoras": Select de distribuidora (lista com as principais do mercado BR + "Outro") + Input de e-mail de share/acesso

**Aba 3 — Bio e Contexto**:
- Seção "Resumo" exibindo em cards ou linhas os valores preenchidos: Nome do Artista, Tipo de Perfil, Telefone/WhatsApp, E-mail
- Campos existentes mantidos: Biografia, Foto de Perfil (URL), Mensagem para a gravadora

Validação e submit: todos os campos novos incluídos no payload para `createArtistUseCase`;
campos sem campo dedicado na use case (deezer, distribuidora, distribuidora_email, data_nascimento)
vão em `notas_internas`.

## Out of scope
- Mudanças em outros módulos além de `ArtistaSignupPublic.tsx`
- Geração de resumo via IA/OpenAI — seção Resumo é display somente leitura com dados já preenchidos
- Integração real com distribuidoras (captura texto para `notas_internas`)

## Steps

1. **Tipos e constantes** — Adicionar ao `FormData`: `tipo_perfil: string[]`, `genero: string`, `data_nascimento: string`, `deezer: string`, `distribuidora: string`, `distribuidora_email: string`. Substituir `TIPOS` por `TIPO_PERFIL_OPTIONS` com as 5 opções. Expandir `GENEROS` para lista completa de gêneros musicais BR ordenada alfabeticamente (mínimo 30 gêneros). Adicionar `DISTRIBUIDORAS` (Believe, CD Baby, DistroKid, Ingrooves, Kontor, ONErpm, Orchard, Sony Music, Stem, Symphonic, TuneCore, Warner Music, Outro). Atualizar `EMPTY`.

2. **Aba 1 — Tipo de Perfil, Gênero, Data de Nascimento** — Remover Select "Tipo" e substituir por grupo de checkboxes visuais "Tipo de Perfil" (múltipla seleção, estilo badge/toggle). Adicionar Select "Gênero" (Masculino/Feminino). Adicionar Input type="date" ou DatePicker "Data de Nascimento". Atualizar `validateStep1` para exigir ao menos 1 tipo de perfil.

3. **Aba 2 — Deezer e Distribuidoras** — Inserir campo Deezer com ícone `SiDeezer` de `react-icons/si`. Adicionar seção "Distribuidoras" com Select + Input de e-mail.

4. **Aba 3 — seção Resumo** — Exibir card de Resumo no topo do Step 3 mostrando: Nome do Artista, Tipo de Perfil (join dos selecionados), Telefone/WhatsApp, E-mail — usando os dados do formulário preenchidos nas abas anteriores.

5. **handleSubmit — mapear campos novos** — Incluir campos novos no payload. `tipo` na use case recebe `tipo_perfil.join(", ")`. Campos extras vão em `notas_internas` junto com campos já existentes.

## Relevant files
- `client/src/modules/auth/pages/ArtistaSignupPublic.tsx`
- `client/src/modules/artist/application/createArtist.usecase.ts`
