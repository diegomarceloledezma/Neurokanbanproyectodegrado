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

export async function getMemberProfile(memberId: string, token: string): Promise<MemberProfileResponse> {
  const response = await fetch(`${API_BASE_URL}/members/${memberId}/profile`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudo obtener el perfil del integrante");
  }

  return response.json();
}