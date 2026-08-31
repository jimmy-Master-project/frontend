import { defineStore } from "pinia";
import { ref } from "vue";

import { responseApi, type LangFairLanguage } from "@/services/responseApi";
import type {
  ClassificationLabel,
  ClassificationSummary,
  LangFairMetricsResult,
  ResponseFilters,
  ResponseItem,
  TaskType,
} from "@/types";

export const useResponsesStore = defineStore("responses", () => {
  const responses = ref<ResponseItem[]>([]);
  const total = ref(0);
  const currentPage = ref(1);
  const pageSize = ref(20);
  const model = ref("");
  const promptCount = ref(0);
  const runId = ref<string | number | null>(null);
  const taskType = ref<TaskType | string>("other");
  const language = ref<LangFairLanguage>("en");
  const classificationLabels = ref<ClassificationLabel[]>([]);
  const classificationSummary = ref<ClassificationSummary>({
    threshold: 0.5,
    classifiers: {},
  });
  const langFairMetrics = ref<LangFairMetricsResult | null>(null);
  const langFairLoading = ref(false);
  const langFairError = ref<string | null>(null);
  const filters = ref<ResponseFilters>({
    category: null,
    generationIndex: null,
    keyword: "",
  });

  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchResponses(evaluationId: string) {
    loading.value = true;
    error.value = null;
    try {
      const result = await responseApi.fetchResponses(evaluationId, {
        keyword: filters.value.keyword || undefined,
        category: filters.value.category || undefined,
        generationIndex: filters.value.generationIndex ?? undefined,
        page: currentPage.value,
        pageSize: pageSize.value,
      });
      const previousRunId = runId.value;
      responses.value = result.items;
      total.value = result.total;
      model.value = result.model;
      promptCount.value = result.promptCount;
      runId.value = result.runId;
      if (previousRunId !== result.runId) {
        langFairMetrics.value = null;
        langFairError.value = null;
      }
      taskType.value = result.taskType ?? "other";
      language.value = result.language ?? "en";
      classificationLabels.value = result.classificationLabels ?? [];
      classificationSummary.value = result.classificationSummary ?? {
        threshold: 0.5,
        classifiers: {},
      };
    } catch (e) {
      error.value = "Failed to load responses.";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchLangFairMetrics(mapping?: {
    positiveLabels: Array<number | string>;
    negativeLabels?: Array<number | string>;
  }, selectedLanguage: LangFairLanguage = language.value) {
    if (!runId.value) return;
    langFairLoading.value = true;
    langFairError.value = null;
    try {
      langFairMetrics.value = await responseApi.fetchLangFairMetrics(
        runId.value,
        mapping,
        selectedLanguage,
      );
    } catch (e) {
      langFairError.value = "Failed to load LangFair metrics.";
      throw e;
    } finally {
      langFairLoading.value = false;
    }
  }

  function setFilter(partial: Partial<ResponseFilters>) {
    filters.value = { ...filters.value, ...partial };
    currentPage.value = 1;
  }

  async function search(evaluationId: string, keyword: string) {
    setFilter({ keyword });
    await fetchResponses(evaluationId);
  }

  function setPage(page: number) {
    currentPage.value = page;
  }

  return {
    responses,
    total,
    currentPage,
    pageSize,
    model,
    promptCount,
    runId,
    taskType,
    language,
    classificationLabels,
    classificationSummary,
    langFairMetrics,
    langFairLoading,
    langFairError,
    filters,
    loading,
    error,
    fetchResponses,
    fetchLangFairMetrics,
    setFilter,
    search,
    setPage,
  };
});
