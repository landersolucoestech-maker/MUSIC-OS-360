// ============================================================================
// AdminKnowledge — Knowledge Base management inside the Admin Panel.
//
// There is NO Knowledge Base backend. KnowledgeBaseManager operates
// on localStorage (mock, via useKnowledgeArticles) and only serves
// UI iteration in development. That is why, in staging/production
// (IS_PROD), the screen is DISABLED and shows a "feature
// unavailable" state — no localStorage/mock is used as a runtime source and
// no fictitious data is shown. The mocks are restricted to dev/test/storybook.
// ============================================================================

import { BookOpen } from "lucide-react";
import { AdminLayout } from "../layouts/AdminLayout";
import { KnowledgeBaseManager } from "../components/knowledge/KnowledgeBaseManager";
import { EmptyState } from "@/shared/components/EmptyState";
import { IS_PROD } from "@/shared/lib/env";

export default function AdminKnowledge() {
  return (
    <AdminLayout>
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Base de Conhecimento</h1>
            <p className="text-sm text-muted-foreground">Gerencie artigos, FAQs, tutoriais e documentação do suporte.</p>
          </div>
        </div>

        {IS_PROD ? (
          <EmptyState
            icon={BookOpen}
            title="Funcionalidade indisponível"
            description="A Base de Conhecimento depende de um backend ainda não implementado. Para preservar a integridade dos dados, nenhum conteúdo fictício é exibido em homologação/produção."
          />
        ) : (
          <KnowledgeBaseManager />
        )}
      </div>
    </AdminLayout>
  );
}
