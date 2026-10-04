import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import { VotingPanel } from './VotingPanel'

const vote = {
	id: 'v1', question: 'Хто винен?', isAnonymous: false, multipleChoice: false, closed: false, spectatorOnly: true,
	options: [{ id: 'o0', text: 'Кіт', voterIds: [] }, { id: 'o1', text: 'Пес', voterIds: [] }],
}

describe("the spectators' vote", () => {
	it('cannot be cast by someone who only watches it (the gamemaster, a player)', () => {
		const onCast = vi.fn()
		const { getByText, queryByText } = render(
			<VotingPanel vote={vote} myId='gm' isGM canVote={false} onCast={onCast} onClose={() => {}} onClear={() => {}} />)
		fireEvent.click(getByText('Кіт'))
		expect(queryByText('room.vote.cast')).toBeNull()
		expect(getByText('Кіт').closest('button')!.disabled).toBe(true)
		expect(onCast).not.toHaveBeenCalled()
	})

	it('is cast by a spectator', () => {
		const onCast = vi.fn()
		const { getByText } = render(
			<VotingPanel vote={vote} myId='s1' isGM={false} onCast={onCast} onClose={() => {}} onClear={() => {}} />)
		fireEvent.click(getByText('Пес'))
		fireEvent.click(getByText('room.vote.cast'))
		expect(onCast).toHaveBeenCalledWith(['o1'])
	})
})
