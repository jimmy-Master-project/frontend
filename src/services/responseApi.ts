import api from "./api";
import type {
    ClassificationLabel,
    ClassificationSummary,
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
    classificationSummary?: ClassificationSummary;
}

export interface ClassificationMetricMappingPayload {
    positiveLabels: Array<number | string>;
    negativeLabels?: Array<number | string>;
}

export type LangFairLanguage = "en" | "zh-TW" | "auto";

export const responseApi = {
    fetchResponses(evaluationId: string, params: FetchResponsesParams = {}) {
        return api
            .get<FetchResponsesResult>(
                `/evaluations/${evaluationId}/responses`,
                { params },
            )
            .then((res) => res.data);
    },
    fetchLangFairMetrics(
        runId: string | number,
        classificationMapping?: ClassificationMetricMappingPayload,
        language: LangFairLanguage = "en",
    ) {
        if (
            classificationMapping &&
            classificationMapping.positiveLabels.length > 0
        ) {
            return api
                .post<LangFairMetricsResult>(
                    `/runs/${runId}/fairness-metrics`,
                    {
                        suites: ["classification"],
                        options: {
                            language,
                            classification: {
                                classificationMetricMapping:
                                    classificationMapping,
                            },
                        },
                    },
                    { timeout: 900000 },
                )
                .then((res) => res.data);
        }
        return api
            .post<LangFairMetricsResult>(
                `/runs/${runId}/fairness-metrics`,
                { options: { language } },
                { timeout: 900000 },
            )
            .then((res) => res.data);
    },
};
