"use client";

import { useState } from "react";
import { SlackTokenStep } from "@/components/onboarding/slack-token-step";
import { AppDetailsStep } from "@/components/onboarding/app-details-step";
import { ApiKeyStep } from "@/components/onboarding/api-key-step";
import { AuthorizeStep } from "@/components/onboarding/authorize-step";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewAgentPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    configToken: "",
    configRefreshToken: "",
    appName: "",
    provider: "anthropic",
    apiKey: "",
  });

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Add New Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 flex-1 rounded-full ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {step === 1 && (
            <SlackTokenStep
              configToken={data.configToken}
              configRefreshToken={data.configRefreshToken}
              onChange={(fields) => setData({ ...data, ...fields })}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <AppDetailsStep
              appName={data.appName}
              onChange={(fields) => setData({ ...data, ...fields })}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <ApiKeyStep
              provider={data.provider}
              apiKey={data.apiKey}
              onChange={(fields) => setData({ ...data, ...fields })}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}
          {step === 4 && (
            <AuthorizeStep data={data} onBack={() => setStep(3)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
