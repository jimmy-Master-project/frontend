# LLM Fairness Evaluation Platform — 前端規格書

## 1. 前端目標

目前 MVP 前端只涵蓋以下流程：

```text
使用者輸入 Use Case
        ↓
設定 Prompt Generation Agent
        ↓
產生 Prompt Population
        ↓
檢視 / 修改 Prompt Population
        ↓
設定 Target LLM
        ↓
執行 Prompt Population
        ↓
查看 LLM Responses
```

目前不包含：

```text
Harm Classification
Bias Detection
Fairness Metrics
Representational Harm
Allocational Harm
Result Dashboard
```

---

# 2. 技術選型

```text
Vue 3
TypeScript
Vite
Vue Router
Pinia
Axios
Element Plus
```

建議採用 Composition API。

專案建立：

```text
Vue 3 + TypeScript
```

---

# 3. 前端整體頁面流程

```text
Dashboard
   ↓
Create Evaluation
   ↓
Prompt Population
   ↓
Target LLM Configuration
   ↓
Run
   ↓
Responses
```

主要 Route：

```text
/
    
/evaluations/new

/evaluations/:evaluationId/prompts

/evaluations/:evaluationId/llm

/evaluations/:evaluationId/run

/evaluations/:evaluationId/responses
```

---

# 4. Page 1 — Dashboard

Route：

```text
/
```

用途：

顯示目前建立的 Evaluation Projects。

頁面內容：

```text
LLM Evaluation Projects

[ + New Evaluation ]
```

Table：

| Name             | Task Type       | Prompt Count | Status    | Created    |
| ---------------- | --------------- | -----------: | --------- | ---------- |
| Resume Screening | Recommendation  |          100 | Completed | 2026/08/13 |
| QA Test          | Text Generation |           50 | Draft     | 2026/08/13 |

Status：

```text
Draft
Generating Prompts
Prompt Ready
Ready
Running
Completed
Failed
```

操作：

```text
Open
Delete
```

---

# 5. Page 2 — Create Evaluation

Route：

```text
/evaluations/new
```

頁面標題：

```text
Create Evaluation
```

---

# 6. Evaluation Form

欄位一：

## Project Name

Input：

```text
Resume Screening Evaluation
```

必填。

---

欄位二：

## Use Case Description

Textarea。

例如：

```text
使用 LLM 分析應徵者履歷，
並根據工作需求推薦最適合的候選人。
```

必填。

---

欄位三：

## Task Type

Select：

```text
Text Generation
Classification
Recommendation
Other
```

Backend value：

```text
text_generation
classification
recommendation
other
```

---

# 7. 建立完成

按鈕：

```text
Create Evaluation
```

成功後導向：

```text
/evaluations/{id}/prompts
```

---

# 8. Page 3 — Prompt Population

Route：

```text
/evaluations/:evaluationId/prompts
```

這是目前 MVP 最重要的頁面之一。

畫面分為兩個主要區域：

```text
Use Case Summary
       +
Prompt Generation
       +
Prompt Population
```

---

# 9. Use Case Summary

頁面上方顯示：

```text
Project
Resume Screening Evaluation

Use Case
使用 LLM 分析應徵者履歷並推薦候選人

Task Type
Recommendation
```

這部分為 Read Only。

提供：

```text
Edit Use Case
```

可以回到 Evaluation 編輯。

---

# 10. Prompt Generation Agent

卡片：

```text
Prompt Population Generator
```

設定欄位：

## Provider

Select：

```text
OpenAI Compatible
OpenAI
Gemini
Custom
```

---

## Model

Input / Select：

```text
gpt-5-mini
```

---

## Prompt Count

Number Input：

```text
100
```

限制：

```text
Minimum: 1
```

MVP 可以前端先限制：

```text
Maximum: 1000
```

---

## Temperature

Slider / Number Input：

```text
0.8
```

範圍：

```text
0 - 2
```

---

## Additional Instructions

Textarea。

選填。

例如：

```text
Generate realistic and diverse prompts.

Include different wording styles and different levels of detail.
```

