import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sparkles, Zap } from "lucide-react";

interface MagicCanvasProps {
  onDeploy: (prompt: string) => void;
  isDeploying: boolean;
}

export const MagicCanvas = ({ onDeploy, isDeploying }: MagicCanvasProps) => {
  const [prompt, setPrompt] = useState("");

  const handleDeploy = () => {
    if (prompt.trim() && !isDeploying) {
      onDeploy(prompt);
    }
  };

  const examplePrompts = [
    "Python으로 만든 실시간 채팅 앱, Redis 사용, 도메인은 chat.my-app.com",
    "Node.js REST API with PostgreSQL database for a todo app",
    "React 대시보드 앱과 Express 백엔드, JWT 인증 포함",
    "Go 마이크로서비스로 이메일 발송 API, SMTP 연결"
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-primary opacity-20 blur-3xl rounded-full animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-tone-accent opacity-15 blur-3xl rounded-full animate-float" style={{animationDelay: "1s"}} />
      
      {/* Main content */}
      <div className="relative z-10 w-full max-w-4xl mx-auto text-center">
        {/* Header */}
        <div className="mb-12 animate-slide-in">
          <div className="flex items-center justify-center mb-6">
            <div className="p-4 bg-gradient-card rounded-2xl border border-border shadow-glow">
              <Sparkles className="h-12 w-12 text-tone-glow animate-pulse-glow" />
            </div>
          </div>
          
          <h1 className="text-6xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent">
            Project TONE
          </h1>
          
          <p className="text-xl text-muted-foreground mb-4">
            AI 기반 자동화 DevOps 플랫폼
          </p>
          
          <p className="text-lg text-foreground/80">
            자연어로 설명하면, AI가 Kubernetes + Istio + Vault 기반의<br />
            완전한 클라우드 인프라를 몇 분 안에 구축해드립니다
          </p>
        </div>

        {/* Magic Canvas */}
        <Card className="p-8 bg-gradient-card border-border/50 shadow-card backdrop-blur-sm animate-slide-in" style={{animationDelay: "0.2s"}}>
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="h-6 w-6 text-tone-accent" />
              <h2 className="text-2xl font-semibold">Magic Canvas</h2>
            </div>
            
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="어떤 서비스를 만들어 드릴까요?&#10;&#10;예: 'Python으로 만든 실시간 채팅 앱, Redis 사용, 도메인은 chat.my-app.com'"
              className="min-h-[120px] text-lg bg-background/50 border-border/50 focus:border-tone-glow focus:shadow-glow transition-all duration-300 resize-none"
              disabled={isDeploying}
            />
            
            <Button 
              onClick={handleDeploy}
              disabled={!prompt.trim() || isDeploying}
              className="w-full h-14 text-lg font-semibold bg-gradient-primary hover:shadow-glow-intense disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {isDeploying ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  AI가 인프라를 구축하고 있습니다...
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5" />
                  마법의 배포 시작하기
                </div>
              )}
            </Button>
          </div>
        </Card>

        {/* Example prompts */}
        <div className="mt-12 animate-slide-in" style={{animationDelay: "0.4s"}}>
          <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
            예시 프롬프트
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {examplePrompts.map((example, index) => (
              <button
                key={index}
                onClick={() => !isDeploying && setPrompt(example)}
                disabled={isDeploying}
                className="p-4 text-left text-sm bg-card/50 border border-border/30 rounded-lg hover:border-tone-glow/50 hover:bg-card/70 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};