import api from "./api";
import type { RunStatus } from "@/types";

export const runApi = {
	startRun(evaluationId: string) {
		return api
			.post<RunStatus>(`/evaluations/${evaluationId}/runs/`, {})
			.then((res) => res.data);
	},
	resumeRun(evaluationId: string, runId: string) {
		return api
			.post<RunStatus>(`/evaluations/${evaluationId}/runs/`, {
				resumeRunId: Number(runId),
			})
			.then((res) => res.data);
	},
	fetchRunStatus(runId: string, signal?: AbortSignal) {
		return api
			.get<RunStatus>(`/runs/${runId}/status/`, { signal })
			.then((res) => res.data);
	},
	fetchLatestRun(evaluationId: string, signal?: AbortSignal) {
		return api
			.get<RunStatus>(`/evaluations/${evaluationId}/runs/latest/`, { signal })
			.then((res) => res.data);
	},
};
