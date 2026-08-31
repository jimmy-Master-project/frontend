import api from './api'

export interface BoldValidationRequest {
  domain: 'gender'
  pair_count: number
  seed: number
}

export interface BoldValidationResponse {
  evaluation_id: number
  run_id: number
  pair_count: number
  prompt_count: number
  status: string
}

export const benchmarkApi = {
  runBold(payload: BoldValidationRequest) {
    return api.post<BoldValidationResponse>('/benchmark/bold', payload).then(response => response.data)
  },
}
