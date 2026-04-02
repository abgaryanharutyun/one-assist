"use client";

import { useState } from "react";
import { SlackTokenStep } from "@/components/onboarding/slack-token-step";
import { AppDetailsStep } from "@/components/onboarding/app-details-step";
import { AuthorizeStep } from "@/components/onboarding/authorize-step";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState({
    configToken: "",
    appName: "",
    appImage: null as File | null,
  });

  return (
    <div>
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded-full ${
              s <= step ? "bg-black" : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <SlackTokenStep
          value={data.configToken}
          onChange={(configToken) => setData({ ...data, configToken })}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <AppDetailsStep
          appName={data.appName}
          appImage={data.appImage}
          onChange={(fields) => setData({ ...data, ...fields })}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <AuthorizeStep data={data} onBack={() => setStep(2)} />
      )}
    </div>
  );
}
