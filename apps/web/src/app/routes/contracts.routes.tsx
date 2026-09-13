import { lazy } from "react";
import { Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const Contracts = lazy(() => import("@/modules/contracts/pages/Contracts"));
const ContractTemplates = lazy(() => import("@/modules/contracts/pages/ContractTemplates"));

export function contractsRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/contratos" element={<P><Contracts /></P>} />
      <Route path="/contratos/templates" element={<P><ContractTemplates /></P>} />
    </>
  );
}
