# UX language glossary (PT-BR end-user copy)

Policy: every technical / internal / engineering surface is English; only actual
end-user visible frontend UX is Brazilian Portuguese (PT-BR). This glossary is the
single source for two decisions the policy leaves open:

1. which non-Portuguese terms are **accepted** in PT-BR end-user copy, and
2. the **canonical PT-BR rendering** of recurring technical concepts that reach the UI.

A term not listed in section 1 that appears in English in end-user copy is a
`USER_FACING_ENGLISH_VIOLATION`. European Portuguese forms (`registo`, `ficheiro`,
`utilizador`, `acção`, `activo`, `contacto`, `a carregar`, `está a ser`…) are not
PT-BR and are violations too.

## 1. Accepted non-Portuguese terms

| Category | Terms | Rationale |
|---|---|---|
| Brands, products, platform features | Instagram, YouTube, Facebook, TikTok, Spotify, Apple Music, Deezer, SoundCloud, Stripe, Stripe Connect, PIX, Google Ads, Search Console, Content ID, Marquee, Graph API, Reels, Stories, Threads, WhatsApp, Symphonic, ECAD, ABRAMUS, UBC, ISRC, ISWC, UPC | Proper names / external product vocabulary (`EXTERNAL_CONTRACT`) |
| Music-industry jargon established in Brazil | release, teaser, press kit, press release, lyric video, visualizer, stream(s), streaming, booker, booking, publisher, pitching, briefing, lead(s), share(s), split(s), master, rider, promoter, playlist, beat(s), sample(s), pack, making of, casting, pocket show, stems, sync, claim(s), feat, single, EP, remix, show | Standard vocabulary of the Brazilian music business |
| Marketing / SaaS loanwords | dashboard, template, tag(s), hashtag(s), post, feed, banner, folder, thumbnail, copy, headline, backlog, networking, upload, download, login, link, app, site, e-mail, chat, workspace, ticket(s), prompt, pop-up, checklist, insights, engagement, performance, ranking, marketing, design, influencer, creator | Current PT-BR usage |
| Admin / security technical terms (admin screens only) | API, token, webhook, MFA, SMTP, REST, CRM, KPI, ROI, CTR, MRR, churn, FAQ, SIEM | Audience is platform staff; no established PT-BR replacement |
| Plan names | Starter, Growth, Professional, Enterprise | Product names |
| DSP metadata values shown as values | Various Artists, Main Artist, "New Release", "Original", "Studio", "Official" | Values sent to distributors (`EXTERNAL_CONTRACT`) |
| Units, formats, abbreviations | JPEG, PNG, XLSX, xml, pixels, GB, MB, DD/MM/AAAA, Av., TED, Pub., Part., Ref., Exec., Dz, SA | Formats/abbreviations |

## 2. Canonical PT-BR renderings

| Technical concept (English, internal) | PT-BR end-user copy |
|---|---|
| tenant | workspace |
| e-mail / email | e-mail |
| logs | registros |
| audit trail | trilha de auditoria |
| adapter (integration capability) | conector |
| storage | armazenamento |
| billing | cobrança |
| grace period (dunning) | período de carência |
| unpaid | não pago |
| override (manual billing) | liberação manual |
| enforcement (billing) | controle de inadimplência |
| slug | identificador (URL) |
| placeholder (contract template token) | marcador |
| preview | pré-visualização |
| budget | orçamento |
| asset (campaign/brand material) | material / arquivo |
| metadata | metadados |
| match (rights detection) | correspondência |
| website | site |
| browser | navegador |
| build (app version) | versão |
| owner (workspace) | proprietário |
| type (field) | tipo |

## 3. Error copy

Raw technical error text never reaches the user. The API returns PT-BR copy in HTTP
exception messages and validation errors (`core/pipes/validation-messages.ts`); the web
renders errors only through `toUserMessage()` (`shared/lib/errors.ts`). See
`docs/engineering/frontend.md` and `docs/engineering/backend.md`.