---

# 11. Generate Prompt Population

主要 Button：

```text
Generate Prompt Population
```

點擊後：

```text
Loading
```

Button disabled。

頁面顯示：

```text
Generating Prompt Population...

The agent is generating prompts from your use case.
```

避免使用者重複送出。

---

# 12. Prompt Generation 完成狀態

成功：

```text
Prompt Population Generated

100 prompts
```

顯示：

```text
Generation Model
gpt-5-mini

Temperature
0.8

Requested
100

Generated
100
```

---

# 13. Prompt Population Table

顯示所有 Agent 產生的 prompts。

Table：

|  # | Prompt                             | Category       | Action |
| -: | ---------------------------------- | -------------- | ------ |
|  1 | Please compare these candidates... | ranking        | Edit   |
|  2 | Which applicant should I hire?     | recommendation | Edit   |
|  3 | Summarize the strengths...         | analysis       | Edit   |

Prompt 很長時只顯示前面部分。

例如：

```text
Please review the following resumes and...
```

點擊整列或：

```text
View
```

打開完整 Prompt。

---

# 14. Prompt Detail Dialog

Dialog 顯示：

```text
Prompt #12

Category
Recommendation

Prompt

Please review the following candidates
and recommend the most suitable applicant.
```

操作：

```text
Edit
Delete
Close
```

---

# 15. Edit Prompt

Edit Dialog：

```text
Prompt
[ textarea ]

Category
[ input ]
```

按：

```text
Save
```

更新資料。

---

# 16. Delete Prompt

Delete 前需要確認：

```text
Delete this prompt?

This action cannot be undone.
```

Button：

```text
Cancel
Delete
```

---

# 17. Add Prompt

Prompt Population Table 上方提供：

```text
+ Add Prompt
```

使用者可以人工新增。

欄位：

```text
Prompt
Category
```

這樣 Agent 生成後仍可以人工修正 Population。

---

# 18. Regenerate

提供：

```text
Regenerate
```

點擊後 Dialog：

```text
How would you like to regenerate?
```

選項：

### Replace Population

```text
Delete current prompts and generate a new population.
```

### Generate Additional Prompts

```text
Keep current prompts and generate additional prompts.
```

---

# 19. Prompt Population Statistics

Table 上方簡單顯示：

```text
Total Prompts
100
```

如果有 category，可以顯示：

```text
Recommendation    35
Ranking           28
Analysis          22
Other             15
```

MVP 不需要圖表。

---

# 20. 下一步

Page bottom：

```text
[ Back ]                     [ Configure Target LLM → ]
```

只有：

```text
prompt_count > 0
```

時才允許下一步。

---

# 21. Page 4 — Target LLM Configuration

Route：

```text
/evaluations/:evaluationId/llm
```

標題：

```text
Target LLM
```

說明文字：

```text
Configure the model that will receive the generated Prompt Population.
```

---

# 22. Target LLM Form

## Provider

Select：

```text
OpenAI Compatible
OpenAI
Gemini
Custom
```

MVP 建議主要測：

```text
OpenAI Compatible
```

---

## Model Name

Input：

```text
qwen3-8b
```

---

## Base URL

Input：

```text
http://localhost:1234/v1
```

---

## API Key

Password Input：

```text
••••••••••
```

注意：

前端不能在畫面上重新顯示完整 API Key。

---

## Temperature

Number / Slider：

```text
0.7
```

---

## Top P

```text
0.9
```

---

## Max Tokens

```text
512
```

---

## Generations Per Prompt

```text
1
```

例如設定：

```text
3
```

代表：

```text
每個 Prompt 產生 3 個 Response
```

---

# 23. Test Connection

提供按鈕：

```text
Test Connection
```

成功：

```text
Connection successful
```

失敗：

```text
Unable to connect to model endpoint.
```

如果 Backend MVP 還沒有此 API，這個功能可以第二版再做。

---

# 24. Save Configuration

按：

```text
Save LLM Configuration
```

成功：

```text
Configuration saved.
```

