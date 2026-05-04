import { API_BASE_URL } from "../config";

export type SkillResponse = {
  id: number;
  name: string;
  category?: string | null;
  area_id?: number | null;
  description?: string | null;
  canonical_name?: string | null;
  source_name?: string | null;
  source_code?: string | null;
  source_version?: string | null;
  source_url?: string | null;
  is_active?: boolean;
};

export type SkillFilters = {
  query?: string;
  category?: string;
  source_name?: string;
  only_active?: boolean;
};

export type SkillCatalogSeedResponse = {
  message: string;
  created: number;
  updated: number;
  total_seed_items: number;
};

async function parseApiError(response: Response, fallback: string): Promise<never> {
  const data = await response.json().catch(() => null);
  throw new Error(data?.detail || fallback);
}

export async function getSkills(
  token: string,
  filters: SkillFilters = {}
): Promise<SkillResponse[]> {
  const params = new URLSearchParams();

  if (filters.query) params.set("query", filters.query);
  if (filters.category) params.set("category", filters.category);
  if (filters.source_name) params.set("source_name", filters.source_name);
  if (typeof filters.only_active === "boolean") {
    params.set("only_active", String(filters.only_active));
  }

  const query = params.toString();
  const url = `${API_BASE_URL}/skills/${query ? `?${query}` : ""}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudieron cargar las habilidades");
  }

  return response.json();
}

export async function seedCuratedSkillCatalog(
  token: string
): Promise<SkillCatalogSeedResponse> {
  const response = await fetch(`${API_BASE_URL}/skills/seed-curated-catalog`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await parseApiError(response, "No se pudo sembrar el catálogo curado");
  }

  return response.json();
}