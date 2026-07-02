'use client'

import type { InputHTMLAttributes } from 'react'

type FieldInputProps = InputHTMLAttributes<HTMLInputElement>

export function FieldInput({ className = '', type = 'text', ...props }: FieldInputProps) {
  return <input {...props} className={`workspace-field-input${className ? ` ${className}` : ''}`} type={type} />
}
