"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Skill {
  id: string;
  name: string;
  description: string;
  script_language: string | null;
}

interface SkillSelectionStepProps {
  selectedSkills: string[];
  onChange: (skills: string[]) => void;
  onBack: () => void;
  onNext: () => void;
}

export function SkillSelectionStep({ selectedSkills, onChange, onBack, onNext }: SkillSelectionStepProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => {
        setSkills(d.skills || []);
        setLoading(false);
      });
  }, []);

  function toggleSkill(skillId: string) {
    if (selectedSkills.includes(skillId)) {
      onChange(selectedSkills.filter((id) => id !== skillId));
    } else {
      onChange([...selectedSkills, skillId]);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Select Skills</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which skills this agent should have. You can change this later.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading skills...</p>
      ) : skills.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No skills created yet. You can add skills from the Skills page later.
        </p>
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => (
            <label
              key={skill.id}
              className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50"
            >
              <Checkbox
                checked={selectedSkills.includes(skill.id)}
                onCheckedChange={() => toggleSkill(skill.id)}
                className="mt-0.5"
              />
              <div>
                <Label className="cursor-pointer font-medium">{skill.name}</Label>
                <p className="text-sm text-muted-foreground">{skill.description}</p>
              </div>
            </label>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Next</Button>
      </div>
    </div>
  );
}
