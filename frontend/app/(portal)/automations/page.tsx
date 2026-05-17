"use client";

import { useState, useMemo } from "react";
import { Search, Filter } from "lucide-react";
import ToolRow from "@/components/ToolRow";
import { tools, categories } from "@/lib/tools";

export default function AutomationsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = useMemo(
    () =>
      tools.filter((t) => {
        const matchesQuery =
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.description.toLowerCase().includes(query.toLowerCase()) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query.toLowerCase()));
        const matchesCategory = category === "All" || t.category === category;
        return matchesQuery && matchesCategory;
      }),
    [query, category]
  );

  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      <h1 className="text-2xl font-bold text-purple-primary mb-8">
        Automation Tools
      </h1>

      <div className="bg-card rounded-xl border border-border p-4 mb-6 flex gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-body" />
          <input
            type="text"
            placeholder="Search automations..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-purple-medium bg-transparent"
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-body pointer-events-none" />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="pl-10 pr-8 py-2 text-sm border border-border rounded-lg focus:outline-none focus:border-purple-medium bg-transparent appearance-none cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map((tool) => <ToolRow key={tool.id} tool={tool} />)
        ) : (
          <p className="text-center text-body py-12">No automations match your search.</p>
        )}
      </div>
    </div>
  );
}
