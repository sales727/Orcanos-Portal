"use client";

import { useState, useEffect, useRef } from "react";
import StepIndicator from "./components/StepIndicator";
import Step1Auth from "./components/Step1Auth";
import Step2Project from "./components/Step2Project";
import Step3Upload from "./components/Step3Upload";
import Step4Mapping from "./components/Step4Mapping";
import Step5Import from "./components/Step5Import";
import type { Credentials, ProjectConfig, OrcanosField, FileData, FieldMapping } from "@/lib/importer";

const SESSION_KEY = "orcanosImporterState";

interface PersistedState {
  credentials: Credentials | null;
  projectConfig: ProjectConfig | null;
  orcanosFields: OrcanosField[];
  mandatoryFields: OrcanosField[];
  projectsList: unknown[];
}

interface WizardState extends PersistedState {
  currentStep: number;
  fileData: FileData | null;
  originalFileData: FileData | null;
  mapping: FieldMapping | null;
  stepsMapping: FieldMapping | null;
  testCaseLinkColumn: string | null;
  stepsLinkColumn: string | null;
  results: unknown;
}

const DEFAULT_STATE: WizardState = {
  currentStep: 1,
  credentials: null,
  projectConfig: null,
  orcanosFields: [],
  mandatoryFields: [],
  fileData: null,
  originalFileData: null,
  mapping: null,
  stepsMapping: null,
  testCaseLinkColumn: null,
  stepsLinkColumn: null,
  results: null,
  projectsList: [],
};

