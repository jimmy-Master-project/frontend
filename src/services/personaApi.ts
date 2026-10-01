import api from "./api";
import type { PersonaCatalog, PersonaPreview } from "../types";

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

export const personaApi = {
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
