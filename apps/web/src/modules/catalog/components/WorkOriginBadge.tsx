import { Badge } from "@/shared/ui/badge";
import { WORK_ORIGIN_BADGE_LABELS, type WorkOrigin } from "@/modules/catalog/constants/work-options";

/** PT-BR badge of `works.work_origin` (a null/absent origin reads as reference). */
export const WorkOriginBadge = ({
  origin,
}: {
  origin?: WorkOrigin | string | null;
}) => {
  if (origin === "original") {
    return (
      <Badge variant="info" data-testid="badge-work-origin-original">
        {WORK_ORIGIN_BADGE_LABELS.original}
      </Badge>
    );
  }
  return (
    <Badge variant="warning" data-testid="badge-work-origin-reference">
      {WORK_ORIGIN_BADGE_LABELS.reference}
    </Badge>
  );
};
