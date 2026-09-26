import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * The ✕ every room dialog has, big enough for a thumb. A dialog that could
 * only be closed by a faint word at its bottom left a player stuck on a phone.
 */
export const ModalClose = ({ onClose, className = 'absolute top-[10px] right-[10px]' }: { onClose: () => void; className?: string }) => {
	const { t } = useTranslation()
	return (
		<button type='button' onClick={onClose} aria-label={t('room.close')} title={t('room.close')}
			className={`${className} w-[34px] h-[34px] rounded-full flex items-center justify-center cursor-pointer transition-all hover:brightness-150 flex-shrink-0`}
			style={{ background: 'rgba(68,170,255,0.08)', border: '1px solid rgba(68,170,255,0.2)', color: 'rgba(170,190,240,0.85)' }}>
			<X size={17} strokeWidth={2} />
		</button>
	)
}
