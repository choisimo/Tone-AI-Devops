import { useState } from "react";
import { MagicCanvas } from "@/components/MagicCanvas";
import { DeploymentLogs } from "@/components/DeploymentLogs";
import { DeploymentResults } from "@/components/DeploymentResults";

type AppState = "canvas" | "deploying" | "completed";

interface DeploymentResult {
  liveUrl: string;
  sourceRepo: string;
  configRepo: string;
  services: string[];
  status: string;
}

const Index = () => {
  const [appState, setAppState] = useState<AppState>("canvas");
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);

  const handleDeploy = (prompt: string) => {
    setCurrentPrompt(prompt);
    setAppState("deploying");
  };

  const handleDeploymentComplete = (result: DeploymentResult) => {
    setDeploymentResult(result);
    setAppState("completed");
  };

  const handleStartNew = () => {
    setAppState("canvas");
    setCurrentPrompt("");
    setDeploymentResult(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Canvas State */}
      {appState === "canvas" && (
        <MagicCanvas 
          onDeploy={handleDeploy} 
          isDeploying={false} 
        />
      )}

      {/* Deploying State */}
      {appState === "deploying" && (
        <DeploymentLogs 
          isActive={true}
          onComplete={handleDeploymentComplete}
          prompt={currentPrompt}
        />
      )}

      {/* Completed State */}
      {appState === "completed" && deploymentResult && (
        <DeploymentResults 
          result={deploymentResult}
          onStartNew={handleStartNew}
        />
      )}
    </div>
  );
};

export default Index;