# LLM Fairness Evaluation Platform — Frontend

Vue 3 + TypeScript + Vite frontend for the MVP flow described in [`docs/spec.md`](docs/spec.md):

```
Create Evaluation → Prompt Population → Target LLM → Run → Responses
```

The Prompt Population page starts with the **Question Directions** panel
(`src/components/prompts/TestPlanPanel.vue`): the initial prompt agent turns target-LLM information
(service scope, policies, interaction stages, risk priorities) into identity-neutral question
directions, which the user reviews, edits and saves as the evaluation's task objectives before
generating the persona prompt population. Design: `../init-prompt-bot/init_prompt_agent設計.md`.

Experiments are run inside the normal flow: one evaluation is one experiment.

- *Prompt Population page → Population history & comparison* (experiment 1): every population of the
  evaluation is listed; name each after its condition (G1–G4), select several and compare pairs, pair yield,
  minimal-edit rate, diversity, distinct-n, planned HELM cells and generation cost; export the comparison and
  every prompt with empty annotation columns.
- *Run page*: choose which population (condition) to send when several exist.
- *Run history page → Compare* (experiment 2): fairness metrics of the selected runs side by side (value,
  95% CI, flagged), compute missing metrics, export long-format metrics and a run overview as CSV.

The Target LLM page also has a **Session isolation check** (canary test) whose trials can be exported.

## Stack

- Vue 3 (Composition API) + TypeScript
- Vite
- Vue Router
- Pinia
- Axios
- Element Plus

## Getting started

```bash
npm install
cp .env.example .env   # set VITE_API_BASE_URL to your backend API
npm run dev
```

Other scripts:

```bash
npm run build       # type-check + production build
npm run preview     # preview the production build
npm run type-check  # vue-tsc only
npm test            # vitest unit + component tests (src/**/__tests__/*.spec.ts)
```

## Project structure

```
src/
  components/   # feature components grouped by domain (evaluation, prompts, llm, run, responses, common)
  views/        # one view per route
  stores/       # Pinia stores (evaluation, promptPopulation, llmConfig, run, responses)
  services/     # Axios API modules, one per backend resource
  router/       # route definitions
  types/        # shared TypeScript types
```

## Scope

This frontend only implements the flow above. Harm classification, bias detection, fairness metrics,
and result dashboards are explicitly out of scope for this MVP (see `docs/spec.md`).
