"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string;
  instructions: string;
  script: string | null;
  script_language: string | null;
  created_at: string;
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    instructions: "",
    script: "",
    script_language: "python" as string,
    hasScript: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => setSkills(d.skills || []));
  }, []);

  function resetForm() {
    setForm({ name: "", description: "", instructions: "", script: "", script_language: "python", hasScript: false });
    setEditing(null);
    setShowForm(false);
  }

  function startEdit(skill: Skill) {
    setForm({
      name: skill.name,
      description: skill.description,
      instructions: skill.instructions,
      script: skill.script || "",
      script_language: skill.script_language || "python",
      hasScript: !!skill.script,
    });
    setEditing(skill);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const body = {
      name: form.name,
      description: form.description,
      instructions: form.instructions,
      script: form.hasScript ? form.script : null,
      script_language: form.hasScript ? form.script_language : null,
    };

    if (editing) {
      const res = await fetch(`/api/skills/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.skill) {
        setSkills(skills.map((s) => (s.id === editing.id ? data.skill : s)));
      }
    } else {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.skill) {
        setSkills([data.skill, ...skills]);
      }
    }

    resetForm();
    setLoading(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/skills/${id}`, { method: "DELETE" });
    setSkills(skills.filter((s) => s.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Skills Library</h2>
        <Button onClick={() => (showForm ? resetForm() : setShowForm(true))}>
          {showForm ? "Cancel" : "Create Skill"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit Skill" : "Create Skill"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Jira Lookup"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Short description of what this skill does"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions (Markdown)</Label>
                <Textarea
                  id="instructions"
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  placeholder="Markdown instructions for the agent..."
                  rows={8}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasScript"
                  checked={form.hasScript}
                  onChange={(e) => setForm({ ...form, hasScript: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="hasScript">Include script</Label>
              </div>
              {form.hasScript && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="language">Script Language</Label>
                    <select
                      id="language"
                      value={form.script_language}
                      onChange={(e) => setForm({ ...form, script_language: e.target.value })}
                      className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                    >
                      <option value="python">Python</option>
                      <option value="bash">Bash</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="script">Script</Label>
                    <Textarea
                      id="script"
                      value={form.script}
                      onChange={(e) => setForm({ ...form, script: e.target.value })}
                      placeholder="Script code..."
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>
                </>
              )}
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : editing ? "Update Skill" : "Create Skill"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {skills.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No skills yet. Create your first skill to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {skills.map((skill) => (
            <Card key={skill.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{skill.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {skill.description}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {skill.script_language && (
                        <Badge variant="secondary">{skill.script_language}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(skill)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(skill.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
