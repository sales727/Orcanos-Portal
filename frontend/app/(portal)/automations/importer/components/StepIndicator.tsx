"use client";

interface StepIndicatorProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  importInProgress: boolean;
}

const STEPS = [
  { number: 1, label: "Authorization" },
  { number: 2, label: "Project Connect" },
  { number: 3, label: "Upload File" },
  { number: 4, label: "Map Fields" },
  { number: 5, label: "Import" },
];

export default function StepIndicator({ currentStep, onStepClick, importInProgress }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between">
      {STEPS.map((step, index) => {
        const isCompleted = step.number < currentStep;
        const isCurrent = step.number === currentStep;
        const isFuture = step.number > currentStep;
        const isClickable = isCompleted && !importInProgress;

        const containerClasses = [
          "flex flex-col items-center",
          importInProgress || isFuture ? "cursor-not-allowed" : "",
          isClickable ? "cursor-pointer group" : "",
        ].join(" ");

        return (
          <div key={step.number} className="flex items-center flex-1">
            <div
              className={containerClasses}
              onClick={() => isClickable && onStepClick(step.number)}
              title={importInProgress ? "Cannot navigate during import" : ""}
            >
              {isCompleted ? (
                <div
                  className={`flex items-center justify-center w-10 h-10 bg-purple-primary rounded-full transition-colors ${
                    isClickable ? "group-hover:bg-purple-medium" : ""
                  }`}
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : isCurrent ? (
                <div className="flex items-center justify-center w-10 h-10 bg-purple-primary rounded-full">
                  <span className="text-white font-bold">{step.number}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center w-10 h-10 bg-gray-300 rounded-full">
                  <span className="text-gray-600 font-bold">{step.number}</span>
                </div>
              )}
              <span className={`mt-2 text-sm font-medium ${step.number <= currentStep ? "text-heading" : "text-gray-400"}`}>
                {step.label}
              </span>
            </div>

            {index < STEPS.length - 1 && (
              <div className={`flex-1 h-1 mx-4 ${step.number < currentStep ? "bg-purple-primary" : "bg-gray-300"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
