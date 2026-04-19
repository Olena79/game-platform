import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface InputFieldProps {
	icon?: React.ReactNode
	type?: string
	placeholder: string
	value: string
	onChange: (v: string) => void
	error?: string
	prefix?: string
	maxLength?: number
	onlyDigits?: boolean
	autoComplete?: string
}

export const InputField: React.FC<InputFieldProps> = ({
	icon,
	type = 'text',
	placeholder,
	value,
	onChange,
	error,
	prefix,
	maxLength,
	onlyDigits,
	autoComplete,
}) => {
	const [showPass, setShowPass] = useState(false)
	const isPassword = type === 'password'
	const inputType = isPassword ? (showPass ? 'text' : 'password') : type

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		let v = e.target.value
		if (onlyDigits) v = v.replace(/\D/g, '')
		if (maxLength !== undefined) v = v.slice(0, maxLength)
		onChange(v)
	}

	return (
		<div className='flex flex-col gap-[4px]'>
			<div className={`relative flex items-center bg-[#060e24] rounded-[12px] border transition-all ${
				error
					? 'border-[rgba(255,90,160,0.55)] shadow-[0_0_10px_rgba(255,90,160,0.07)]'
					: 'border-[rgba(68,170,255,0.2)] focus-within:border-[rgba(68,170,255,0.6)] focus-within:shadow-[0_0_14px_rgba(68,170,255,0.12)]'
			}`}>
				{icon && (
					<span className='absolute left-[14px] text-[rgba(68,170,255,0.5)] pointer-events-none'>
						{icon}
					</span>
				)}
				{prefix && (
					<span className={`${icon ? 'pl-[40px]' : 'pl-[14px]'} pr-[4px] py-[12px] text-[14px] text-[rgba(100,140,220,0.55)] select-none whitespace-nowrap`}>
						{prefix}
					</span>
				)}
				<input
					type={inputType}
					placeholder={placeholder}
					value={value}
					onChange={handleChange}
					autoComplete={autoComplete}
					className={`flex-1 bg-transparent text-[rgba(180,200,255,0.85)] placeholder-[rgba(100,140,220,0.35)] py-[12px] text-[14px] focus:outline-none ${
						isPassword ? 'pr-[40px]' : 'pr-[14px]'
					} ${
						prefix ? 'pl-0' : icon ? 'pl-[40px]' : 'pl-[14px]'
					}`}
				/>
				{isPassword && (
					<button
						type='button'
						tabIndex={-1}
						onClick={() => setShowPass(p => !p)}
						className='absolute right-[12px] text-[rgba(100,140,220,0.45)] hover:text-[rgba(68,170,255,0.8)] transition-colors cursor-pointer'
					>
						{showPass
							? <EyeOff size={15} strokeWidth={1.8} />
							: <Eye size={15} strokeWidth={1.8} />
						}
					</button>
				)}
			</div>
			{error && (
				<span className='text-[12px] text-[rgba(255,90,160,0.85)] pl-[2px] leading-[1.4]'>
					{error}
				</span>
			)}
		</div>
	)
}
