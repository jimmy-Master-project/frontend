import api from "./api";
import type {
	PersonaAttribute,
	PersonaCatalog,
	PersonaPreview,
} from "../types";

export interface PersonaSamplePayload {
	sample_size: number;
	selected_attributes: string[];
	filters: Record<string, string[]>;
	stratify: string | null;
	seed: number;
	pool?: string;
}

export interface PersonaSampleResult {
	personas: PersonaPreview[];
	pool?: string;
	partial?: boolean;
}

type RawPersonaDimension = {
	id?: string;
	key?: string;
	label?: string;
	category?: string;
	description?: string;
	values?: string[];
	allowedValues?: string[];
	allowed_values?: string[];
};

type RawPersonaGroup = {
	label?: string;
	dimensions?: RawPersonaDimension[];
	dimensionIds?: string[];
	dimension_ids?: string[];
	subgroups?: RawPersonaGroup[];
};

function normalizeAttribute(
	attribute: RawPersonaDimension | string,
	fallbackCategory?: string,
): PersonaAttribute | null {
	if (typeof attribute === "string") {
		return { key: attribute, label: attribute, category: fallbackCategory };
	}
	const key = attribute.key || attribute.id;
	if (!key) return null;
	return {
		key,
		label: attribute.label,
		category: attribute.category || fallbackCategory,
		description: attribute.description,
		values:
			attribute.values || attribute.allowedValues || attribute.allowed_values,
	};
}

function collectAttributesFromGroups(
	groups: RawPersonaGroup[],
	parentCategory?: string,
) {
	const attributes: PersonaAttribute[] = [];
	for (const group of groups) {
		const category = group.label || parentCategory || "Other";
		for (const dimension of group.dimensions || []) {
			const attribute = normalizeAttribute(dimension, category);
			if (attribute) attributes.push(attribute);
		}
		for (const dimensionId of group.dimensionIds || group.dimension_ids || []) {
			const attribute = normalizeAttribute(dimensionId, category);
			if (attribute) attributes.push(attribute);
		}
		attributes.push(
			...collectAttributesFromGroups(group.subgroups || [], category),
		);
	}
	return attributes;
}

function dedupeAttributes(attributes: PersonaAttribute[]) {
	const seen = new Set<string>();
	return attributes.filter((attribute) => {
		if (seen.has(attribute.key)) return false;
		seen.add(attribute.key);
		return true;
	});
}

function attributesFromCatalog(body: Record<string, unknown>) {
	const catalog = (body.catalog ?? {}) as Record<string, unknown>;
	const dimensionCategories = (catalog.dimensionCategories ?? {}) as Record<
		string,
		unknown
	>;
	const devProfile = (dimensionCategories.devProfile ?? {}) as Record<
		string,
		unknown
	>;
	const groups = devProfile.groups;
	return Array.isArray(groups)
		? collectAttributesFromGroups(groups as RawPersonaGroup[])
		: [];
}

function normalizeAttributesResponse(data: unknown): PersonaCatalog {
	if (Array.isArray(data)) {
		return {
			attributes: dedupeAttributes(
				data
					.map((item) => normalizeAttribute(item as RawPersonaDimension))
					.filter(Boolean) as PersonaAttribute[],
			),
		};
	}

	const body = (data ?? {}) as Record<string, unknown>;
	const rawAttributes = body.attributes ?? body.dimensions ?? body.results ?? [];
	const normalizedTopLevel = Array.isArray(rawAttributes)
		? (rawAttributes
				.map((item) => normalizeAttribute(item as RawPersonaDimension | string))
				.filter(Boolean) as PersonaAttribute[])
		: [];
	const attributes =
		normalizedTopLevel.length > 0
			? normalizedTopLevel
			: attributesFromCatalog(body);

	return {
		attributes: dedupeAttributes(attributes),
		pool: typeof body.pool === "string" ? body.pool : undefined,
		sampleSizeMin:
			typeof body.sample_size_min === "number" ? body.sample_size_min : undefined,
		sampleSizeMax:
			typeof body.sample_size_max === "number" ? body.sample_size_max : undefined,
		previewSizeMax:
			typeof body.preview_size_max === "number"
				? body.preview_size_max
				: undefined,
	};
}

function normalizeSampleResponse(data: unknown): PersonaSampleResult {
	if (Array.isArray(data)) {
		return { personas: data as PersonaPreview[] };
	}

	const body = (data ?? {}) as Record<string, unknown>;
	const rawPersonas = body.personas ?? body.results ?? body.preview ?? [];
	return {
		personas: Array.isArray(rawPersonas) ? (rawPersonas as PersonaPreview[]) : [],
		pool: typeof body.pool === "string" ? body.pool : undefined,
		partial: body.partial === true,
	};
}

export const personaApi = {
	getPersonaAttributes() {
		return api
			.get("/persona/attributes")
			.then((res) => normalizeAttributesResponse(res.data));
	},
	samplePersonas(payload: PersonaSamplePayload) {
		return api
			.post("/persona/sample", payload)
			.then((res) => normalizeSampleResponse(res.data));
	},
};
