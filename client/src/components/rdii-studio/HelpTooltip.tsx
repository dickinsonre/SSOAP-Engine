import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HelpTooltipProps {
  text: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function HelpTooltip({ text, side = "top", className }: HelpTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center justify-center cursor-help ${className || ""}`}
          data-testid="icon-help-tooltip"
        >
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-xs">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}
