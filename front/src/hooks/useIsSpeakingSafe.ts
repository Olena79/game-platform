import { useState, useEffect } from 'react'
import { Participant, ParticipantEvent } from 'livekit-client'

export function useIsSpeakingSafe(participant: Participant | undefined): boolean {
	const [speaking, setSpeaking] = useState(false)
	useEffect(() => {
		if (!participant) { setSpeaking(false); return }
		setSpeaking(participant.isSpeaking)
		const handler = (s: boolean) => setSpeaking(s)
		participant.on(ParticipantEvent.IsSpeakingChanged, handler)
		return () => { participant.off(ParticipantEvent.IsSpeakingChanged, handler) }
	}, [participant])
	return speaking
}
