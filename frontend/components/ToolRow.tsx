import Link from "next/link";
import { Play } from "lucide-react";
import type { Tool } from "@/lib/tools";

export default function ToolRow({ tool }: { tool: Tool }) {
  const available = tool.status === "available";

  return (
    <div className="bg-card rounded-xl border border-border px-6 py-5 flex items-center gap-6 hover:shadow-sm transition-shadow">
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-heading mb-1">{tool.name}</h3>
        <p className="text-body text-sm mb-3 line-clamp-2">{tool.description}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {tool.tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-light text-purple-medium"
            >
              {tag}
            </span>
          ))}
          {tool.lastRun && (
            <span className="text-xs text-body ml-1">Last run: {tool.lastRun}</span>
          )}
        </div>
      </div>

      {available ? (
        <Link href={`/automations/${tool.slug}`} className="shrink-0">
          <button className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-purple-primary rounded-full hover:bg-purple-primary/90 transition-colors whitespace-nowrap">
            <Play size={13} fill="currentColor" />
            Run Automation
          </button>
        </Link>
      ) : (
        <button
          disabled
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-purple-primary rounded-full opacity-40 cursor-not-allowed whitespace-nowrap shrink-0"
        >
          <Play size={13} fill="currentColor" />
          Run Automation
        </button>
      )}
    </div>
  );
}