function loadFromSession(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        credentials: parsed.credentials || null,
        projectConfig: parsed.projectConfig || null,
        orcanosFields: parsed.orcanosFields || [],
        mandatoryFields: parsed.mandatoryFields || [],
        projectsList: parsed.projectsList || [],
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export default function ImporterPage() {
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);

  // Loading sessionStorage after mount (not during initial state) avoids an
  // SSR/client hydration mismatch, since sessionStorage doesn't exist on the server.
  useEffect(() => {
    const saved = loadFromSession();
    if (saved) {
      setState((prev) => ({ ...prev, ...saved }));
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          credentials: state.credentials,
          projectConfig: state.projectConfig,
          orcanosFields: state.orcanosFields,
          mandatoryFields: state.mandatoryFields,
          projectsList: state.projectsList,
        })
      );
    } catch {
      // ignore
    }
  }, [state.credentials, state.projectConfig, state.orcanosFields, state.mandatoryFields, state.projectsList]);

  const [fadeIn, setFadeIn] = useState(true);
  const [importInProgress, setImportInProgress] = useState(false);
  const [hasImportResults, setHasImportResults] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingStepNavigation, setPendingStepNavigation] = useState<number | null>(null);

  const step2EntrySnapshot = useRef<{ project_id: number; item_type: string } | null>(null);

  const captureStep2Snapshot = () => {
    step2EntrySnapshot.current = state.projectConfig
      ? { project_id: state.projectConfig.project_id, item_type: state.projectConfig.item_type }
      : null;
  };

  const handleResetToStep2 = () => {
    if (importInProgress) return;
    setShowResetConfirm(true);
  };

  const handleStepClick = (stepNumber: number) => {
    if (importInProgress || stepNumber >= state.currentStep) return;

    if (state.currentStep === 5 && hasImportResults) {
      setPendingStepNavigation(stepNumber);
      return;
    }

    navigateToStep(stepNumber);
  };

  const navigateToStep = (stepNumber: number) => {
    if (stepNumber === 2) captureStep2Snapshot();

    setFadeIn(false);
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        currentStep: stepNumber,
        ...(prev.currentStep === 5 ? { results: null, fileData: prev.originalFileData } : {}),
      }));
      setFadeIn(true);
    }, 300);
  };

  const handleConfirmStepNavigation = () => {
    const target = pendingStepNavigation;
    setPendingStepNavigation(null);
    if (target !== null) navigateToStep(target);
  };

  const handleStep1Complete = (credentials: Credentials, projectsList: unknown[]) => {
    setFadeIn(false);
    setTimeout(() => {
      setState((prev) => ({ ...prev, credentials, projectsList, currentStep: 2 }));
      setFadeIn(true);
    }, 300);
  };

  const handleBackStep2 = () => {
    setFadeIn(false);
    setTimeout(() => {
      setState((prev) => ({ ...prev, currentStep: 1 }));
      setFadeIn(true);
    }, 300);
  };

  const handleStep2Complete = (projectConfig: ProjectConfig, orcanosFields: OrcanosField[], mandatoryFields: OrcanosField[]) => {
    const snap = step2EntrySnapshot.current;
    const selectionChanged = !snap || String(projectConfig.project_id) !== String(snap.project_id) || projectConfig.item_type !== snap.item_type;

    step2EntrySnapshot.current = null;

    setFadeIn(false);
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        projectConfig,
        orcanosFields,
        mandatoryFields,
        ...(selectionChanged
          ? {
              fileData: null,
              originalFileData: null,
              mapping: null,
              stepsMapping: null,
              testCaseLinkColumn: null,
              stepsLinkColumn: null,
              results: null,
            }
          : {}),
        currentStep: 3,
      }));
      setFadeIn(true);
    }, 300);
  };

  const handleBackStep3 = () => {
    captureStep2Snapshot();
    setFadeIn(false);
    setTimeout(() => {
      setState((prev) => ({ ...prev, currentStep: 2 }));
      setFadeIn(true);
    }, 300);
  };

  const handleStep3Complete = (fileData: FileData, fileChanged = true) => {
    setFadeIn(false);
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        fileData,
        originalFileData: fileData,
        mapping: fileChanged ? null : prev.mapping,
        results: null,
        currentStep: 4,
      }));
      setFadeIn(true);
    }, 300);
  };

  const handleBackStep4 = () => {
    setFadeIn(false);
    setTimeout(() => {
      setState((prev) => ({ ...prev, currentStep: 3 }));
      setFadeIn(true);
    }, 300);
  };

  const handleStep4Complete = ({
    mapping,
    stepsMapping,
    testCaseLinkColumn,
    stepsLinkColumn,
  }: {
    mapping: FieldMapping;
    stepsMapping: FieldMapping | null;
    testCaseLinkColumn: string | null;
    stepsLinkColumn: string | null;
  }) => {
    setFadeIn(false);
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        mapping,
        stepsMapping: stepsMapping || null,
        testCaseLinkColumn: testCaseLinkColumn || null,
        stepsLinkColumn: stepsLinkColumn || null,
        results: null,
        currentStep: 5,
      }));
      setFadeIn(true);
    }, 300);
  };

  const handleBackStep5 = () => {
    setFadeIn(false);
    setTimeout(() => {
      setState((prev) => ({ ...prev, results: null, fileData: prev.originalFileData, currentStep: 4 }));
      setFadeIn(true);
    }, 300);
  };

  const resetAll = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    setFadeIn(false);
    setTimeout(() => {
      setState(DEFAULT_STATE);
      setFadeIn(true);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-page">
      <div className="bg-white border-b border-border shadow-sm">
        <div className="max-w-4xl mx-auto py-3 px-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-heading">Orcanos</span>
            <span className="text-gray-500 font-medium text-xs tracking-widest border-l border-border pl-3 uppercase">Importer</span>
          </div>
          <button onClick={resetAll} className="btn-secondary text-xs px-3 py-1 h-auto">
            Reset
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4">
        <StepIndicator currentStep={state.currentStep} importInProgress={importInProgress} onStepClick={handleStepClick} />

        <div className={`mt-8 transition-opacity duration-300 ${fadeIn ? "opacity-100" : "opacity-0"}`}>
          {state.currentStep === 1 && <Step1Auth credentials={state.credentials} onComplete={handleStep1Complete} />}
          {state.currentStep === 2 && (
            <Step2Project
              credentials={state.credentials}
              projectConfig={state.projectConfig}
              projectsList={state.projectsList as never[]}
              onComplete={handleStep2Complete}
              onBack={handleBackStep2}
            />
          )}
          {state.currentStep === 3 && (
            <Step3Upload
              fileData={state.originalFileData}
              projectConfig={state.projectConfig}
              onComplete={handleStep3Complete}
              onBack={handleBackStep3}
              onResetToStep2={handleResetToStep2}
            />
          )}
          {state.currentStep === 4 && (
            <Step4Mapping
              fileData={state.originalFileData}
              existingMapping={state.mapping}
              existingStepsMapping={state.stepsMapping}
              existingTestCaseLinkColumn={state.testCaseLinkColumn}
              existingStepsLinkColumn={state.stepsLinkColumn}
              projectConfig={state.projectConfig}
              orcanosFields={state.orcanosFields}
              mandatoryFields={state.mandatoryFields}
              onComplete={handleStep4Complete}
              onBack={handleBackStep4}
              onResetToStep2={handleResetToStep2}
            />
          )}
          {state.currentStep === 5 && (
            <Step5Import
              fileData={state.fileData}
              originalFileData={state.originalFileData}
              onUpdateFileData={(newFileData) => setState((prev) => ({ ...prev, fileData: newFileData }))}
              mapping={state.mapping}
              stepsMapping={state.stepsMapping}
              testCaseLinkColumn={state.testCaseLinkColumn}
              stepsLinkColumn={state.stepsLinkColumn}
              credentials={state.credentials}
              projectConfig={state.projectConfig}
              orcanosFields={state.orcanosFields}
              mandatoryFields={state.mandatoryFields}
              onStartOver={resetAll}
              onBack={handleBackStep5}
              setImportInProgress={setImportInProgress}
              onResetToStep2={handleResetToStep2}
              onHasResultsChange={setHasImportResults}
            />
          )}
        </div>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Change Project & Item Type?</h3>
            <p className="text-gray-600 mb-6">
              This will reset your uploaded file, field mappings, and any import progress. You&apos;ll be taken back to Step 2 to reselect.
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 bg-white border border-purple-primary text-purple-primary hover:border-purple-medium hover:text-purple-medium font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  setState((prev) => ({
                    ...prev,
                    fileData: null,
                    mapping: null,
                    stepsMapping: null,
                    testCaseLinkColumn: null,
                    stepsLinkColumn: null,
                    results: null,
                    currentStep: 2,
                  }));
                }}
                className="flex-1 btn-danger text-sm sm:text-base"
              >
                Yes, go back
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingStepNavigation !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Going Back?</h3>
            <p className="text-gray-600 mb-6">Going back will clear your import results. Are you sure?</p>
            <div className="flex gap-4">
              <button type="button" onClick={() => setPendingStepNavigation(null)} className="btn-secondary flex-1 text-sm sm:text-base">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmStepNavigation} className="btn-danger flex-1 text-sm sm:text-base">
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
