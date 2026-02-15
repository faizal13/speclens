import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Enhanced Validation for Spec-Driven Development
 *
 * Provides:
 * 1. Spec Completeness Scoring (0-100%)
 * 2. Plan-to-Spec Traceability Analysis
 * 3. Task Coverage Percentage
 */

// ============================================================================
// SPEC COMPLETENESS SCORING
// ============================================================================

export interface SpecCompletenessScore {
  totalScore: number; // 0-100
  breakdown: {
    hasOverview: boolean; // 10 points
    hasGoals: boolean; // 10 points
    hasUserStories: boolean; // 15 points
    hasSuccessMetrics: boolean; // 15 points
    hasTechnicalRequirements: boolean; // 15 points
    hasDataModel: boolean; // 10 points
    hasOutOfScope: boolean; // 10 points
    hasSecurityConsiderations: boolean; // 15 points
  };
  suggestions: string[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

/**
 * Calculate spec completeness score
 */
export function calculateSpecCompleteness(specContent: string): SpecCompletenessScore {
  const breakdown = {
    hasOverview: /^##\s+Overview/mi.test(specContent),
    hasGoals: /^##\s+Goals/mi.test(specContent),
    hasUserStories: /^##\s+User\s+Stories/mi.test(specContent),
    hasSuccessMetrics: /^##\s+Success\s+Metrics/mi.test(specContent),
    hasTechnicalRequirements: /^##\s+Technical\s+Requirements/mi.test(specContent),
    hasDataModel: /interface\s+\w+|type\s+\w+|class\s+\w+|CREATE\s+TABLE/i.test(specContent),
    hasOutOfScope: /^##\s+Out\s+of\s+Scope|^##\s+Non-Goals/mi.test(specContent),
    hasSecurityConsiderations: /security|authentication|authorization|csrf|xss|encryption|bcrypt|jwt/i.test(specContent)
  };

  // Calculate total score
  let totalScore = 0;
  if (breakdown.hasOverview) totalScore += 10;
  if (breakdown.hasGoals) totalScore += 10;
  if (breakdown.hasUserStories) totalScore += 15;
  if (breakdown.hasSuccessMetrics) totalScore += 15;
  if (breakdown.hasTechnicalRequirements) totalScore += 15;
  if (breakdown.hasDataModel) totalScore += 10;
  if (breakdown.hasOutOfScope) totalScore += 10;
  if (breakdown.hasSecurityConsiderations) totalScore += 15;

  // Generate suggestions
  const suggestions: string[] = [];
  if (!breakdown.hasOverview) suggestions.push('Add "## Overview" section (2-3 sentences describing what and why)');
  if (!breakdown.hasGoals) suggestions.push('Add "## Goals" section (what you\'re trying to achieve)');
  if (!breakdown.hasUserStories) suggestions.push('Add "## User Stories" section (As a [user], I want [action] so that [benefit])');
  if (!breakdown.hasSuccessMetrics) suggestions.push('Add "## Success Metrics" section (measurable, quantifiable goals)');
  if (!breakdown.hasTechnicalRequirements) suggestions.push('Add "## Technical Requirements" section (functional, non-functional, constraints)');
  if (!breakdown.hasDataModel) suggestions.push('Add data models (TypeScript interfaces, SQL schemas, or class definitions)');
  if (!breakdown.hasOutOfScope) suggestions.push('Add "## Out of Scope" or "## Non-Goals" section (what you\'re NOT building)');
  if (!breakdown.hasSecurityConsiderations) suggestions.push('Add security considerations (authentication, authorization, data protection)');

  // Assign grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (totalScore >= 90) grade = 'A';
  else if (totalScore >= 80) grade = 'B';
  else if (totalScore >= 70) grade = 'C';
  else if (totalScore >= 60) grade = 'D';
  else grade = 'F';

  return {
    totalScore,
    breakdown,
    suggestions,
    grade
  };
}

// ============================================================================
// PLAN-TO-SPEC TRACEABILITY
// ============================================================================

export interface TraceabilityAnalysis {
  alignment: number; // 0-100%
  coverage: {
    techStackDefined: boolean;
    architectureDescribed: boolean;
    dataModelsMatch: boolean;
    securityAddressed: boolean;
    performanceAddressed: boolean;
  };
  gaps: string[];
  warnings: string[];
}

/**
 * Analyze plan-to-spec traceability
 */
export function analyzePlanToSpecTraceability(
  specContent: string,
  planContent: string
): TraceabilityAnalysis {
  const coverage = {
    techStackDefined: /^##\s+Tech\s+Stack/mi.test(planContent),
    architectureDescribed: /^##\s+Architecture/mi.test(planContent),
    dataModelsMatch: checkDataModelAlignment(specContent, planContent),
    securityAddressed: checkSecurityAlignment(specContent, planContent),
    performanceAddressed: checkPerformanceAlignment(specContent, planContent)
  };

  // Calculate alignment score
  let alignmentScore = 0;
  if (coverage.techStackDefined) alignmentScore += 20;
  if (coverage.architectureDescribed) alignmentScore += 20;
  if (coverage.dataModelsMatch) alignmentScore += 20;
  if (coverage.securityAddressed) alignmentScore += 20;
  if (coverage.performanceAddressed) alignmentScore += 20;

  // Identify gaps
  const gaps: string[] = [];
  if (!coverage.techStackDefined) gaps.push('Plan missing "Tech Stack" section');
  if (!coverage.architectureDescribed) gaps.push('Plan missing "Architecture" section');
  if (!coverage.dataModelsMatch) gaps.push('Data models in plan don\'t match spec requirements');
  if (!coverage.securityAddressed) gaps.push('Security requirements from spec not addressed in plan');
  if (!coverage.performanceAddressed) gaps.push('Performance requirements from spec not addressed in plan');

  // Generate warnings
  const warnings: string[] = [];

  // Check if spec has goals but plan doesn't reference them
  const specHasGoals = /^##\s+Goals/mi.test(specContent);
  const planReferencesGoals = /goal/i.test(planContent);
  if (specHasGoals && !planReferencesGoals) {
    warnings.push('Spec defines goals but plan doesn\'t reference them');
  }

  // Check if spec has metrics but plan doesn't address measurement
  const specHasMetrics = /^##\s+Success\s+Metrics/mi.test(specContent);
  const planHasMonitoring = /monitoring|metrics|observability|logging/i.test(planContent);
  if (specHasMetrics && !planHasMonitoring) {
    warnings.push('Spec defines success metrics but plan doesn\'t include monitoring/measurement strategy');
  }

  return {
    alignment: alignmentScore,
    coverage,
    gaps,
    warnings
  };
}

function checkDataModelAlignment(specContent: string, planContent: string): boolean {
  // Extract interface/type names from spec
  const specModels = extractModelNames(specContent);
  if (specModels.length === 0) return true; // No models in spec, nothing to check

  // Check if plan references these models
  const planHasModels = specModels.some(model =>
    new RegExp(`\\b${model}\\b`, 'i').test(planContent)
  );

  return planHasModels;
}

function checkSecurityAlignment(specContent: string, planContent: string): boolean {
  // If spec doesn't mention security, no alignment needed
  if (!/security|authentication|authorization/i.test(specContent)) return true;

  // If spec mentions security, plan should address it
  return /security|authentication|authorization|csrf|xss|bcrypt|jwt|encryption/i.test(planContent);
}

function checkPerformanceAlignment(specContent: string, planContent: string): boolean {
  // If spec doesn't mention performance, no alignment needed
  if (!/performance|response\s+time|latency|concurrent/i.test(specContent)) return true;

  // If spec mentions performance, plan should address it
  return /performance|caching|indexing|optimization|load\s+balancing|scaling/i.test(planContent);
}

function extractModelNames(content: string): string[] {
  const models: string[] = [];

  // TypeScript interfaces
  const interfaceMatches = content.matchAll(/interface\s+(\w+)/g);
  for (const match of interfaceMatches) {
    models.push(match[1]);
  }

  // TypeScript types
  const typeMatches = content.matchAll(/type\s+(\w+)/g);
  for (const match of typeMatches) {
    models.push(match[1]);
  }

  // SQL tables
  const tableMatches = content.matchAll(/CREATE\s+TABLE\s+(\w+)/gi);
  for (const match of tableMatches) {
    models.push(match[1]);
  }

  return models;
}

// ============================================================================
// TASK COVERAGE PERCENTAGE
// ============================================================================

export interface TaskCoverage {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  pendingTasks: number;
  coveragePercentage: number; // % of tasks completed
  progressPercentage: number; // % of tasks started (in-progress + completed)
  estimatedHoursTotal: number;
  estimatedHoursRemaining: number;
  estimatedHoursCompleted: number;
}

/**
 * Calculate task coverage from tasks.md
 */
export function calculateTaskCoverage(tasksContent: string): TaskCoverage {
  // Extract all tasks
  const taskRegex = /^##\s+Task\s+\d+:/gm;
  const totalTasks = (tasksContent.match(taskRegex) || []).length;

  // Count by status
  let completedTasks = 0;
  let inProgressTasks = 0;
  let blockedTasks = 0;
  let pendingTasks = 0;

  // Split into task sections
  const taskSections = tasksContent.split(/^##\s+Task\s+\d+:/gm).slice(1);

  for (const section of taskSections) {
    const statusMatch = section.match(/\*\*Status:\*\*\s*(\w+)/i);
    if (statusMatch) {
      const status = statusMatch[1].toLowerCase();
      if (status === 'done' || status === 'completed') completedTasks++;
      else if (status === 'in-progress' || status === 'in_progress') inProgressTasks++;
      else if (status === 'blocked') blockedTasks++;
      else pendingTasks++;
    } else {
      pendingTasks++; // No status = pending
    }
  }

  // Calculate percentages
  const coveragePercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const progressPercentage = totalTasks > 0 ? Math.round(((completedTasks + inProgressTasks) / totalTasks) * 100) : 0;

  // Extract estimated hours
  let estimatedHoursTotal = 0;
  let estimatedHoursCompleted = 0;

  for (let i = 0; i < taskSections.length; i++) {
    const section = taskSections[i];
    const hoursMatch = section.match(/\*\*Estimated\s+Time:\*\*\s*(\d+)\s*hours?/i);
    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;

    estimatedHoursTotal += hours;

    const statusMatch = section.match(/\*\*Status:\*\*\s*(\w+)/i);
    if (statusMatch) {
      const status = statusMatch[1].toLowerCase();
      if (status === 'done' || status === 'completed') {
        estimatedHoursCompleted += hours;
      }
    }
  }

  const estimatedHoursRemaining = estimatedHoursTotal - estimatedHoursCompleted;

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    blockedTasks,
    pendingTasks,
    coveragePercentage,
    progressPercentage,
    estimatedHoursTotal,
    estimatedHoursRemaining,
    estimatedHoursCompleted
  };
}

// ============================================================================
// COMBINED VALIDATION REPORT
// ============================================================================

export interface ValidationReport {
  specScore?: SpecCompletenessScore;
  traceability?: TraceabilityAnalysis;
  taskCoverage?: TaskCoverage;
  overallHealth: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  criticalIssues: string[];
  recommendations: string[];
}

/**
 * Generate comprehensive validation report
 */
export async function generateValidationReport(
  featurePath: string
): Promise<ValidationReport> {
  const criticalIssues: string[] = [];
  const recommendations: string[] = [];

  // Read spec.md
  let specScore: SpecCompletenessScore | undefined;
  try {
    const specUri = vscode.Uri.file(path.join(featurePath, 'spec.md'));
    const specContent = await vscode.workspace.fs.readFile(specUri);
    const specText = Buffer.from(specContent).toString('utf8');

    specScore = calculateSpecCompleteness(specText);

    if (specScore.totalScore < 70) {
      criticalIssues.push(`Spec completeness is low (${specScore.totalScore}%)`);
    }
    recommendations.push(...specScore.suggestions);
  } catch {
    criticalIssues.push('spec.md not found');
  }

  // Read plan.md and check traceability
  let traceability: TraceabilityAnalysis | undefined;
  try {
    const specUri = vscode.Uri.file(path.join(featurePath, 'spec.md'));
    const planUri = vscode.Uri.file(path.join(featurePath, 'plan.md'));

    const specContent = await vscode.workspace.fs.readFile(specUri);
    const planContent = await vscode.workspace.fs.readFile(planUri);

    const specText = Buffer.from(specContent).toString('utf8');
    const planText = Buffer.from(planContent).toString('utf8');

    traceability = analyzePlanToSpecTraceability(specText, planText);

    if (traceability.alignment < 60) {
      criticalIssues.push(`Plan-to-spec alignment is low (${traceability.alignment}%)`);
    }
    if (traceability.gaps.length > 0) {
      criticalIssues.push(...traceability.gaps);
    }
    if (traceability.warnings.length > 0) {
      recommendations.push(...traceability.warnings);
    }
  } catch {
    // plan.md not found or spec.md missing - skip traceability
  }

  // Read tasks.md and calculate coverage
  let taskCoverage: TaskCoverage | undefined;
  try {
    const tasksUri = vscode.Uri.file(path.join(featurePath, 'tasks.md'));
    const tasksContent = await vscode.workspace.fs.readFile(tasksUri);
    const tasksText = Buffer.from(tasksContent).toString('utf8');

    taskCoverage = calculateTaskCoverage(tasksText);

    if (taskCoverage.blockedTasks > 0) {
      criticalIssues.push(`${taskCoverage.blockedTasks} task(s) are blocked`);
    }
    if (taskCoverage.totalTasks === 0) {
      criticalIssues.push('No tasks defined in tasks.md');
    }
  } catch {
    // tasks.md not found - skip coverage
  }

  // Determine overall health
  let overallHealth: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  const hasSpec = specScore !== undefined;
  const hasPlan = traceability !== undefined;
  const hasTasks = taskCoverage !== undefined;

  const specOk = specScore ? specScore.totalScore >= 80 : false;
  const traceabilityOk = traceability ? traceability.alignment >= 80 : false;
  const taskProgressOk = taskCoverage ? taskCoverage.progressPercentage >= 20 : false;

  if (hasSpec && hasPlan && hasTasks && specOk && traceabilityOk) {
    overallHealth = 'Excellent';
  } else if (hasSpec && hasPlan && specOk) {
    overallHealth = 'Good';
  } else if (hasSpec) {
    overallHealth = 'Fair';
  } else {
    overallHealth = 'Poor';
  }

  // Add general recommendations
  if (!hasPlan && hasSpec) {
    recommendations.push('Generate plan.md from spec using "SpecLens: Generate Plan from Spec"');
  }
  if (!hasTasks && hasPlan) {
    recommendations.push('Generate tasks.md from plan using "SpecLens: Generate Tasks from Plan"');
  }

  return {
    specScore,
    traceability,
    taskCoverage,
    overallHealth,
    criticalIssues,
    recommendations
  };
}
