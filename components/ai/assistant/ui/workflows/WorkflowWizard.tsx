"use client";

/**
 * Workflow Wizard Component
 * 
 * Multi-step guided wizard for architectural project workflows.
 * Integrates with AI Assistant for step execution.
 */

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Upload,
  Check,
  Circle,
  Home,
  UtensilsCrossed,
  Bath,
  ImageIcon,
  Calculator,
  X,
  Sparkles,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { 
  WorkflowDefinition, 
  WorkflowMetadata, 
  WorkflowSession, 
  WorkflowIcon,
  WorkflowStep,
} from "@/convex/ai/workflows/types";
import { 
  getWorkflowsMetadata, 
  getWorkflow,
} from "@/convex/ai/workflows/loader";

// ============================================
// ICON MAPPING
// ============================================

const WORKFLOW_ICONS: Record<WorkflowIcon, React.ReactNode> = {
  "floor-plan": <Home className="h-5 w-5" />,
  "kitchen": <UtensilsCrossed className="h-5 w-5" />,
  "bathroom": <Bath className="h-5 w-5" />,
  "materials": <Calculator className="h-5 w-5" />,
  "visualization": <ImageIcon className="h-5 w-5" />,
  "calendar": <Clock className="h-5 w-5" />,
  "checklist": <Check className="h-5 w-5" />,
  "tools": <UtensilsCrossed className="h-5 w-5" />,
  "paint": <Circle className="h-5 w-5" />,
  "furniture": <Home className="h-5 w-5" />,
};

// ============================================
// TYPES
// ============================================

interface WorkflowWizardProps {
  onStartWorkflow: (workflowId: string, stepId: string, hasFile: boolean) => void;
  onClose: () => void;
  uploadedFileIds: string[];
  hasUploadedFile: boolean;
  onFileUploadRequest: () => void;
  isAIResponding?: boolean;
}

type WizardView = "selector" | "active";

// ============================================
// WORKFLOW SELECTOR
// ============================================

interface WorkflowSelectorProps {
  workflows: WorkflowMetadata[];
  onSelect: (workflowId: string) => void;
  onClose: () => void;
}

