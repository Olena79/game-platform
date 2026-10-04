import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const sounds = vi.hoisted(() => ({ chatMsg: vi.fn(), vote: vi.fn() }))
vi.mock('../utils/sounds', () => ({ sfx: sounds }))

import { useChatUnread } from './useChatUnread'
import type { ChatMessage } from '../components/gameroom/types'

const msg = (id: string, userId: string, spectatorChat = false): ChatMessage =>
	({ id, userId, name: userId, text: 'hi', ts: 0, recipients: [], recipientNames: [], spectatorChat })

type P = Parameters<typeof useChatUnread>[0]
const base: P = { messages: [], activeVoteId: null, spectatorVoteId: null, myId: 'me', isGM: false, isSpectator: false, viewing: 'chat' }

describe('unread in the room chats', () => {
	beforeEach(() => { sounds.chatMsg.mockClear(); sounds.vote.mockClear() })

	it('counts and rings for messages in the tab that is not open; the tab clears when opened', () => {
		const history = [msg('1', 'a')]
		const { result, rerender } = renderHook((p: P) => useChatUnread(p), { initialProps: { ...base, messages: history } })
		expect(result.current).toEqual({ chat: 0, spectatorChat: 0 })   // history is not news
		rerender({ ...base, messages: [...history, msg('2', 's1', true)] })
		rerender({ ...base, messages: [...history, msg('2', 's1', true), msg('3', 's2', true)] })
		expect(result.current).toEqual({ chat: 0, spectatorChat: 2 })
		expect(sounds.chatMsg).toHaveBeenCalledTimes(2)
		rerender({ ...base, messages: [...history, msg('2', 's1', true), msg('3', 's2', true)], viewing: 'spectatorChat' })
		expect(result.current.spectatorChat).toBe(0)
	})

	it('counts everything while the chat is closed, never my own messages', () => {
		const { result, rerender } = renderHook((p: P) => useChatUnread(p), { initialProps: { ...base, viewing: null } })
		rerender({ ...base, viewing: null, messages: [msg('1', 'me'), msg('2', 'a')] })
		expect(result.current).toEqual({ chat: 1, spectatorChat: 0 })
	})

	it("a new spectators' vote: counted on its tab, rings for spectators only, nothing for the gamemaster", () => {
		const spectator = renderHook((p: P) => useChatUnread(p), { initialProps: { ...base, isSpectator: true } })
		act(() => spectator.rerender({ ...base, isSpectator: true, spectatorVoteId: 'v1' }))
		expect(spectator.result.current.spectatorChat).toBe(1)
		expect(sounds.vote).toHaveBeenCalledTimes(1)

		sounds.vote.mockClear()
		const player = renderHook((p: P) => useChatUnread(p), { initialProps: base })
		act(() => player.rerender({ ...base, spectatorVoteId: 'v1' }))
		expect(player.result.current.spectatorChat).toBe(1)
		expect(sounds.vote).not.toHaveBeenCalled()

		const gm = renderHook((p: P) => useChatUnread(p), { initialProps: { ...base, isGM: true } })
		act(() => gm.rerender({ ...base, isGM: true, spectatorVoteId: 'v1', activeVoteId: 'v2' }))
		expect(gm.result.current).toEqual({ chat: 0, spectatorChat: 0 })
	})

	it("a players' vote is not shown to spectators, so it is not counted for them", () => {
		const { result, rerender } = renderHook((p: P) => useChatUnread(p), { initialProps: { ...base, isSpectator: true, viewing: 'spectatorChat' } })
		rerender({ ...base, isSpectator: true, viewing: 'spectatorChat', activeVoteId: 'v1' })
		expect(result.current.chat).toBe(0)
		expect(sounds.vote).not.toHaveBeenCalled()
	})

	it('a reloaded or different list is not news', () => {
		const { result, rerender } = renderHook((p: P) => useChatUnread(p), { initialProps: { ...base, viewing: null, messages: [msg('1', 'a')] } })
		rerender({ ...base, viewing: null, messages: [msg('x', 'b'), msg('y', 'c')] })
		expect(result.current).toEqual({ chat: 0, spectatorChat: 0 })
	})
})
