import api from './api'

export interface DialogSumValidationRequest {
  domain: 'gender'
  pair_count: number
  seed: number
}

export interface DialogSumValidationResponse {
  evaluation_id: number
  run_id: number
  pair_count: number
  prompt_count: number
  status: string
}

export const benchmarkApi = {
  runDialogSum(payload: DialogSumValidationRequest) {
    return api.post<DialogSumValidationResponse>('/benchmark/dialogsum', payload).then(response => response.data)
  },
}
