import Link from "next/link";
import {
  FileText, Search, MessageSquare, Shield, Terminal, Filter,
  Database, AlertTriangle, type LucideIcon,
} from "lucide-react";
import type { Tool } from "@/lib/tools";

const iconMap: Record<string, LucideIcon> = {
  FileText, Search, MessageSquare, Shield, Terminal, Filter,
  Database, AlertTriangle,
};

export default function ToolCard({ tool }: { tool: Tool }) {
  const Icon = iconMap[tool.icon] ?? FileText;
  const available = tool.status === "available";

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="h-0.5 bg-purple-primary" />
      <div className="p-6">
        <Icon className="text-body mb-4" size={24} strokeWidth={1.5} />
        <h3 className="text-base font-semibold text-heading mb-2">{tool.name}</h3>
        <p className="text-body text-sm leading-relaxed mb-5">{tool.description}</p>
        {available ? (
          <Link
            href={`/automations/${tool.slug}`}
            className="text-sm font-medium text-purple-medium hover:text-purple-primary inline-flex items-center gap-1 transition-colors"
          >
            Open →
          </Link>
        ) : (
          <span className="text-sm text-body/60">Coming soon</span>
        )}
      </div>
    </div>
  );
}
