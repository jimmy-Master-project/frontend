import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "dashboard",
      component: () => import("../views/DashboardView.vue"),
    },
    {
      path: "/evaluations/new",
      name: "evaluation-create",
      component: () => import("../views/EvaluationCreateView.vue"),
    },
    {
      path: "/evaluations/:evaluationId/prompts",
      name: "prompt-population",
      component: () => import("../views/PromptPopulationView.vue"),
      props: true,
    },
    {
      path: "/evaluations/:evaluationId/llm",
      name: "target-llm",
      component: () => import("../views/TargetLLMConfigView.vue"),
      props: true,
    },
    {
      path: "/evaluations/:evaluationId/run",
      name: "evaluation-run",
      component: () => import("../views/EvaluationRunView.vue"),
      props: true,
    },
    {
      path: "/evaluations/:evaluationId/responses",
      name: "evaluation-responses",
      component: () => import("../views/ResponseView.vue"),
      props: true,
    },
    {
      path: "/evaluations/:evaluationId/fairness-metrics",
      name: "fairness-metrics",
      component: () => import("../views/FairnessMetricsView.vue"),
      props: true,
    },
    {
      path: "/benchmark-validation",
      name: "benchmark-validation",
      component: () => import("../views/BenchmarkValidationView.vue"),
    },
  ],
});

export default router;
