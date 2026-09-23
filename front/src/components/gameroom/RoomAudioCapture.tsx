import { useEffect } from 'react'
import { Track } from 'livekit-client'
import { useTracks } from '@livekit/components-react'

/**
 * Feeds the room's voices to the recorder without playing them aloud.
 *
 * The observer window used to play the room through the same speakers the
 * gamemaster was talking into: their own voice came back through their
 * microphone and the two fed each other into a howl. So this window stays
 * silent, and the recording takes its audio straight from the tracks.
 *
 * Each track is still attached to a muted element — browsers only keep an
 * audio pipeline flowing while something consumes it.
 */
export function RoomAudioCapture({ onTracks }: { onTracks: (tracks: MediaStreamTrack[]) => void }) {
	const trackRefs = useTracks([Track.Source.Microphone, Track.Source.ScreenShareAudio], { onlySubscribed: true })

	useEffect(() => {
		const elements: HTMLAudioElement[] = []
		const live: MediaStreamTrack[] = []

		for (const ref of trackRefs) {
			const mediaTrack = ref.publication?.track?.mediaStreamTrack
			if (!mediaTrack || ref.participant.isLocal) continue

			const stream = new MediaStream([mediaTrack])
			const el = new Audio()
			el.srcObject = stream
			el.muted = true          // keeps the pipeline alive, makes no sound
			el.play().catch(() => { /* autoplay policy — the mix still works */ })
			elements.push(el)
			live.push(mediaTrack)
		}

		onTracks(live)

		return () => {
			elements.forEach(el => { el.pause(); el.srcObject = null })
		}
	}, [trackRefs, onTracks])

	return null
}
