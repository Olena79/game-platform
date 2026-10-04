import { useEffect, useRef, useState } from 'react'
import { sfx } from '../utils/sounds'
import type { ChatMessage } from '../components/gameroom/types'

export type ChatTab = 'chat' | 'spectatorChat'
export type ChatUnread = Record<ChatTab, number>

interface Args {
	/** null until the room state has arrived */
	messages: ChatMessage[] | null
	activeVoteId: string | null
	spectatorVoteId: string | null
	myId: string
	isGM: boolean
	isSpectator: boolean
	/** The chat tab in front of this person right now, or null when the chat is not on screen */
	viewing: string | null
}

/**
 * What arrived in the players' or the spectators' chat while that tab was
 * not in front of this person: a message from someone else or a new vote.
 * Each is counted on its tab (the tab clears when opened) and rings softly.
 *
 * Sounds: a message out of sight rings for everyone; one in sight rings
 * only for a player in the players' chat (as before). A new players' vote
 * rings for players and a new spectators' vote for spectators — the people
 * who can vote in it; the gamemaster who started it hears nothing.
 */
export function useChatUnread({ messages, activeVoteId, spectatorVoteId, myId, isGM, isSpectator, viewing }: Args): ChatUnread {
	const [unread, setUnread] = useState<ChatUnread>({ chat: 0, spectatorChat: 0 })
	const lastMsgId = useRef<string | null | undefined>(undefined)
	const votes = useRef<{ chat: string | null; spectatorChat: string | null } | null>(null)
	const viewingRef = useRef(viewing)
	viewingRef.current = viewing

	const bump = (tab: ChatTab, n = 1) => setUnread(u => ({ ...u, [tab]: u[tab] + n }))

	// New messages: the ones after the last one we handled. If that one is
	// gone (history reloaded, another breakout), start again from here.
	useEffect(() => {
		if (!messages) return
		const last = messages.length ? messages[messages.length - 1].id : null
		const prev = lastMsgId.current
		lastMsgId.current = last
		if (prev === undefined) return            // first look: history is not news
		const from = prev === null ? 0 : messages.findIndex(m => m.id === prev) + 1
		if (prev !== null && from === 0) return   // not found: a different list
		let ring = false
		for (const m of messages.slice(from)) {
			if (m.userId === myId) continue
			const tab: ChatTab = m.spectatorChat ? 'spectatorChat' : 'chat'
			const inSight = viewingRef.current === tab
			if (!inSight) bump(tab)
			if (!inSight || (tab === 'chat' && !isSpectator)) ring = true
		}
		if (ring) sfx.chatMsg()
	}, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

	// New votes
	useEffect(() => {
		const prev = votes.current
		votes.current = { chat: activeVoteId, spectatorChat: spectatorVoteId }
		if (!prev || isGM) return
		let ring = false
		// Spectators never see the players' vote
		if (activeVoteId && activeVoteId !== prev.chat && !isSpectator) {
			if (viewingRef.current !== 'chat') bump('chat')
			ring = true
		}
		if (spectatorVoteId && spectatorVoteId !== prev.spectatorChat) {
			if (viewingRef.current !== 'spectatorChat') bump('spectatorChat')
			if (isSpectator) ring = true
		}
		if (ring) sfx.vote()
	}, [activeVoteId, spectatorVoteId]) // eslint-disable-line react-hooks/exhaustive-deps

	// Whatever is in front of the person is read
	useEffect(() => {
		if (viewing === 'chat' || viewing === 'spectatorChat') {
			setUnread(u => (u[viewing] ? { ...u, [viewing]: 0 } : u))
		}
	}, [viewing, unread.chat, unread.spectatorChat])

	return unread
}