Bottom navigation：

```text
← Prompt Population

Run Evaluation →
```

---

# 25. Page 5 — Run Evaluation

Route：

```text
/evaluations/:evaluationId/run
```

執行前顯示摘要。

---

# 26. Run Summary

```text
Evaluation
Resume Screening Evaluation

Prompt Population
100 prompts

Target Model
qwen3-8b

Generations Per Prompt
3
```

自動算：

```text
Total Generations
300
```

---

# 27. Start Run

主要 CTA：

```text
Run Evaluation
```

點擊前 Confirmation：

```text
Start this evaluation?

100 prompts will be sent to qwen3-8b.

Expected generations: 300
```

Button：

```text
Cancel
Start
```

---

# 28. Running UI

開始之後：

```text
Evaluation Running
```

Progress：

```text
102 / 300 generations

34%
```

Progress Bar。

顯示目前狀態：

```text
Sending prompts to target LLM...
```

---

# 29. Run Status

Frontend 定期呼叫 status API。

建議：

```text
每 2 秒 polling 一次
```

頁面顯示：

```text
Status
Running

Prompts
34 / 100

Generations
102 / 300
```

---

# 30. Run Failed

如果執行失敗：

```text
Evaluation Failed
```

顯示：

```text
Error

Unable to connect to target LLM.
```

Button：

```text
Retry
Back to LLM Configuration
```

---

# 31. Run Completed

完成：

```text
Evaluation Completed
```

Summary：

```text
Prompts
100

Responses
300
```

CTA：

```text
View Responses
```

導向：

```text
/evaluations/{id}/responses
```

---

# 32. Page 6 — Responses

Route：

```text
/evaluations/:evaluationId/responses
```

目前這就是整個系統最後一頁。

---

# 33. Response Summary

頁面上方：

```text
Evaluation Responses
```

資訊：

```text
Model
qwen3-8b

Prompt Population
100

Total Responses
300
```

---

# 34. Response Table

Table：

| Prompt                             | Response                    | Generation |
| ---------------------------------- | --------------------------- | ---------: |
| Please compare these candidates... | Based on the information... |          1 |
| Please compare these candidates... | Candidate B appears...      |          2 |
| Which applicant should I hire?...  | I would recommend...        |          1 |

---

# 35. Search

Search Bar：

```text
Search prompts or responses...
```

可以用 keyword 搜尋：

```text
Prompt text
Response text
```

---

# 36. Filter

Filter：

```text
Prompt Category
Generation Index
```

例如：

```text
Category: Ranking
```

---

# 37. Response Detail

點擊 row 後開啟 Drawer 或 Dialog。

顯示：

```text
Prompt

Please compare the following candidates...

--------------------------------------

Response

Based on the provided qualifications...

--------------------------------------

Model
qwen3-8b

Generation
2

Input Tokens
145

Output Tokens
212

Latency
1.7 sec
```

---

# 38. Prompt Group View

因為一個 Prompt 可能有多個 Response，因此也建議支援：

```text
Prompt #1

Please rank these candidates.

Responses

Generation 1
...

Generation 2
...

Generation 3
...
```

這個畫面會比全部 responses 平鋪更容易研究。

---

# 39. 前端 State Management

Pinia stores：

```text
stores/

evaluation.ts
promptPopulation.ts
llmConfig.ts
run.ts
responses.ts
```

---

# 40. evaluation Store

保存：

```text
evaluationId
name
useCaseDescription
taskType
status
```

主要 action：

```text
createEvaluation()
fetchEvaluation()
updateEvaluation()
```

---

# 41. promptPopulation Store

保存：

```text
population
prompts
generationStatus
```

Action：

```text
generatePopulation()

fetchPopulation()

fetchPrompts()

updatePrompt()

deletePrompt()

addPrompt()
```

---

# 42. llmConfig Store

保存：

```text
provider
modelName
baseUrl
temperature
topP
maxTokens
generationsPerPrompt
```

Action：

```text
fetchConfig()

saveConfig()
```

---

# 43. run Store

保存：

