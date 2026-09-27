import { lazy } from "react";
import { Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const Contracts = lazy(() => import("@/modules/contracts/pages/Contracts"));
const ContractTemplates = lazy(() => import("@/modules/contracts/pages/ContractTemplates"));

export function contractsRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/contracts" element={<P><Contracts /></P>} />
      <Route path="/contracts/templates" element={<P><ContractTemplates /></P>} />
    </>
  );
}
