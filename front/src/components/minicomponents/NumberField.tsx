import React from 'react'

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'>

/**
 * A number the person can clear.
 *
 * A plain number input holds a number, so erasing the last digit turned it
 * into 0 — and the 0 then had to be erased by hand before typing ("01").
 * This field may be empty; `value` is null then, and the form decides
 * whether that is allowed (the button stays disabled until it is not).
 * Digits only, with the number keyboard on phones.
 */
export function NumberField({ value, onChange, max, ...rest }: InputProps & {
	value: number | null
	onChange: (value: number | null) => void
	max?: number
}) {
	return (
		<input
			{...rest}
			type='text'
			inputMode='numeric'
			pattern='[0-9]*'
			autoComplete='off'
			value={value === null ? '' : String(value)}
			onChange={e => {
				const digits = e.target.value.replace(/\D/g, '').slice(0, 7)
				if (digits === '') { onChange(null); return }
				const n = Number(digits)
				onChange(max !== undefined ? Math.min(max, n) : n)
			}}
		/>
	)
}
