import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: 'primary' | 'outline' | 'ghost'
	size?: 'sm' | 'md' | 'lg'
}

export const Button: React.FC<ButtonProps> = ({
	children,
	variant = 'primary',
	size = 'md',
	className,
	...props
}) => {
	const baseStyles =
		'inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50'

	const variants = {
		primary:
			'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20',
		outline: 'border border-gray-700 hover:bg-gray-800 text-gray-200',
		ghost: 'hover:bg-gray-800 text-gray-400 hover:text-white',
	}

	const sizes = {
		sm: 'px-4 py-1.5 text-xs',
		md: 'px-6 py-2 text-sm',
		lg: 'px-8 py-3 text-base',
	}

	return (
		<button
			className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
			{...props}
		>
			{children}
		</button>
	)
}
