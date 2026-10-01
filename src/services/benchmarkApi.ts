import api from './api'

export interface DialogSumValidationRequest {
  domain: 'gender'
  pairCount: number
  seed: number
}

export interface DialogSumValidationResponse {
  evaluationId: number
  runId: number
  pairCount: number
  promptCount: number
  status: string
}

export const benchmarkApi = {
  runDialogSum(payload: DialogSumValidationRequest) {
    return api.post<DialogSumValidationResponse>('/benchmark/dialogsum', payload).then(response => response.data)
  },
}
