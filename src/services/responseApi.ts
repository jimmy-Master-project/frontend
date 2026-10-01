import api from "./api";
import type {
    ClassificationLabel,
    LangFairComputationStatus,
    LangFairMetricsResult,
    ResponseItem,
    TaskType,
} from "@/types";

export interface FetchResponsesParams {
    keyword?: string;
    category?: string | null;
    generationIndex?: number | null;
    page?: number;
    pageSize?: number;
}

export interface FetchResponsesResult {
    items: ResponseItem[];
    total: number;
    model: string;
    promptCount: number;
    runId: string | number | null;
    taskType?: TaskType | string;
    language?: LangFairLanguage;
    classificationLabels?: ClassificationLabel[];
}

export interface ClassificationMetricMappingPayload {
    positiveLabels: Array<number | string>;
    negativeLabels?: Array<number | string>;
}

export type LangFairLanguage = "en" | "auto";

type LangFairMetricsResponse = Partial<LangFairMetricsResult> & {
    status?: LangFairComputationStatus;
};

export interface LangFairMetricsStatusResult {
    status: LangFairComputationStatus;
    /** Present when status is "completed". */
    result: LangFairMetricsResult | null;
    error: string | null;
    runStatus: string | null;
    partial: boolean;
}

function hasClassificationMapping(
    mapping?: ClassificationMetricMappingPayload,
): mapping is ClassificationMetricMappingPayload {
    return Boolean(mapping && mapping.positiveLabels.length > 0);
}

function buildLangFairBody(
    classificationMapping: ClassificationMetricMappingPayload | undefined,
    language: LangFairLanguage,
): { suites?: string[]; options: Record<string, unknown> } {
    if (hasClassificationMapping(classificationMapping)) {
        return {
            suites: ["classification"],
            options: {
                language,
                classification: {
                    classificationMetricMapping: classificationMapping,
                },
            },
        };
    }
    return { options: { language } };
}

function buildLangFairQuery(
    classificationMapping: ClassificationMetricMappingPayload | undefined,
    language: LangFairLanguage,
) {
    // The backend cache key includes the suites and the full `options`
    // object (incl. language), so send exactly what the POST body sends.
    const body = buildLangFairBody(classificationMapping, language);
    const params: Record<string, string | string[]> = {
        options: JSON.stringify(body.options),
    };
    if (body.suites?.length) params.suite = body.suites;
    return params;
}

function normalizeLangFairResponse(
    data: LangFairMetricsResponse,
): LangFairMetricsStatusResult {
    const status: LangFairComputationStatus =
        data.status ?? (data.suites ? "completed" : "none");
    const runStatus = typeof data.runStatus === "string" ? data.runStatus : null;
    const partial = data.partial === true;
    return {
        status,
        result:
            status === "completed"
                ? {
                      ...data,
                      runId: data.runId ?? null,
                      responseCount: data.responseCount ?? 0,
                      availableSuites: data.availableSuites ?? [],
                      suites: data.suites ?? {},
                      status,
                      runStatus: runStatus ?? undefined,
                      partial,
                  }
                : null,
        error: typeof data.error === "string" ? data.error : null,
        runStatus,
        partial,
    };
}

export const responseApi = {
    fetchResponses(
        evaluationId: string,
        params: FetchResponsesParams = {},
        signal?: AbortSignal,
    ) {
        return api
            .get<FetchResponsesResult>(
                `/evaluations/${evaluationId}/responses`,
                { params, signal },
            )
            .then((res) => res.data);
    },
    /**
     * Deletes one response record of a run. The backend answers 409 while the
     * run is pending/running (surfaced through ApiError.status).
     */
    deleteResponse(runId: string | number, responseId: string | number) {
        return api
            .delete<void>(`/runs/${runId}/responses/${responseId}/`)
            .then((res) => res.data);
    },
    /**
     * Starts (or re-uses) an async LangFair computation. Resolves to the
     * completed payload (`status: "completed"`, HTTP 200, cached) or to
     * `{ status: "running" }` (HTTP 202) — poll `fetchCachedLangFairMetrics`
     * afterwards until it reports "completed" or "failed".
     */
    startLangFairMetrics(
        runId: string | number,
        classificationMapping?: ClassificationMetricMappingPayload,
        language: LangFairLanguage = "en",
    ) {
        return api
            .post<LangFairMetricsResponse>(
                `/runs/${runId}/fairness-metrics/`,
                buildLangFairBody(classificationMapping, language),
            )
            .then((res) => normalizeLangFairResponse(res.data));
    },
    /** Never computes: returns the cached result or the computation status. */
    fetchCachedLangFairMetrics(
        runId: string | number,
        classificationMapping?: ClassificationMetricMappingPayload,
        language: LangFairLanguage = "en",
        signal?: AbortSignal,
    ) {
        return api
            .get<LangFairMetricsResponse>(`/runs/${runId}/fairness-metrics/`, {
                params: buildLangFairQuery(classificationMapping, language),
                // Repeat array keys (`suite=a&suite=b`) the way Django's
                // QueryDict.getlist expects, instead of axios' `suite[]=`.
                paramsSerializer: { indexes: null },
                signal,
            })
            .then((res) => normalizeLangFairResponse(res.data));
    },
};
