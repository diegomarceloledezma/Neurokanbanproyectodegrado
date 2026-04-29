import { API_BASE_URL } from "../config";

export type MemberTaskItem = {
  id: number;
  title: string;
  priority: string;
  status: string;
  complexity: number;
  estimated_hours?: number | null;
  actual_hours?: number | null;
};

export type MemberSkillItem = {
  skill_name: string;
  category?: string | null;
  level: number;
  years_experience: number;
  verified_by_leader: boolean;
};

export type MemberSkillManageItem = {
  id: number;
  skill_id: number;
  skill_name: string;
  category?: string | null;
  level: number;
  years_experience: number;
  verified_by_leader: boolean;
};

export type MemberSkillPayload = {
  skill_id: number;
  level: number;
  years_experience: number;
  verified_by_leader: boolean;
};

export type MemberProfileResponse = {
  id: number;
  full_name: string;
  username: string;
  email: string;
  avatar_url?: string | null;
  role_name: string;
  active_tasks: number;
  completed_tasks: number;
  total_tasks: number;
  completion_rate: number;
  current_load: number;
  availability: number;
  project_capacity_hours?: number | null;
  experience_level?: number | null;
  skills: MemberSkillItem[];
  active_task_items: MemberTaskItem[];
  completed_task_items: MemberTaskItem[];
};

async function parseApiError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => null);
  throw new Error(data?.detail || fallback);
}

export async function getMemberProfile(memberId: string, token: string): Promise<MemberProfileResponse> {
  const response = await fetch(`${API_BASE_URL}/members/${memberId}/profile`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo obtener el perfil del integrante");
  }

  return response.json();
}

export async function getMemberSkills(
  memberId: string,
  token: string
): Promise<MemberSkillManageItem[]> {
  const response = await fetch(`${API_BASE_URL}/members/${memberId}/skills`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudieron cargar las habilidades del integrante");
  }

  return response.json();
}

export async function addMemberSkill(
  memberId: string,
  payload: MemberSkillPayload,
  token: string
): Promise<MemberSkillManageItem> {
  const response = await fetch(`${API_BASE_URL}/members/${memberId}/skills`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo registrar la habilidad");
  }

  return response.json();
}

export async function updateMemberSkill(
  memberId: string,
  userSkillId: number,
  payload: MemberSkillPayload,
  token: string
): Promise<MemberSkillManageItem> {
  const response = await fetch(`${API_BASE_URL}/members/${memberId}/skills/${userSkillId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo actualizar la habilidad");
  }

  return response.json();
}

export async function deleteMemberSkill(
  memberId: string,
  userSkillId: number,
  token: string
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/members/${memberId}/skills/${userSkillId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo eliminar la habilidad");
  }

  return response.json();
}