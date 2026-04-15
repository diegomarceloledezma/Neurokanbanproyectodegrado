import { API_BASE_URL } from "../config";

export type SkillResponse = {
  id: number;
  name: string;
  category?: string | null;
  description?: string | null;
  area?: {
    id: number;
    name: string;
    description?: string | null;
  } | null;
};

export async function getSkills(token: string): Promise<SkillResponse[]> {
  const response = await fetch(`${API_BASE_URL}/skills/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "No se pudieron obtener las skills");
  }

  return response.json();
}