import api from "./api";
import type { RunResponseRecord, RunStatus } from "@/types";

export const runApi = {
	startRun(evaluationId: string, label?: string) {
		return api
			.post<RunStatus>(`/evaluations/${evaluationId}/runs/`, label ? { label } : {})
			.then((res) => res.data);
	},
	/** Every run of the evaluation, newest first. */
	listRuns(evaluationId: string, signal?: AbortSignal) {
		return api
			.get<RunStatus[]>(`/evaluations/${evaluationId}/runs/`, { signal })
			.then((res) => res.data);
	},
	updateRun(runId: number | string, payload: { label: string }) {
		return api.patch<RunStatus>(`/runs/${runId}/`, payload).then((res) => res.data);
	},
	/** Deletes the run and all of its responses (refused while active). */
	deleteRun(runId: number | string) {
		return api.delete(`/runs/${runId}/`).then(() => undefined);
	},
	/**
	 * Downloads the run's results as CSV: one table (`table` = run, responses,
	 * prompts, personas, metrics, group_comparison, metrics_detail) or, without
	 * `table`, a ZIP holding every table as its own CSV.
	 */
	exportRun(runId: number | string, table?: string) {
		return api
			.get<Blob>(`/runs/${runId}/export/`, {
				params: table ? { table } : {},
				responseType: "blob",
			})
			.then((res) => {
				const disposition = String(res.headers["content-disposition"] ?? "");
				const fileName =
					/filename="([^"]+)"/.exec(disposition)?.[1] ??
					`run${runId}_${table ?? "export"}.${table ? "csv" : "zip"}`;
				return { blob: res.data, fileName };
			});
	},
	fetchRunResponses(runId: number | string, signal?: AbortSignal) {
		return api
			.get<{ count: number; results: RunResponseRecord[] }>(`/runs/${runId}/responses/`, { signal })
			.then((res) => res.data.results);
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
