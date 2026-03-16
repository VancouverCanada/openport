'use client'

import type { ElementType, ReactNode } from 'react'

type FieldProps<T extends ElementType = 'label'> = {
  as?: T
  children: ReactNode
  className?: string
  description?: ReactNode
  label?: ReactNode
}

export function Field<T extends ElementType = 'label'>({
  as,
  children,
  className = '',
  description,
  label
}: FieldProps<T>) {
  const Component = (as || 'label') as ElementType

  return (
    <Component className={`workspace-editor-field${className ? ` ${className}` : ''}`}>
      {label ? <span>{label}</span> : null}
      {children}
      {description ? <small>{description}</small> : null}
    </Component>
  )
}
