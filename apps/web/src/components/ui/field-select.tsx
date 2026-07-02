'use client'

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode
} from 'react'

type FieldSelectProps = {
  children: ReactNode
  className?: string
  defaultValue?: string
  disabled?: boolean
  id?: string
  name?: string
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void
  value?: string
  wrapperClassName?: string
}

type FieldSelectOption = {
  disabled: boolean
  label: string
  value: string
}

function toOptionLabel(value: ReactNode): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map((entry) => toOptionLabel(entry)).join('')
  return ''
}

function collectOptions(children: ReactNode): FieldSelectOption[] {
  const options: FieldSelectOption[] = []

  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue
    const nodeType = typeof child.type === 'string' ? child.type : ''

    if (nodeType === 'option') {
      const optionProps = child.props as {
        children?: ReactNode
        disabled?: boolean
        value?: string
      }
      options.push({
        value: optionProps.value ? String(optionProps.value) : '',
        label: toOptionLabel(optionProps.children),
        disabled: Boolean(optionProps.disabled)
      })
      continue
    }

    if (nodeType === 'optgroup') {
      const groupChildren = (child.props as { children?: ReactNode }).children
      options.push(...collectOptions(groupChildren))
    }
  }

  return options
}

export function FieldSelect({
  children,
  className = '',
  defaultValue,
  disabled = false,
  id,
  name,
  onChange,
  value,
  wrapperClassName = ''
}: FieldSelectProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const generatedId = useId()
  const options = useMemo(() => collectOptions(children), [children])
  const controlledValue = value !== undefined ? String(value) : undefined
  const [internalValue, setInternalValue] = useState(() => {
    if (controlledValue !== undefined) return controlledValue
    if (defaultValue !== undefined) return String(defaultValue)
    return options[0]?.value || ''
  })
  const [open, setOpen] = useState(false)
  const selectedValue = controlledValue !== undefined ? controlledValue : internalValue
  const selectedOption = options.find((option) => option.value === selectedValue) || options[0] || null
  const menuId = `${id || generatedId}-menu`

  useEffect(() => {
    if (controlledValue === undefined) return
    setInternalValue(controlledValue)
  }, [controlledValue])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node | null
      if (wrapRef.current && target && !wrapRef.current.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open])

  useEffect(() => {
    if (!disabled) return
    setOpen(false)
  }, [disabled])

  function emitChange(nextValue: string): void {
    if (controlledValue === undefined) {
      setInternalValue(nextValue)
    }
    if (onChange) {
      onChange({
        target: { value: nextValue } as EventTarget & HTMLSelectElement,
        currentTarget: { value: nextValue } as EventTarget & HTMLSelectElement
      } as ChangeEvent<HTMLSelectElement>)
    }
  }

  function selectOption(nextValue: string): void {
    emitChange(nextValue)
    setOpen(false)
  }

  function moveSelection(step: 1 | -1): void {
    const enabled = options.filter((option) => !option.disabled)
    if (enabled.length === 0) return
    const currentIndex = enabled.findIndex((option) => option.value === selectedValue)
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + step + enabled.length) % enabled.length
    emitChange(enabled[nextIndex].value)
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
      } else {
        moveSelection(1)
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        setOpen(true)
      } else {
        moveSelection(-1)
      }
      return
    }

    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        setOpen(false)
      }
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen((current) => !current)
    }
  }

  return (
    <div
      className={`workspace-field-select-wrap${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}${wrapperClassName ? ` ${wrapperClassName}` : ''}`}
      ref={wrapRef}
    >
      {name ? <input name={name} type="hidden" value={selectedOption?.value || ''} /> : null}
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`workspace-field-select${className ? ` ${className}` : ''}`}
        disabled={disabled}
        id={id}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        type="button"
      >
        <span className="workspace-field-select-value">{selectedOption?.label || ''}</span>
      </button>
      {open ? (
        <div className="workspace-field-select-menu" id={menuId} role="listbox">
          {options.map((option) => (
            <button
              aria-selected={option.value === selectedValue}
              className={`workspace-field-select-option${option.value === selectedValue ? ' is-selected' : ''}${option.disabled ? ' is-disabled' : ''}`}
              disabled={option.disabled}
              key={`${option.value}:${option.label}`}
              onClick={() => selectOption(option.value)}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
