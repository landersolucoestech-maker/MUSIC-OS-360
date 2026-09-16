---
title: Formulário de artista relacional
---
# Formulário de Artista Relacional

## What & Why

Refatorar `ArtistaFormModal.tsx` (actual: 942 linhas, ~55 useState, entidade única por perfil)
para um formulário relacional com react-hook-form + useFieldArray que suporte múltiplos
relacionamentos comerciais simultâneos por artista. O modelo actual é rígido (um único
tipo de perfil por artista) e não escala para a realidade de labels e distribuidoras que
gerem artistas com múltiplos empresários, gravadoras, editoras e equipe ao mesmo tempo.

## Done looks like

- O botão "Novo Artista" e "Editar Artista" abre o modal refatorado
- Seção 1 (Informações Básicas): upload imagem, nome artístico, gênero musical,
  especialidades, documentos, presskit, biografia, MAIS slug artístico automático,
  tags musicais (chips), fase da carreira (iniciante / em ascensão / consolidado / mainstream)
- Seção 2 (Dados Pessoais): inalterada
- Seção 3 (Dados Bancários): inalterada
- Seção 4 (Redes Sociais): inalterada + validação automática de URLs por plataforma
- Seção 5 (Relacionamentos Comerciais): substituiu "Tipo de Perfil" fixo
  - Cada subsecção tem botão "Adicionar" e cards individuais removíveis
  - Empresários: múltiplos (nome, telefone, email) + distribuidoras próprias
  - Gravadoras: múltiplas (nome, telefone, email) + responsáveis + distribuidoras
  - Editoras: múltiplas (nome, telefone, email) + distribuidoras
  - Bookers: múltiplos (nome, telefone, email)
  - Jurídico: múltiplos (nome, telefone, email, escritório)
  - Financeiro: múltiplos (nome, telefone, email)
  - Contador: múltiplos (nome, telefone, email, CRC)
  - Assessoria: múltiplos (nome, telefone, email)
- Seção 6 (Distribuidoras globais): REMOVIDA — distribuidoras pertencem às entidades
- Formulário carrega dados existentes corretamente em modo edição
- TypeScript sem erros, mock data persiste no localStorage

## Out of scope

- Backend real (mock data + localStorage apenas)
- Importação de Excel (mapper de export pode ser atualizado como bônus, mas não bloqueia)
- Módulo CRM: nenhuma mudança nos hooks de clientes/gravadoras do CRM
- Redesign visual além do necessário (manter shadcn/Radix actuais)
- Página pública de onboarding (ArtistaSignupPublic.tsx — intocada)

## Steps

1. **Tipos e Artista interface** — Adicionar campos novos ao tipo `Artista` em `useArtistas.ts`:
   `slug_artistico`, `tags_musicais` (string[] | null), `fase_carreira` (string | null),
   `relacionamentos` (array tipado com subtipo `ArtistaRelacionamento` cobrindo todas as
   entidades: empresario, gravadora, editora, booker, juridico, financeiro, contador,
   assessoria — cada uma com campos nome/telefone/email + campos opcionais escritório,
   CRC, responsáveis[], distribuidoras[]). Manter campos legados de
   empresario_*, gravadora_* e distribuidoras_* como opcionais deprecated para não
   quebrar código existente.

2. **Schema do form (react-hook-form)** — Criar o schema TypeScript `ArtistaFormValues`
   compatível com a nova estrutura relacional, usando `useFieldArray` para cada tipo de
   entidade. Este schema é interno ao formulário e independente do tipo `Artista` do DB —
   o mapper faz a ponte.

3. **Refatorar ArtistaFormModal.tsx** — Substituir todos os ~55 `useState` por um único
   `useForm<ArtistaFormValues>`. Implementar `useFieldArray` para cada seção relacional
   (empresarios, gravadoras, editoras, bookers, juridico, financeiro, contador, assessoria).
   Cada array usa `useFieldArray` aninhado para distribuidoras dentro de cada entidade.
   Manter o Dialog, layout de seções numeradas e estrutura visual actual.

4. **Seção Relacionamentos Comerciais** — Construir a UI da nova seção 5: cards por
   entidade, botão "Adicionar X", botão remover por card, campos inline por item.
   Distribuidoras ficam dentro dos cards de empresário/gravadora/editora como subsecção.
   Listas de distribuidoras disponíveis: ONErpm, DistroKid, 30 Por 1, Symphonic, Somvibe,
   SoundOn, MusicPro, Outro (+ campo livre para custom).

5. **Novos campos na Seção 1** — Adicionar slug artístico (gerado automaticamente do nome
   artístico, editável manualmente), tags musicais (input chip com Enter/vírgula), fase da
   carreira (Select: iniciante / em ascensão / consolidado / mainstream).

6. **Validação de URLs de redes sociais** — Adicionar validação inline em tempo real para
   Spotify, Instagram, YouTube, TikTok, SoundCloud, Deezer, Apple Music. Mostrar ícone de
   check/erro ao lado de cada campo. Reutilizar extractors já existentes no mapper.

7. **Atualizar artista.mapper.ts** — Atualizar `artistaToFormFields` e `formToArtistaPayload`
   para serializar/deserializar o array `relacionamentos` de/para o tipo `Artista`.
   Manter backward-compat nos campos legados para artistas já cadastrados.

8. **TypeScript e testes** — Correr `cd client && npx tsc --noEmit` e confirmar zero erros.
   Verificar que o formulário abre, preenche, salva e recarrega um artista em modo edição.

## Relevant files

- `client/src/modules/artist/components/ArtistaFormModal.tsx`
- `client/src/modules/artist/hooks/useArtistas.ts`
- `client/src/modules/artist/mappers/artista.mapper.ts`
- `client/src/modules/artist/mappers/index.ts`
- `client/src/modules/artist/pages/Artistas.tsx`
- `client/src/shared/data/mockData.ts`