import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Lock, Users } from 'lucide-react'
import type { ActiveVote } from './types'

interface Props {
	vote: ActiveVote
	myId: string
	/** Needed to say who voted for what in an open vote */
	players?: Array<{ userId: string; name: string }>
	/** This viewer's own choice, sent privately for anonymous votes */
	myVote?: { voteId: string; optionIds: string[] } | null
	isGM: boolean
	onCast: (optionIds: string[]) => void
	onClose: () => void
	onClear: () => void
}

export const VotingPanel = ({ vote, myId, myVote, players = [], isGM, onCast, onClose, onClear }: Props) => {
	const { t } = useTranslation()
	const [selected, setSelected] = useState<string[]>([])

	const totalVotes = vote.options.reduce((s, o) => s + o.voterIds.length, 0)
	// An anonymous vote carries blanks instead of voters, so our own choice
	// comes back addressed to us rather than read out of the tally.
	const myVotes    = vote.isAnonymous
		? (myVote?.voteId === vote.id ? myVote.optionIds : [])
		: vote.options.filter(o => o.voterIds.includes(myId)).map(o => o.id)
	const hasVoted   = myVotes.length > 0

	const toggle = (id: string) => {
		if (vote.closed || hasVoted) return
		if (vote.multipleChoice) {
			setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
		} else {
			setSelected([id])
		}
	}

	const handleVote = () => {
		if (!selected.length) return
		onCast(selected)
		setSelected([])
	}

	const pct = (n: number) => totalVotes === 0 ? 0 : Math.round((n / totalVotes) * 100)
	const activeVoteIds = hasVoted ? myVotes : selected

	return (
		<div
			className='rounded-[14px] p-[14px] flex flex-col gap-[10px]'
			style={{ background: 'rgba(15,17,32,0.9)', border: '1px solid rgba(68,170,255,0.15)' }}
		>
			{/* Header */}
			<div className='flex items-start gap-[8px]'>
				<div className='flex-1'>
					<div className='flex items-center gap-[6px] mb-[4px]'>
						{vote.isAnonymous && <Lock size={11} style={{ color: 'rgba(140,170,255,0.75)' }} />}
						{vote.multipleChoice && <span className='text-[11px]' style={{ color: 'rgba(140,170,255,0.75)' }}>{t('room.vote.multiple_label')}</span>}
						{vote.closed && (
							<span className='text-[11px] px-[6px] py-[1px] rounded-[4px]'
								style={{ background: 'rgba(255,95,160,0.12)', color: 'rgba(255,95,160,0.88)', border: '1px solid rgba(255,95,160,0.28)' }}>
								{t('room.vote.closed')}
							</span>
						)}
					</div>
					<p className='text-[13px] font-[600] break-words' style={{ color: 'rgba(220,230,255,0.9)' }}>{vote.question}</p>
				</div>
				{isGM && (
					<div className='flex gap-[4px]'>
						{!vote.closed && (
							<button onClick={onClose}
								className='text-[11px] px-[7px] py-[4px] rounded-[5px] cursor-pointer transition-all'
								style={{ background: 'rgba(200,168,48,0.1)', border: '1px solid rgba(200,168,48,0.3)', color: 'rgba(200,168,48,0.95)' }}>
								{t('room.vote.close_btn')}
							</button>
						)}
						<button onClick={onClear}
							className='text-[11px] px-[7px] py-[4px] rounded-[5px] cursor-pointer transition-all'
							style={{ background: 'rgba(255,95,160,0.08)', border: '1px solid rgba(255,95,160,0.28)', color: 'rgba(255,95,160,0.9)' }}>
							✕
						</button>
					</div>
				)}
			</div>

			{/* Options */}
			<div className='flex flex-col gap-[6px]'>
				{vote.options.map(opt => {
					const p    = pct(opt.voterIds.length)
					const mine = activeVoteIds.includes(opt.id)
					// The gamemaster runs the vote and rarely takes part in it, so
					// waiting for them to cast one left them staring at a blank tally.
					const showResults = hasVoted || vote.closed || isGM
					return (
						<button
							key={opt.id}
							onClick={() => toggle(opt.id)}
							disabled={vote.closed || hasVoted}
							className='relative w-full text-left rounded-[8px] px-[10px] py-[7px] transition-all overflow-hidden'
							style={{
								border: mine ? '1px solid rgba(15,255,200,0.45)' : '1px solid rgba(68,170,255,0.15)',
								background: mine ? 'rgba(15,255,200,0.06)' : 'rgba(15,17,32,0.5)',
								cursor: vote.closed || hasVoted ? 'default' : 'pointer',
							}}
						>
							{showResults && (
								<div
									className='absolute left-0 top-0 h-full rounded-[8px] transition-all duration-[400ms]'
									style={{ width: `${p}%`, background: mine ? 'rgba(15,255,200,0.08)' : 'rgba(68,170,255,0.06)' }}
								/>
							)}
							<div className='relative flex items-center justify-between gap-[6px]'>
								<span className='text-[13px] break-words min-w-0' style={{ color: mine ? '#0fffc8' : 'rgba(210,225,255,0.9)' }}>
									{opt.text}
								</span>
								{showResults && (
									<span className='text-[12px] font-[600] flex-shrink-0'
										style={{ color: mine ? '#0fffc8' : 'rgba(140,170,255,0.78)' }}>
										{p}%
									</span>
								)}
								{mine && !showResults && <CheckCircle2 size={12} style={{ color: '#0fffc8', flexShrink: 0 }} />}
							</div>

							{/* An open vote is open: it should say who chose what.
							    An anonymous one carries blanks and shows nothing. */}
							{showResults && !vote.isAnonymous && opt.voterIds.length > 0 && (
								<div className='relative mt-[4px] text-[11px] leading-[1.4]' style={{ color: 'rgba(150,175,235,0.7)' }}>
									{opt.voterIds
										.map(id => players.find(p => p.userId === id)?.name ?? '')
										.filter(Boolean)
										.join(', ')}
								</div>
							)}
						</button>
					)
				})}
			</div>

			{/* Footer */}
			<div className='flex items-center justify-between gap-[8px]'>
				<div className='flex items-center gap-[4px] text-[12px]' style={{ color: 'rgba(140,170,255,0.72)' }}>
					<Users size={11} />
					<span>{t('room.vote.total', { count: totalVotes })}</span>
				</div>
				{!hasVoted && !vote.closed && selected.length > 0 && (
					<button onClick={handleVote}
						className='text-[12px] px-[12px] py-[6px] rounded-[7px] font-[600] cursor-pointer transition-all'
						style={{ background: 'rgba(15,255,200,0.12)', border: '1px solid rgba(15,255,200,0.3)', color: '#0fffc8' }}>
						{t('room.vote.cast')}
					</button>
				)}
			</div>
		</div>
	)
}
