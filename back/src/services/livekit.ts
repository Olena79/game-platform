import { EgressClient, RoomServiceClient, TrackSource } from 'livekit-server-sdk'
import logger from '../config/logger'

export const LIVEKIT_API_KEY    = process.env.LIVEKIT_API_KEY
export const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET
export const LIVEKIT_URL        = process.env.LIVEKIT_URL

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
	throw new Error('FATAL: LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL must be set.')
}

/** The server API speaks HTTPS on the same host the browsers reach over WSS. */
const LIVEKIT_HTTP_URL = LIVEKIT_URL.replace(/^ws(s?):\/\//, 'http$1://')

export const roomService = new RoomServiceClient(LIVEKIT_HTTP_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
export const egressClient = new EgressClient(LIVEKIT_HTTP_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)

/**
 * Only the server decides what a room is called, and it is named after the
 * game's id — never its entry code. A LiveKit token carries the room name in
 * plain sight, so a room named after the code would hand the entry code to
 * every spectator who looked inside their token.
 */
export function roomNameFor(gameId: string, breakoutId?: string): string {
	return breakoutId ? `mindflow-${gameId}-${breakoutId}` : `mindflow-${gameId}`
}

/**
 * Mutes microphones on the media server, not just by asking the browser.
 *
 * The room also sends the old "please mute" signal so the interface updates,
 * but a modified client could simply ignore that. People can still unmute
 * themselves afterwards — this is a gamemaster's "quiet please", not a gag.
 */
export async function muteMicrophones(roomName: string, shouldMute: (identity: string) => boolean): Promise<void> {
	let participants
	try {
		participants = await roomService.listParticipants(roomName)
	} catch (err) {
		// No such room yet (nobody connected) — nothing to mute
		logger.warn('[livekit] listParticipants failed', { roomName, error: err instanceof Error ? err.message : String(err) })
		return
	}
	const targets = participants.filter(p => shouldMute(p.identity))
	await Promise.all(targets.flatMap(p =>
		p.tracks
			.filter(t => t.source === TrackSource.MICROPHONE && !t.muted)
			.map(t => roomService.mutePublishedTrack(roomName, p.identity, t.sid, true).catch(err => {
				logger.warn('[livekit] mute failed', { roomName, error: err instanceof Error ? err.message : String(err) })
			})),
	))
}