function WorkflowSelector({ workflows, onSelect, onClose }: WorkflowSelectorProps) {
  const categories = {
    analysis: { label: "Analysis", workflows: workflows.filter(w => w.category === "analysis") },
    renovation: { label: "Architecture", workflows: workflows.filter(w => w.category === "renovation") },
    design: { label: "Design", workflows: workflows.filter(w => w.category === "design") },
    planning: { label: "Planning", workflows: workflows.filter(w => w.category === "planning") },
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Choose Workflow</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {Object.entries(categories).map(([key, { label, workflows: categoryWorkflows }]) => {
            if (categoryWorkflows.length === 0) return null;
            
            return (
              <div key={key}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">{label}</h3>
                <div className="grid gap-3">
                  {categoryWorkflows.map((workflow) => (
                    <motion.button
                      key={workflow.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => onSelect(workflow.id)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl",
                        "border border-border/50 bg-card/50",
                        "hover:bg-card hover:border-primary/30 hover:shadow-md",
                        "transition-all duration-200",
                        "group"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          "bg-primary/10 text-primary",
                          "group-hover:bg-primary group-hover:text-primary-foreground",
                          "transition-colors duration-200"
                        )}>
                          {WORKFLOW_ICONS[workflow.icon]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className="font-medium truncate">{workflow.name}</h4>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {workflow.description}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {workflow.stepCount} steps
                            </Badge>
                            {workflow.estimatedMinutes && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                ~{workflow.estimatedMinutes} min
                              </span>
                            )}
                            {workflow.requiredFileTypes.length > 0 && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Upload className="h-3 w-3" />
                                Requires file
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================
// STEP INDICATOR
// ============================================

interface StepIndicatorProps {
  steps: WorkflowStep[];
  currentStepIndex: number;
  completedSteps: string[];
}

function StepIndicator({ steps, currentStepIndex, completedSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = index === currentStepIndex;
        const isPast = index < currentStepIndex;
        
        return (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                "flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium transition-all",
                isCompleted && "bg-green-500 text-white",
                isCurrent && !isCompleted && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                !isCurrent && !isCompleted && "bg-muted text-muted-foreground"
              )}
              title={step.name}
            >
              {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-6 h-0.5 mx-0.5",
                  isPast || isCompleted ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// ACTIVE WORKFLOW VIEW
// ============================================

interface ActiveWorkflowProps {
  workflow: WorkflowDefinition;
  session: WorkflowSession;
  onBack: () => void;
  onClose: () => void;
  onStartStep: () => void;
  hasUploadedFile: boolean;
  onFileUploadRequest: () => void;
  isAIResponding?: boolean;
}

function ActiveWorkflow({
  workflow,
  session,
  onBack,
  onClose,
  onStartStep,
  hasUploadedFile,
  onFileUploadRequest,
  isAIResponding,
}: ActiveWorkflowProps) {
  const currentStep = workflow.steps[session.currentStepIndex];
  const isUploadStep = currentStep?.requiresUpload && !currentStep?.prompt;
  const canProceed = !isUploadStep || hasUploadedFile;
  const progress = Math.round(((session.currentStepIndex) / workflow.steps.length) * 100);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 rounded-full">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              {WORKFLOW_ICONS[workflow.icon]}
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-tight">{workflow.name}</h2>
              <p className="text-xs text-muted-foreground">{currentStep?.name}</p>
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 border-b border-border/30 bg-muted/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Progress</span>
          <span className="text-xs font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
        <div className="mt-3">
          <StepIndicator
            steps={workflow.steps}
            currentStepIndex={session.currentStepIndex}
            completedSteps={Object.keys(session.stepResponses)}
          />
        </div>
      </div>

      {/* Current Step Content */}
      <ScrollArea className="flex-1 p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep?.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Step Title */}
            <div>
              <h3 className="text-lg font-semibold mb-1">{currentStep?.name}</h3>
              {currentStep?.description && (
                <p className="text-sm text-muted-foreground">{currentStep.description}</p>
              )}
            </div>

            {/* Upload prompt if needed */}
            {isUploadStep && !hasUploadedFile && (
              <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
                <CardContent className="p-6 text-center">
                  <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-4">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <h4 className="font-medium mb-2">Upload file</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    This step requires uploading a file (image or PDF)
                  </p>
                  <Button onClick={onFileUploadRequest}>
                    <Upload className="h-4 w-4 mr-2" />
                    Choose file
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* File uploaded indicator */}
            {hasUploadedFile && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">File uploaded</span>
              </div>
            )}

            {/* Step prompt preview */}
            {currentStep?.prompt && !isUploadStep && (
              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI will:
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p className="line-clamp-4">{currentStep.prompt.slice(0, 200)}...</p>
                </CardContent>
              </Card>
            )}

            {/* Previous responses summary */}
            {Object.keys(session.stepResponses).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Completed steps
                </h4>
                {Object.entries(session.stepResponses).map(([stepId]) => {
                  const step = workflow.steps.find(s => s.id === stepId);
                  if (!step) return null;
                  return (
                    <div key={stepId} className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 text-green-500" />
                      <span className="text-muted-foreground">{step.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </ScrollArea>

      {/* Actions */}
      <div className="p-4 border-t border-border/50 bg-background">
        <Button
          onClick={onStartStep}
          disabled={!canProceed || isAIResponding}
          className="w-full"
          size="lg"
        >
          {isAIResponding ? (
            <>
              <span className="animate-pulse">Processing...</span>
            </>
          ) : isUploadStep ? (
            <>
              <Upload className="h-4 w-4 mr-2" />
              {hasUploadedFile ? "Continue with file" : "Upload file to continue"}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              {session.currentStepIndex === 0 ? "Start" : "Execute this step"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function WorkflowWizard({
  onStartWorkflow,
  onClose,
  uploadedFileIds,
  hasUploadedFile,
  onFileUploadRequest,
  isAIResponding,
}: WorkflowWizardProps) {
  const [view, setView] = useState<WizardView>("selector");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [session, setSession] = useState<WorkflowSession | null>(null);

  const workflows = getWorkflowsMetadata();
  const selectedWorkflow = selectedWorkflowId ? getWorkflow(selectedWorkflowId) : null;

  // Handle workflow selection
  const handleSelectWorkflow = useCallback((workflowId: string) => {
    const workflow = getWorkflow(workflowId);
    if (!workflow) return;

    setSelectedWorkflowId(workflowId);
    setSession({
      workflow,
      currentStepIndex: 0,
      uploadedFileIds: [],
      stepResponses: {},
      threadId: "",
      startedAt: Date.now(),
      isCompleted: false,
    });
    setView("active");
  }, []);

  // Handle back to selector
  const handleBack = useCallback(() => {
    setView("selector");
    setSelectedWorkflowId(null);
    setSession(null);
  }, []);

  // Handle step start
  const handleStartStep = useCallback(() => {
    if (!session || !selectedWorkflow) return;
    
    const currentStep = selectedWorkflow.steps[session.currentStepIndex];
    onStartWorkflow(selectedWorkflow.id, currentStep.id, hasUploadedFile);
  }, [session, selectedWorkflow, hasUploadedFile, onStartWorkflow]);

  // Update session with uploaded files
  useEffect(() => {
    if (session && uploadedFileIds.length > 0) {
      setSession(prev => prev ? {
        ...prev,
        uploadedFileIds: uploadedFileIds,
      } : null);
    }
  }, [uploadedFileIds, session]);

  return (
    <div className="h-full flex flex-col bg-background rounded-xl border border-border/50 overflow-hidden">
      <AnimatePresence mode="wait">
        {view === "selector" && (
          <motion.div
            key="selector"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="h-full"
          >
            <WorkflowSelector
              workflows={workflows}
              onSelect={handleSelectWorkflow}
              onClose={onClose}
            />
          </motion.div>
        )}

        {view === "active" && selectedWorkflow && session && (
          <motion.div
            key="active"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="h-full"
          >
            <ActiveWorkflow
              workflow={selectedWorkflow}
              session={session}
              onBack={handleBack}
              onClose={onClose}
              onStartStep={handleStartStep}
              hasUploadedFile={hasUploadedFile}
              onFileUploadRequest={onFileUploadRequest}
              isAIResponding={isAIResponding}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default WorkflowWizard;
