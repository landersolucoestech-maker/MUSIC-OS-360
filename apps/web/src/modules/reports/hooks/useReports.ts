/**
 * modules/reports/hooks/useReports.ts
 * PHASE 2.5 — hooks that consume ONLY the reports API.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  reportsApi, triggerBlobDownload,
  type EntitiesInventory, type ReportEntityDefinition,
  type ExportParams, type ImportValidationResult, type ImportCommitResult,
  type ImportUploadBody,
} from "../services/reports-api";

export function useReportEntities() {
  return useQuery<EntitiesInventory>({
    queryKey: ["reports", "entities"],
    queryFn: () => reportsApi.entities(),
    staleTime: 5 * 60_000,
  });
}

export function useReportDefinitions() {
  return useQuery<ReportEntityDefinition[]>({
    queryKey: ["reports", "definitions"],
    queryFn: () => reportsApi.definitions(),
    staleTime: 5 * 60_000,
  });
}

/** Export: always XLSX, downloaded as a file. */
export function useReportExport() {
  return useMutation({
    mutationFn: async (vars: { entity: string; params: ExportParams }) => {
      const { blob, filename } = await reportsApi.exportBlob(vars.entity, vars.params);
      triggerBlobDownload(blob, filename);
      return { filename };
    },
  });
}

export function useImportValidate() {
  return useMutation<ImportValidationResult, Error, { entity: string; body: ImportUploadBody }>({
    mutationFn: (v) => reportsApi.importValidate(v.entity, v.body),
  });
}

export function useImportCommit() {
  return useMutation<ImportCommitResult, Error, { entity: string; body: ImportUploadBody }>({
    mutationFn: (v) => reportsApi.importCommit(v.entity, v.body),
  });
}
