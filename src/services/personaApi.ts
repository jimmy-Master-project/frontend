import api from "./api";
import type { PersonaCard, PersonaCatalog, PersonaPreview } from "../types";

export interface PersonaSamplePayload {
	sampleSize: number;
	selectedAttributes: string[];
	/** Keyed by persona attribute name (data keys). */
	filters: Record<string, string[]>;
	stratify: string | null;
	seed: number;
	pool?: string;
}

export interface PersonaSampleResult {
	count: number;
	pool: string;
	selectedAttributes: string[];
	personas: PersonaPreview[];
	partial: boolean;
}

export interface PersonaListResult {
	pool: string;
	offset: number;
	limit: number;
	/** Number of personas that can be browsed (null if unknown). */
	total: number | null;
	personas: PersonaCard[];
}

export const personaApi = {
	listPersonas(params: { offset: number; limit: number; pool?: string }) {
		return api
			.get<PersonaListResult>("/persona/personas", { params })
			.then((res) => res.data);
	},
	/** Cards of specific personas (e.g. ones picked for an earlier population). */
	listPersonasByIds(ids: string[], pool?: string) {
		return api
			.get<PersonaListResult>("/persona/personas", {
				params: { ids: ids.join(","), offset: 0, limit: 1, ...(pool ? { pool } : {}) },
			})
			.then((res) => res.data.personas);
	},
	getPersona(personaId: string, pool?: string) {
		return api
			.get<PersonaPreview>(`/persona/personas/${encodeURIComponent(personaId)}`, {
				params: pool ? { pool } : undefined,
			})
			.then((res) => res.data);
	},
	getPersonaAttributes() {
		return api
			.get<PersonaCatalog>("/persona/attributes")
			.then((res) => res.data);
	},
	samplePersonas(payload: PersonaSamplePayload) {
		return api
			.post<PersonaSampleResult>("/persona/sample", payload)
			.then((res) => res.data);
	},
};