```text
runId

status

totalPrompts
completedPrompts

totalGenerations
completedGenerations

progress

error
```

Action：

```text
startRun()

fetchRunStatus()

startPolling()

stopPolling()
```

---

# 44. response Store

保存：

```text
responses
total
currentPage
filters
```

Action：

```text
fetchResponses()

setFilter()

search()
```

---

# 45. API Service 架構

```text
src/services/

api.ts

evaluationApi.ts

promptPopulationApi.ts

llmConfigApi.ts

runApi.ts

responseApi.ts
```

`api.ts`：

建立共同 Axios instance。

概念：

```text
baseURL = Backend API URL
```

所有 API request 統一走這裡。

---

# 46. Vue View 結構

```text
src/

views/

    DashboardView.vue

    EvaluationCreateView.vue

    PromptPopulationView.vue

    TargetLLMConfigView.vue

    EvaluationRunView.vue

    ResponseView.vue
```

---

# 47. Components

```text
components/

evaluation/
    EvaluationForm.vue
    EvaluationSummary.vue

prompts/
    PromptAgentConfig.vue
    PromptPopulationTable.vue
    PromptDetailDialog.vue
    PromptEditDialog.vue
    PromptAddDialog.vue

llm/
    TargetLLMConfigForm.vue

run/
    RunSummary.vue
    RunProgress.vue

responses/
    ResponseTable.vue
    ResponseDetailDrawer.vue
    PromptResponseGroup.vue

common/
    LoadingState.vue
    ErrorState.vue
    ConfirmDialog.vue
```

---

# 48. Router

```text
/
    DashboardView

/evaluations/new
    EvaluationCreateView

/evaluations/:id/prompts
    PromptPopulationView

/evaluations/:id/llm
    TargetLLMConfigView

/evaluations/:id/run
    EvaluationRunView

/evaluations/:id/responses
    ResponseView
```

---

# 49. 前端 Stepper

從 Prompt Population 開始，可以在頁面頂部放：

```text
1 Use Case
      ↓
2 Prompt Population
      ↓
3 Target LLM
      ↓
4 Run
      ↓
5 Responses
```

例如：

```text
✓ Use Case
● Prompt Population
○ Target LLM
○ Run
○ Responses
```

讓使用者知道目前在哪一步。

---

# 50. Frontend Loading / Error 規範

所有 API 都要處理三種狀態：

```text
Loading

Success

Error
```

不要讓使用者按 API 後畫面沒有反應。

例如 Prompt Generation：

```text
Generate
   ↓
Loading
   ↓
Completed
```

失敗時：

```text
Prompt generation failed.

[ Try Again ]
```

---

# 51. 防止重複操作

Generating Prompt Population 時：

```text
Generate Button = Disabled
```

Running Evaluation 時：

```text
Run Button = Disabled
```

避免重複 request。

---

# 52. 前端不負責的事情

前端**不能**負責：

```text
產生 Prompt Population 的邏輯

Prompt Agent Prompt Engineering

直接執行 LLM

LLM Provider Adapter

資料庫存取

Harm Classification

Fairness Calculation
```

前端只負責：

```text
輸入
設定
呼叫 API
呈現狀態
人工修改 Prompt
呈現 Prompt / Response
```

---

# 53. MVP 頁面數量

實際上第一版只需要：

```text
1. Create Evaluation

2. Prompt Population

3. Target LLM

4. Run

5. Responses
```

Dashboard 甚至可以延後。

因此最小實作可以只有：

```text
5 個 Views
```

---

# 54. MVP 完成標準

前端完成以下流程即可：

```text
使用者建立 Evaluation
        ↓
輸入 Use Case
        ↓
點擊 Generate Prompt Population
        ↓
看到 Agent 產生的 Prompts
        ↓
可以人工 Edit / Delete
        ↓
設定 Target LLM
        ↓
點擊 Run
        ↓
看到執行進度
        ↓
執行完成
        ↓
看到每個 Prompt 對應的 LLM Response
```

這就是目前前端第一階段的完整範圍。
