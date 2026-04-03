"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  script_language: string | null;
}

export function AgentSkills({ agentId }: { agentId: string }) {
  const [assigned, setAssigned] = useState<Skill[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/agents/${agentId}/skills`).then((r) => r.json()),
      fetch("/api/skills").then((r) => r.json()),
    ]).then(([agentData, orgData]) => {
      setAssigned(agentData.skills || []);
      setAllSkills(orgData.skills || []);
    });
  }, [agentId]);

  const assignedIds = new Set(assigned.map((s) => s.id));
  const available = allSkills.filter((s) => !assignedIds.has(s.id));

  async function addSkill(skillId: string) {
    await fetch(`/api/agents/${agentId}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skillId }),
    });
    const skill = allSkills.find((s) => s.id === skillId);
    if (skill) setAssigned([...assigned, skill]);
  }

  async function removeSkill(skillId: string) {
    await fetch(`/api/agents/${agentId}/skills/${skillId}`, { method: "DELETE" });
    setAssigned(assigned.filter((s) => s.id !== skillId));
  }

  return (
    <div className="space-y-3">
      {assigned.length === 0 ? (
        <p className="text-sm text-muted-foreground">No skills assigned.</p>
      ) : (
        <div className="space-y-2">
          {assigned.map((skill) => (
            <div key={skill.id} className="flex items-center justify-between p-2 rounded border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{skill.name}</span>
                {skill.script_language && (
                  <Badge variant="secondary" className="text-xs">{skill.script_language}</Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive text-xs"
                onClick={() => removeSkill(skill.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {showAdd && available.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          {available.map((skill) => (
            <div key={skill.id} className="flex items-center justify-between p-2 rounded border border-dashed">
              <div>
                <span className="text-sm">{skill.name}</span>
                <p className="text-xs text-muted-foreground">{skill.description}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => addSkill(skill.id)}>
                Add
              </Button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Done" : "Add Skills"}
        </Button>
      )}
    </div>
  );
}
