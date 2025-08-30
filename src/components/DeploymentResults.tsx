import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ExternalLink, 
  GitBranch, 
  Copy, 
  CheckCircle,
  Globe,
  Database,
  Shield,
  Zap,
  ArrowLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DeploymentResult {
  liveUrl: string;
  sourceRepo: string;
  configRepo: string;
  services: string[];
  status: string;
}

interface DeploymentResultsProps {
  result: DeploymentResult;
  onStartNew: () => void;
}

export const DeploymentResults = ({ result, onStartNew }: DeploymentResultsProps) => {
  const { toast } = useToast();

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "복사 완료",
        description: `${label}이(가) 클립보드에 복사되었습니다.`,
      });
    } catch (err) {
      toast({
        title: "복사 실패",
        description: "클립보드 복사에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const serviceIcons = {
    "Frontend": <Globe className="h-4 w-4" />,
    "Backend": <Zap className="h-4 w-4" />,
    "Redis": <Database className="h-4 w-4" />,
    "Database": <Database className="h-4 w-4" />
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Success Header */}
        <div className="text-center mb-8 animate-slide-in">
          <div className="flex items-center justify-center mb-6">
            <div className="p-6 bg-gradient-card rounded-3xl border border-tone-success/30 shadow-glow">
              <CheckCircle className="h-16 w-16 text-tone-success animate-pulse-glow" />
            </div>
          </div>
          
          <h2 className="text-4xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            🎉 배포 완료!
          </h2>
          
          <p className="text-xl text-muted-foreground">
            당신의 서비스가 클라우드에서 실행되고 있습니다
          </p>
        </div>

        {/* Live URL */}
        <Card className="p-8 bg-gradient-card border-tone-success/30 shadow-card animate-slide-in">
          <div className="flex items-center gap-4 mb-6">
            <Globe className="h-8 w-8 text-tone-success" />
            <div>
              <h3 className="text-2xl font-semibold">Live URL</h3>
              <p className="text-muted-foreground">즉시 접속 가능한 서비스 주소</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 p-4 bg-background/50 rounded-lg border border-border/50">
            <code className="flex-1 text-lg font-mono text-tone-accent">
              {result.liveUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(result.liveUrl, "Live URL")}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button asChild>
              <a href={result.liveUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                접속하기
              </a>
            </Button>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Source Repository */}
          <Card className="p-6 bg-gradient-card border-border/50 shadow-card animate-slide-in" style={{animationDelay: "0.1s"}}>
            <div className="flex items-center gap-3 mb-4">
              <GitBranch className="h-6 w-6 text-tone-accent" />
              <div>
                <h4 className="text-lg font-semibold">Source Repository</h4>
                <p className="text-sm text-muted-foreground">애플리케이션 코드 저장소</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="p-3 bg-background/50 rounded border border-border/50">
                <code className="text-sm font-mono text-foreground/80">
                  {result.sourceRepo}
                </code>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(result.sourceRepo, "Source Repository")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={result.sourceRepo} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    GitHub
                  </a>
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                이 저장소에 코드를 푸시하면 자동으로 배포됩니다
              </p>
            </div>
          </Card>

          {/* Config Repository */}
          <Card className="p-6 bg-gradient-card border-border/50 shadow-card animate-slide-in" style={{animationDelay: "0.2s"}}>
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-6 w-6 text-tone-glow" />
              <div>
                <h4 className="text-lg font-semibold">Config Repository</h4>
                <p className="text-sm text-muted-foreground">인프라 설계도 저장소</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="p-3 bg-background/50 rounded border border-border/50">
                <code className="text-sm font-mono text-foreground/80">
                  {result.configRepo}
                </code>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(result.configRepo, "Config Repository")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={result.configRepo} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    GitHub
                  </a>
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Kubernetes, Istio, Vault 설정이 코드로 관리됩니다
              </p>
            </div>
          </Card>
        </div>

        {/* Service Architecture */}
        <Card className="p-6 bg-gradient-card border-border/50 shadow-card animate-slide-in" style={{animationDelay: "0.3s"}}>
          <div className="flex items-center gap-3 mb-6">
            <Zap className="h-6 w-6 text-tone-accent" />
            <h4 className="text-lg font-semibold">배포된 서비스 구성</h4>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {result.services.map((service, index) => (
              <div key={service} className="flex items-center gap-2 p-3 bg-background/50 rounded border border-border/50">
                {serviceIcons[service as keyof typeof serviceIcons]}
                <span className="text-sm font-medium">{service}</span>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-tone-success/10 border border-tone-success/30 rounded-lg">
            <div className="flex items-center gap-2 text-tone-success">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">제로 트러스트 보안 자동 적용</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              모든 서비스 간 통신이 mTLS로 암호화되고, 세밀한 접근 제어가 적용됩니다
            </p>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 pt-6 animate-slide-in" style={{animationDelay: "0.4s"}}>
          <Button 
            variant="outline" 
            onClick={onStartNew}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            새로운 서비스 만들기
          </Button>
          
          <Button asChild>
            <a href={result.liveUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              서비스 확인하기
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};