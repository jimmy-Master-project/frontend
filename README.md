# LLM Fairness Evaluation Platform — Frontend

Vue 3 + TypeScript + Vite frontend for the MVP flow described in [`docs/spec.md`](docs/spec.md):

```
Create Evaluation → Prompt Population → Target LLM → Run → Responses
```

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
