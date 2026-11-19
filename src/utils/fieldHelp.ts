/**
 * Help text for every form field, shown by <FieldLabel> when its help icon is
 * clicked: what the field does and why it exists. Kept in one place so the
 * wording stays consistent across forms that share a field.
 */
export const FIELD_HELP = {
  // Create / edit evaluation
  projectName: '這次評估的名稱，只用來在列表、Run history 與匯出檔中辨識，不會送進任何模型。',
  targetDescription:
    '描述受測的 Target LLM：用途、服務範圍、政策與門檻。\n初始 prompt agent 會把它當成「需求文件」（GHL），用來挑選測試技術、展開問題方向；它不會直接交給虛擬人。',
  testDirections:
    '你想測試的方向，一行一個，例如「Test how the bot handles refund requests.」。\n它們是 Self-Instruct 的 seed tasks：初始 prompt agent 會把每一個展開成更具體的問題方向，且每個至少展開一個。還沒規劃前，生成 prompt 會直接用它們當目標。',
  testDirectionsFile:
    '從 .json（字串陣列，或含 objective/task 欄位的物件）或 .xlsx（objective/task/target/description 欄）匯入測試方向，會接在上方手動輸入的方向後面。適合方向很多或已經有整理好的清單時使用。',
  taskType:
    '決定 Target LLM 要做哪一類任務，影響 prompt 的生成方式與之後的公平性指標：\n・Text generation：自由回答，用毒性、刻板印象、反事實差異等指標\n・Classification：二元分類，用 FPR/FNR 等分類公平性指標\n・Recommendation：推薦，用推薦公平性指標',
  language:
    'prompt 與回答的語言，決定 LangFair 指標使用的語言設定。English 最穩定；Auto detect 讓系統自行判斷。',
  classificationLabels:
    '分類任務的兩個類別（負類、正類）與數值。LangFair 計算 FPR、FNR 等指標時需要知道哪一個是「正類」，所以要明確設定。',
  recommendationItems:
    '選填。定義固定的候選項目後，Target LLM 只能從清單中挑選並排序，推薦公平性指標的抽取會更可靠。留空則讓模型自由推薦。',

  // Question directions (initial prompt agent)
  protectedAttributes:
    '要檢查模型是否因這些身分而有差別待遇（HELM 的 fairness / bias）。只影響規劃方向時的測試策略；身分本身之後由虛擬人提供，問題方向一律不含身分詞。',
  knownPolicies:
    '選填。Target LLM 依循的規則與門檻，例如「延誤超過 3 小時可補償」。有門檻時，agent 才能用邊界值分析設計「剛好在門檻邊緣」的情境——這是最容易因身分而判斷不同的地方。',
  riskPriorities:
    '選填。哪些情境出錯代價最大（例如涉及金錢、服務資格）。agent 會把較多問題方向分配給高風險的測試方向。',
  systemPromptExcerpt:
    '選填。Target LLM 的系統 prompt 或 FAQ 片段，作為需求文件的補充，讓 agent 更清楚它實際能回答什麼。',
  userPopulation:
    '選填。Target LLM 的使用者是誰（例如「各年齡層的國際旅客」）。用來描述 HELM 的 who 情境，不是身分屬性。',
  whenStages:
    'HELM 的 when：請求發生在互動的哪個階段。每個問題方向會標上一個階段，覆蓋表以「測試方向 × 階段」計算。預設是航空客服的四個階段；其他領域請改成自己的階段（例如 before applying、after decision）。',
  planningModel:
    '執行初始 prompt agent（規劃問題方向）用的 LLM。留空使用後端 .env 的 PROMPT_AGENT_MODEL_NAME。',
  totalDirections:
    '希望規劃出的問題方向大約總數，agent 依此分配給各測試技術。若少於測試方向數，會自動提高到測試方向數，確保每個測試方向至少一個。',
  planTemperature:
    '規劃模型的隨機程度。越高方向越多樣但可能偏離需求；越低越保守、重複規劃時結果較一致。',

  // Prompt population generator
  promptAgentProvider: '生成 prompt 用的 LLM 服務類型（例如 OpenAI 相容 API）。',
  promptAgentModel: '生成 prompt 用的模型名稱。留空使用後端 .env 的 PROMPT_AGENT_MODEL_NAME。',
  promptCount:
    '每個任務目標（問題方向）要生成幾個 prompt。總數 = 這個數字 × 目標數；開啟性別反事實配對時再乘 2。',
  populationSize:
    '每個任務目標要抽幾位虛擬人，每位虛擬人寫一個 prompt。總數 = 這個數字 × 目標數；開啟性別反事實配對時再乘 2。人數越多統計越穩定，但生成與評估成本越高。',
  promptTemperature:
    '生成 prompt 時的隨機程度。越高措辭越多樣，越低越一致。',
  additionalInstruction:
    '選填。附加給 prompt 生成模型的額外要求，例如語氣、長度、細節程度。會套用到每一個 prompt。',
  systemPrompt:
    '選填。每個 prompt 送出前先送這段 system prompt，用來植入已知偏誤作為正控制組（例如要求對不同性別給不同補償）。留空即一般 run。只適用 API 模型；網頁聊天機器人只接收使用者訊息，不支援。使用的內容會記錄在 run 上。',
  personaSwitch:
    '是否用虛擬人生成 prompt。比較「有／無虛擬人」時，先在 Population history 用「Load settings」載入另一份 population 的設定，只切換這個開關再生成，其他條件保持相同。',
  conditionName:
    '這份 population 代表的實驗條件名稱（例如 G1 No persona），之後在比較表與 run 中顯示，也可在 Population history 修改。',
  personaSource:
    '虛擬人的來源：\n・Random sampling：依下方篩選與 seed 從虛擬人池隨機抽樣，可用 seed 重現\n・Saved persona list：使用先前依條件抽出並存檔的名單，同一份名單可重複用於多個 population\n・Pick personas：只用你勾選的虛擬人，適合測試特殊案例',
  fairnessLabels:
    '要分析公平性的受保護屬性（LangFair 支援性別與種族／族裔）。只決定結果依哪個屬性分組比較；生成 prompt 時虛擬人的完整屬性都會提供給模型。選性別時會自動產生反事實配對。',
  stratify:
    '選擇一個屬性後，抽樣會讓該屬性的各組人數盡量相同（分層抽樣），避免某一組人數太少使群組比較不可靠。選 None 則單純隨機抽樣。',
  counterfactualPairs:
    '選了性別屬性時自動開啟：每位虛擬人產生一組「原始 / 性別詞互換」的 prompt。兩者只差在性別，用來衡量反事實公平性（同一請求只換身分，回答是否一致）。',
  samplingSeed:
    '控制抽到哪些虛擬人。固定 seed 時同樣設定一定抽到同一批人，實驗可重現；Random 則每次重新抽，實際使用的 seed 會顯示在結果中。',
  personaPool: 'MatrAIx 的虛擬人資料池名稱。通常不需要修改，留預設即可。',
  filterPersonas: '只從符合條件的虛擬人中抽樣，例如限定特定年齡層或職業，用來把評估聚焦在特定族群。',

  // Prompt add / edit
  promptText: '實際送給 Target LLM 的 prompt 全文。修改後會直接影響這筆 prompt 的評估結果。',
  promptCategory: '選填。自訂的分類標籤，方便在表格中辨識與篩選，不影響生成或指標計算。',

  // Target LLM
  targetProvider:
    '受測 Target LLM 的連線方式：OpenAI 相容 API，或本機啟動的航空公司聊天機器人服務（start_services.sh 會一起啟動）。',
  targetModelName: '受測模型的名稱，會用在 API 請求中，也是報表上顯示的模型名稱。',
  baseUrl: 'Target LLM 的 API 端點。留空使用此 provider 的預設網址；自架或代理服務時才需要修改。',
  apiKey: '呼叫 Target LLM 所需的金鑰，只用於這次評估的請求。',
  targetTemperature:
    'Target LLM 回答的隨機程度。偏誤評估通常會在相同 prompt 上取多次樣本，溫度太低時多次回答幾乎相同。對聊天機器人沒有作用。',
  topP: 'Nucleus sampling：只從累積機率前 P 的詞中取樣。通常維持 1，與 Temperature 擇一調整即可。對聊天機器人沒有作用。',
  maxTokens: '每個回答的最大長度（token 數）。太小會截斷回答，影響毒性與刻板印象等指標的判斷。對聊天機器人沒有作用。',
  generationsPerPrompt:
    '每個 prompt 送給 Target LLM 幾次（k）。多次取樣才能估計回答的變異，例如 Expected Maximum Toxicity。試跑用 3～5，正式實驗可用 25。總呼叫數 = prompt 數 × k。',

  // Run
  runPopulation: '這個評估有多組 prompt population（例如不同實驗條件）時，選擇這次要送出的那一組。',
  runName: '這次執行的名稱，顯示在 Run history 中，方便比較不同模型或設定的結果。留空使用模型名稱。',
} as const

export type FieldHelpKey = keyof typeof FIELD_HELP
