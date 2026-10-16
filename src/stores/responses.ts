import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { createPoller } from "@/composables/usePolling";
import { formatApiError } from "@/services/api";
import {
  responseApi,
  type ClassificationMetricMappingPayload,
  type LangFairLanguage,
  type LangFairMetricsStatusResult,
} from "@/services/responseApi";
import type {
  ClassificationLabel,
  LangFairComputationStatus,
  LangFairMetricsResult,
  ResponseFilters,
  ResponseItem,
  TaskType,
} from "@/types";

const DEFAULT_FILTERS: ResponseFilters = {
  category: null,
  generationIndex: null,
  keyword: "",
};

interface LangFairRequest {
  evaluationId: string;
  runId: string;
  mapping?: ClassificationMetricMappingPayload;
  language: LangFairLanguage;
}

export const useResponsesStore = defineStore("responses", () => {
  const currentEvaluationId = ref<string | null>(null);
  const responses = ref<ResponseItem[]>([]);
  const total = ref(0);
  const currentPage = ref(1);
  const pageSize = ref(20);
  const model = ref("");
  const promptCount = ref(0);
  const runId = ref<string | null>(null);
  const runLabel = ref("");
  // Run picked by the user (null = always the latest run of the evaluation).
  const selectedRunId = ref<string | null>(null);
  const taskType = ref<TaskType | string>("other");
  const language = ref<LangFairLanguage>("en");
  const classificationLabels = ref<ClassificationLabel[]>([]);
  const filters = ref<ResponseFilters>({ ...DEFAULT_FILTERS });

  const loading = ref(false);
  const error = ref<string | null>(null);

  // --- LangFair (async computation) -------------------------------------
  const langFairMetrics = ref<LangFairMetricsResult | null>(null);
  const langFairStatus = ref<LangFairComputationStatus>("none");
  // True while a computation is being requested or is running server-side.
  const langFairLoading = ref(false);
  const langFairError = ref<string | null>(null);
  const langFairPartial = ref(false);
  const langFairRunStatus = ref<string | null>(null);

  let responsesSeq = 0;
  let langFairSeq = 0;
  let langFairRequest: LangFairRequest | null = null;

  const langFairPoller = createPoller<LangFairMetricsStatusResult>({
    fetch: () => {
      const request = langFairRequest;
      if (!request) throw new Error("No LangFair computation to poll.");
      return responseApi.fetchCachedLangFairMetrics(
        request.runId,
        request.mapping,
        request.language,
      );
    },
    onResult: (result) => {
      const request = langFairRequest;
      if (!request || !isLangFairCurrent(request)) return true;
      applyLangFairResult(result);
      return result.status !== "running";
    },
  });
  const langFairConnectionLost = langFairPoller.connectionLost;

  const hasActiveFilters = computed(
    () =>
      Boolean(filters.value.keyword) ||
      filters.value.category !== null ||
      filters.value.generationIndex !== null,
  );

  function isCurrent(evaluationId: string) {
    return currentEvaluationId.value === evaluationId;
  }

  function isLangFairCurrent(request: LangFairRequest) {
    return (
      isCurrent(request.evaluationId) &&
      runId.value === request.runId &&
      langFairRequest === request
    );
  }

  /**
   * Binds the store to an evaluation. Entering a different evaluation clears
   * responses, filters, page and LangFair state from the previous one.
   */
  function enterEvaluation(evaluationId: string | number) {
    const id = String(evaluationId);
    if (currentEvaluationId.value !== id) {
      reset();
      currentEvaluationId.value = id;
    }
    return id;
  }

  /** Show a specific run (null = latest); the caller refetches. */
  function selectRun(nextRunId: string | number | null) {
    const next = nextRunId === null || nextRunId === "" ? null : String(nextRunId);
    if (selectedRunId.value === next) return;
    selectedRunId.value = next;
    currentPage.value = 1;
  }

  async function fetchResponses(evaluationId: string | number, signal?: AbortSignal) {
    const id = enterEvaluation(evaluationId);
    const seq = ++responsesSeq;
    loading.value = true;
    error.value = null;
    try {
      const result = await responseApi.fetchResponses(
        id,
        {
          keyword: filters.value.keyword || undefined,
          category: filters.value.category || undefined,
          generationIndex: filters.value.generationIndex ?? undefined,
          page: currentPage.value,
          pageSize: pageSize.value,
          runId: selectedRunId.value ?? undefined,
        },
        signal,
      );
      // Drop responses of a superseded request or another evaluation.
      if (seq !== responsesSeq || !isCurrent(id)) return;
      const nextRunId =
        result.runId === null || result.runId === undefined
          ? null
          : String(result.runId);
      responses.value = result.items;
      total.value = result.total;
      model.value = result.model;
      runLabel.value = result.runLabel ?? "";
      promptCount.value = result.promptCount;
      if (runId.value !== nextRunId) resetLangFair();
      runId.value = nextRunId;
      taskType.value = result.taskType ?? "other";
      language.value = result.language ?? "en";
      classificationLabels.value = result.classificationLabels ?? [];
    } catch (e) {
      if (seq !== responsesSeq || !isCurrent(id)) return;
      error.value = formatApiError(e, "Failed to load responses.");
      throw e;
    } finally {
      if (seq === responsesSeq) loading.value = false;
    }
  }

  function applyLangFairResult(result: LangFairMetricsStatusResult) {
    langFairStatus.value = result.status;
    langFairPartial.value = result.partial;
    langFairRunStatus.value = result.runStatus;
    if (result.status === "completed") {
      langFairMetrics.value = result.result;
      langFairError.value = null;
      langFairLoading.value = false;
    } else if (result.status === "failed") {
      langFairError.value = result.error || "LangFair metric computation failed.";
      langFairLoading.value = false;
    } else if (result.status === "running") {
      langFairError.value = null;
      langFairLoading.value = true;
    } else {
      langFairLoading.value = false;
    }
  }

  function beginLangFairRequest(
    mapping: ClassificationMetricMappingPayload | undefined,
    selectedLanguage: LangFairLanguage,
  ): LangFairRequest | null {
    if (!runId.value || !currentEvaluationId.value) return null;
    langFairPoller.stop();
    langFairSeq += 1;
    langFairRequest = {
      evaluationId: currentEvaluationId.value,
      runId: runId.value,
      mapping,
      language: selectedLanguage,
    };
    return langFairRequest;
  }

  /**
   * Loads an already computed (cached) result without triggering a
   * computation; resumes polling when one is still running.
   */
  async function loadCachedLangFairMetrics(
    mapping?: ClassificationMetricMappingPayload,
    selectedLanguage: LangFairLanguage = language.value,
    signal?: AbortSignal,
  ) {
    const request = beginLangFairRequest(mapping, selectedLanguage);
    if (!request) return;
    const seq = langFairSeq;
    try {
      const result = await responseApi.fetchCachedLangFairMetrics(
        request.runId,
        request.mapping,
        request.language,
        signal,
      );
      if (seq !== langFairSeq || !isLangFairCurrent(request) || signal?.aborted) return;
      applyLangFairResult(result);
      if (result.status === "running") langFairPoller.start(signal);
    } catch {
      // A missing cache entry is not an error for the user; they can still
      // click Calculate.
    }
  }

  async function fetchLangFairMetrics(
    mapping?: ClassificationMetricMappingPayload,
    selectedLanguage: LangFairLanguage = language.value,
    signal?: AbortSignal,
  ) {
    const request = beginLangFairRequest(mapping, selectedLanguage);
    if (!request) return;
    const seq = langFairSeq;
    langFairLoading.value = true;
    langFairError.value = null;
    try {
      const result = await responseApi.startLangFairMetrics(
        request.runId,
        request.mapping,
        request.language,
      );
      if (seq !== langFairSeq || !isLangFairCurrent(request)) return;
      applyLangFairResult(result);
      if (result.status === "running") langFairPoller.start(signal);
    } catch (e) {
      if (seq !== langFairSeq || !isLangFairCurrent(request)) return;
      langFairLoading.value = false;
      langFairError.value = formatApiError(e, "Failed to load LangFair metrics.");
      throw e;
    }
  }

  function stopLangFairPolling() {
    langFairPoller.stop();
    // Polling may resume later from the cached GET; don't show a stale spinner.
    langFairLoading.value = false;
  }

  function resetLangFair() {
    langFairPoller.stop();
    langFairSeq += 1;
    langFairRequest = null;
    langFairMetrics.value = null;
    langFairStatus.value = "none";
    langFairLoading.value = false;
    langFairError.value = null;
    langFairPartial.value = false;
    langFairRunStatus.value = null;
  }

  function setFilter(partial: Partial<ResponseFilters>) {
    filters.value = { ...filters.value, ...partial };
    currentPage.value = 1;
  }

  function resetFilters() {
    filters.value = { ...DEFAULT_FILTERS };
    currentPage.value = 1;
  }

  async function search(evaluationId: string | number, keyword: string) {
    setFilter({ keyword });
    await fetchResponses(evaluationId);
  }

  function setPage(page: number) {
    currentPage.value = page;
  }

  function reset() {
    responsesSeq += 1;
    resetLangFair();
    currentEvaluationId.value = null;
    responses.value = [];
    total.value = 0;
    currentPage.value = 1;
    model.value = "";
    promptCount.value = 0;
    runId.value = null;
    runLabel.value = "";
    selectedRunId.value = null;
    taskType.value = "other";
    language.value = "en";
    classificationLabels.value = [];
    filters.value = { ...DEFAULT_FILTERS };
    loading.value = false;
    error.value = null;
  }

  return {
    currentEvaluationId,
    responses,
    total,
    currentPage,
    pageSize,
    model,
    promptCount,
    runId,
    runLabel,
    selectedRunId,
    selectRun,
    taskType,
    language,
    classificationLabels,
    langFairMetrics,
    langFairStatus,
    langFairLoading,
    langFairError,
    langFairPartial,
    langFairRunStatus,
    langFairConnectionLost,
    filters,
    hasActiveFilters,
    loading,
    error,
    enterEvaluation,
    fetchResponses,
    fetchLangFairMetrics,
    loadCachedLangFairMetrics,
    stopLangFairPolling,
    setFilter,
    resetFilters,
    search,
    setPage,
    reset,
  };
});
