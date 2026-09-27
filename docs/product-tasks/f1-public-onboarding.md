# Onboarding Público de Artistas

## What & Why
Transformar a página `ArtistaSignupPublic` (atualmente um formulário simples) em uma landing page branded e funcional para captura de novos artistas. O artista preenche dados, envia documentos (press kit, bio, foto), links estratégicos (streaming, sociais) e assets — tudo é salvo automaticamente no sistema da gravadora como um novo registro de artista com status "onboarding".

## Done looks like
- URL pública `/cadastro/:orgSlug` exibe landing page branded com logo, descrição da gravadora e formulário multi-step
- Step 1 — Dados básicos: nome artístico, nome civil, tipo (solo/banda/DJ), gênero, email, telefone, CPF/CNPJ
- Step 2 — Links e redes: Spotify, Instagram, TikTok, YouTube, SoundCloud + campo "link de press kit" livre
- Step 3 — Mensagem e contexto: campo de texto livre (bio/proposta/contexto), upload de foto de perfil (URL ou upload direto), upload de press kit PDF (armazenado como URL na observação)
- Ao submeter: artista é criado no sistema com `status = "onboarding"`, todos os links salvos, observações preenchidas
- Página de sucesso com número de protocolo (ID do artista truncado) e instrução de próximos passos
- Se orgSlug inválido/ausente: mensagem de erro clara ao invés de formulário em branco
- Responsivo, dark/light mode, sem necessidade de login

## Out of scope
- Upload real de arquivos para storage (usar campos de URL por enquanto)
- Integração com email (notificação ao admin fica para fase futura)
- Múltiplos documentos além de press kit
- Preview do press kit em-app

## Steps
1. **Redesenhar landing page** — Substituir o layout simples por uma landing com hero section (nome da gravadora, tagline, CTA), seção de benefícios e formulário multi-step em card centralizado
2. **Implementar stepper multi-step** — 3 steps com indicador de progresso, validação por step, navegação prev/next, step atual persistido em estado local
3. **Step de links e redes sociais** — Campos para Spotify, Apple Music, YouTube, Instagram, TikTok, SoundCloud, mais campo livre para press kit URL
4. **Step de bio e assets** — Campo de texto livre para proposta/contexto, campo de foto URL, campo de press kit URL (PDF), preview de imagem
5. **Persistência e página de sucesso** — Ao submeter, criar artista com todos os campos preenchidos e status "onboarding"; exibir tela de confirmação com protocolo

## Relevant files
- `client/src/modules/auth/pages/ArtistaSignupPublic.tsx`
- `client/src/modules/artist/components/ArtistaForm.tsx`
- `client/src/modules/artist/application/createArtist.usecase.ts`
- `client/src/modules/artist/hooks/useArtistas.ts`
- `client/src/app/routes/`
