import { API_BASE_URL } from "../config";
import { getAccessToken } from "./sessionService";

export type ProvenanceCountItem = {
  label: string;
  count: number;
};

export type DataProvenanceReportResponse = {
  projects: {
    total_projects: number;
    active_projects: number;
    total_project_memberships: number;
  };
  tasks: {
    total_tasks: number;
    tasks_with_required_skills: number;
    tasks_with_assignee: number;
    tasks_by_type: ProvenanceCountItem[];
    tasks_by_priority: ProvenanceCountItem[];
    tasks_by_status: ProvenanceCountItem[];
  };
  skills_catalog: {
    total_skills: number;
    skills_with_source: number;
    skills_without_source: number;
    skills_by_source: ProvenanceCountItem[];
    skills_by_category: ProvenanceCountItem[];
    total_aliases: number;
    aliases_by_source: ProvenanceCountItem[];
  };
  recommendation_flow: {
    total_recommendations: number;
    total_assignment_history: number;
    assignments_by_source: ProvenanceCountItem[];
    assignments_by_strategy: ProvenanceCountItem[];
    recommendations_by_strategy: ProvenanceCountItem[];
  };
  training_base: {
    total_task_outcomes: number;
    assignment_records_with_outcome: number;
    assignment_records_without_outcome: number;
  };
};

export type TrainingReadinessResponse = {
  readiness_score: number;
  readiness_level: string;
  coverage: {
    skills_source_coverage: number;
    task_skill_coverage: number;
    outcome_linked_assignment_coverage: number;
  };
  counts: {
    total_skills: number;
    skills_with_source: number;
    total_tasks: number;
    tasks_with_required_skills: number;
    total_assignment_history: number;
    assignment_records_with_outcome: number;
    total_recommendations: number;
    total_aliases: number;
  };
  observations: string[];
};

async function parseApiError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => null);
  throw new Error(data?.detail || fallback);
}

function buildHeaders(token?: string) {
  const authToken = token ?? getAccessToken();

  return authToken
    ? {
        Authorization: `Bearer ${authToken}`,
      }
    : undefined;
}

export async function getDataProvenanceReport(
  token?: string
): Promise<DataProvenanceReportResponse> {
  const response = await fetch(`${API_BASE_URL}/data-provenance/report`, {
    headers: buildHeaders(token),
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo obtener el reporte de procedencia de datos.");
  }

  return response.json();
}

export async function getTrainingReadiness(
  token?: string
): Promise<TrainingReadinessResponse> {
  const response = await fetch(`${API_BASE_URL}/data-provenance/training-readiness`, {
    headers: buildHeaders(token),
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo obtener el readiness del entrenamiento.");
  }

  return response.json();
}