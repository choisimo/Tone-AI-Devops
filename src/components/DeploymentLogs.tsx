import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Terminal, 
  CheckCircle, 
  Loader2, 
  GitBranch, 
  Server, 
  Shield,
  Zap,
  Globe,
  Clock
} from "lucide-react";

interface LogEntry {
  id: string;
  message: string;
  status: "pending" | "running" | "completed" | "error";
  timestamp: Date;
  icon: React.ReactNode;
  details?: string;
}

interface DeploymentLogsProps {
  isActive: boolean;
  onComplete: (result: any) => void;
  prompt: string;
}

export const DeploymentLogs = ({ isActive, onComplete, prompt }: DeploymentLogsProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const deploymentSteps = [
    {
      message: "요구사항 분석 중...",
      details: "Google Gemini API로 자연어 해석",
      icon: <Zap className="h-4 w-4" />,
      duration: 2000
    },
    {
      message: "설계도(YAML) 생성 완료",
      details: "Kubernetes + Istio + Vault 설정 자동 생성",
      icon: <Terminal className="h-4 w-4" />,
      duration: 3000
    },
    {
      message: "Git 저장소에 커밋 중...",
      details: "Config Repo에 인프라 설계도 저장",
      icon: <GitBranch className="h-4 w-4" />,
      duration: 2000
    },
    {
      message: "Argo CD가 동기화를 시작했습니다",
      details: "GitOps 기반 자동 배포 트리거",
      icon: <Server className="h-4 w-4" />,
      duration: 4000
    },
    {
      message: "Kubernetes 클러스터에 배포 중...",
      details: "Pod, Service, Ingress 리소스 생성",
      icon: <Server className="h-4 w-4" />,
      duration: 3000
    },
    {
      message: "Istio 보안 정책 적용 중...",
      details: "mTLS + AuthorizationPolicy 자동 설정",
      icon: <Shield className="h-4 w-4" />,
      duration: 2500
    },
    {
      message: "도메인 연결 및 SSL 인증서 발급...",
      details: "Let's Encrypt 자동 인증서 + Gateway 설정",
      icon: <Globe className="h-4 w-4" />,
      duration: 3000
    },
    {
      message: "배포 완료! 🎉",
      details: "모든 서비스가 정상 동작하고 있습니다",
      icon: <CheckCircle className="h-4 w-4" />,
      duration: 1000
    }
  ];

  useEffect(() => {
    if (!isActive) return;

    setLogs([]);
    setCurrentStep(0);

    let stepIndex = 0;
    
    const processStep = () => {
      if (stepIndex >= deploymentSteps.length) {
        // All steps completed, trigger onComplete
        setTimeout(() => {
          onComplete({
            liveUrl: "https://chat.my-app.com",
            sourceRepo: "https://github.com/tone-platform/my-chat-app",
            configRepo: "https://github.com/tone-platform/my-chat-app-config",
            services: ["Frontend", "Backend", "Redis", "Database"],
            status: "deployed"
          });
        }, 1000);
        return;
      }

      const step = deploymentSteps[stepIndex];
      const logEntry: LogEntry = {
        id: `step-${stepIndex}`,
        message: step.message,
        details: step.details,
        status: "running",
        timestamp: new Date(),
        icon: step.icon
      };

      // Add new log entry
      setLogs(prev => [...prev, logEntry]);
      setCurrentStep(stepIndex);

      // Complete current step after duration
      setTimeout(() => {
        setLogs(prev => prev.map(log => 
          log.id === logEntry.id 
            ? { ...log, status: "completed" }
            : log
        ));
        
        stepIndex++;
        // Process next step
        setTimeout(processStep, 500);
      }, step.duration);
    };

    // Start processing
    processStep();
  }, [isActive, onComplete]);

  if (!isActive) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8 animate-slide-in">
          <h2 className="text-3xl font-bold mb-2">AI가 마법을 부리고 있습니다</h2>
          <p className="text-muted-foreground">
            "{prompt.slice(0, 80)}{prompt.length > 80 ? '...' : ''}"
          </p>
        </div>

        {/* Progress */}
        <Card className="p-6 bg-gradient-card border-border/50 shadow-card animate-slide-in">
          <div className="flex items-center gap-4 mb-4">
            <Terminal className="h-6 w-6 text-tone-accent" />
            <h3 className="text-xl font-semibold">실시간 배포 로그</h3>
            <Badge variant="secondary" className="ml-auto">
              {currentStep + 1} / {deploymentSteps.length}
            </Badge>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {logs.map((log, index) => (
              <div 
                key={log.id} 
                className={`flex items-start gap-3 p-4 rounded-lg border transition-all duration-500 animate-slide-in ${
                  log.status === "completed" 
                    ? "bg-tone-success/10 border-tone-success/30" 
                    : "bg-card/50 border-border/50"
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="mt-1">
                  {log.status === "completed" ? (
                    <CheckCircle className="h-4 w-4 text-tone-success" />
                  ) : (
                    <Loader2 className="h-4 w-4 text-tone-accent animate-spin" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {log.icon}
                    <span className="font-medium">{log.message}</span>
                    <Clock className="h-3 w-3 text-muted-foreground ml-auto" />
                    <span className="text-xs text-muted-foreground">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  {log.details && (
                    <p className="text-sm text-muted-foreground">{log.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};