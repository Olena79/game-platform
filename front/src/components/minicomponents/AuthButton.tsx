import React from 'react'

interface AuthButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	loading?: boolean
}

export const AuthButton: React.FC<AuthButtonProps> = ({ children, loading, disabled, ...props }) => (
	<button
		{...props}
		disabled={loading || disabled}
		className='auth-gradient-btn w-full bg-gradient-to-br from-[#2255dd] to-[#7744cc] text-white py-[13px] rounded-[12px] text-[14px] font-[600] hover:shadow-[0_0_30px_rgba(100,80,255,0.45)] hover:-translate-y-[1px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0'
	>
		{loading ? '...' : children}
	</button>
)
