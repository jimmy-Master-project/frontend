import api from "./api";
import type { RunStatus } from "@/types";

interface BackendRunStatus {
	id?: number;
	run_id?: number;
	status: RunStatus["status"];
	total_prompts?: number;
	completed_prompts?: number;
	total_generations?: number;
	completed_generations?: number;
	error_message?: string | null;
}

function normalizeRunStatus(data: BackendRunStatus): RunStatus {
	return {
		runId: data.run_id?.toString() ?? data.id?.toString() ?? null,
		status: data.status,
		totalPrompts: data.total_prompts ?? 0,
		completedPrompts: data.completed_prompts ?? 0,
		totalGenerations: data.total_generations ?? 0,
		completedGenerations: data.completed_generations ?? 0,
		error: data.error_message ?? null,
	};
}

export const runApi = {
	startRun(evaluationId: string) {
		return api
			.post<BackendRunStatus>(`/evaluations/${evaluationId}/runs/`, {})
			.then((res) => normalizeRunStatus(res.data));
	},
	fetchRunStatus(runId: string) {
		return api
			.get<BackendRunStatus>(`/runs/${runId}/status/`)
			.then((res) => normalizeRunStatus(res.data));
	},
};
