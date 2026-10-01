import { FileText } from "lucide-react";
import { EmptyState } from "@/shared/components/EmptyState";

/**
 * HR "Documentos" tab. Employee documents have no backend table or route
 * (employee_documents is listed in PENDING_TABLES of api-client), so the tab
 * says so instead of rendering upload/delete controls that cannot persist.
 */
export function EmployeeDocumentsUnavailable() {
  return (
    <div data-testid="documents-unavailable">
      <EmptyState
        icon={FileText}
        title="Documentos de funcionários indisponíveis"
        description="Este módulo ainda não está disponível. Envio, consulta e exclusão de documentos de funcionários serão liberados quando o armazenamento estiver ativo."
      />
    </div>
  );
}
