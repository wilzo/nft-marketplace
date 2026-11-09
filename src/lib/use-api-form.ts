import { useState } from 'react'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError, toApiError } from './api-error'

/**
 * Aplica um erro da API a um formulário react-hook-form:
 * erros por campo vão para os campos (com foco no primeiro); o restante vira mensagem geral.
 * Retorna a mensagem geral (ou null).
 */
export function applyApiError<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly Path<T>[]) {
  const apiError = error instanceof ApiError ? error : toApiError(error)
  let first = true
  let handled = false
  for (const [name, messages] of Object.entries(apiError.fieldErrors)) {
    if (!fields.includes(name as Path<T>)) continue
    setError(name as Path<T>, { type: 'server', message: messages[0] }, { shouldFocus: first })
    first = false
    handled = true
  }
  return handled && apiError.code === 'VALIDATION_ERROR' ? null : apiError.message
}

/** Estado da mensagem geral do formulário. */
export function useFormAlert() {
  return useState<string | null>(null)
}
