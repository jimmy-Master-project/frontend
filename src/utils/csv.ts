/** CSV helpers for client-side exports (UTF-8 with BOM so Excel opens Chinese text correctly). */

export type CsvValue = string | number | boolean | null | undefined

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(header: string[], rows: CsvValue[][]): string {
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
}

export function downloadCsv(fileName: string, csv: string) {
  downloadBlob(fileName, new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
}

export function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
