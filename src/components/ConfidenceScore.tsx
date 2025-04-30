
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, HelpCircle, AlertCircle } from "lucide-react";

interface ConfidenceScoreProps {
  score: number;
}

export default function ConfidenceScore({ score }: ConfidenceScoreProps) {
  const getIcon = () => {
    if (score >= 80) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    } else if (score >= 50) {
      return <HelpCircle className="h-5 w-5 text-amber-500" />;
    } else {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getLabel = () => {
    if (score >= 80) {
      return "High confidence";
    } else if (score >= 50) {
      return "Medium confidence";
    } else {
      return "Low confidence";
    }
  };

  const getColor = () => {
    if (score >= 80) {
      return "bg-green-500";
    } else if (score >= 50) {
      return "bg-amber-500";
    } else {
      return "bg-red-500";
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {getIcon()}
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span>{getLabel()}</span>
          <span>{score}%</span>
        </div>
        <Progress value={score} className={`h-1.5 ${getColor()}`} />
      </div>
    </div>
  );
}
