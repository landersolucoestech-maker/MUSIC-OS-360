/**
 * PT-BR labels for content-detection technical values. The API returns the
 * canonical English value (content_detections.type); the UI never renders it
 * raw.
 */
export const DETECTION_TYPE_LABELS_PT_BR: Readonly<Record<string, string>> = {
  unauthorized_use: "Uso não autorizado",
};

export function detectionTypeLabel(type: string | null | undefined): string {
  return (type && DETECTION_TYPE_LABELS_PT_BR[type]) || "Outro tipo de uso";
}
