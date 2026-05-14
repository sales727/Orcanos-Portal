import ToolCard from "@/components/ToolCard";
import { tools } from "@/lib/tools";

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-8 py-12">
      <h1 className="text-3xl font-bold text-purple-primary mb-2">
        Welcome to the Automation Portal
      </h1>
      <p className="text-body text-base mb-10">
        Select a tool to execute or explore your history.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}
