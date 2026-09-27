import { FeatureGate } from "@/shared/components/FeatureGate";
import { MainLayout } from "@/shared/components/MainLayout";
import { AiCreativeWorkspace } from "../components/ai-creative/AiCreativeWorkspace";

export default function AiCreative() {
  return (
    <FeatureGate feature="moduleMarketing" featureName="Marketing">
      <MainLayout title="IA Criativa" description="Criação, perfil, pitching, tendências, métricas e histórico.">
        <div className="space-y-6">
          <AiCreativeWorkspace />
        </div>
      </MainLayout>
    </FeatureGate>
  );
}



