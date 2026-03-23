import React, {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
} from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

export type MediaType = 'audio' | 'video';

export interface MediaTrack {
    uri: string;
    type: MediaType;
    title: string;
    subtitle?: string;
}

interface MediaPlayerState {
    track: MediaTrack | null;
    isPlaying: boolean;
    isLoaded: boolean;
    positionMillis: number;
    durationMillis: number;
    isBuffering: boolean;
    /** True while user is viewing the in-screen audio player — hides mini bar */
    isAudioScreenActive: boolean;
}

interface MediaPlayerContextValue extends MediaPlayerState {
    soundRef: React.MutableRefObject<Audio.Sound | null>;
    playTrack: (track: MediaTrack) => Promise<void>;
    pausePlayback: () => Promise<void>;
    resumePlayback: () => Promise<void>;
    stopPlayback: () => Promise<void>;
    seekTo: (millis: number) => Promise<void>;
    togglePlay: () => Promise<void>;
    onStatusUpdate: (status: AVPlaybackStatus) => void;
    handleScreenBlur: () => void;
    handleScreenFocus: () => void;
    hasActiveAudio: boolean;
    clearTrack: () => void;
    /** Call when user navigates to the audio tab (hides mini bar) */
    setAudioScreenActive: (active: boolean) => void;
}

const MediaPlayerContext = createContext<MediaPlayerContextValue | null>(null);

export function MediaPlayerProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<MediaPlayerState>({
        track: null,
        isPlaying: false,
        isLoaded: false,
        positionMillis: 0,
        durationMillis: 0,
        isBuffering: false,
        isAudioScreenActive: false,
    });

    const soundRef = useRef<Audio.Sound | null>(null);
    const wasPlayingBeforeBlur = useRef(false);

    const setAudioScreenActive = useCallback((active: boolean) => {
        setState(s => ({ ...s, isAudioScreenActive: active }));
    }, []);

    const onStatusUpdate = useCallback((status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
            setState(s => ({ ...s, isLoaded: false, isBuffering: false }));
            return;
        }
        setState(s => ({
            ...s,
            isLoaded: true,
            isPlaying: status.isPlaying,
            positionMillis: status.positionMillis,
            durationMillis: status.durationMillis ?? 0,
            isBuffering: status.isBuffering,
        }));
    }, []);

    const stopAndUnload = useCallback(async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
            } catch (_) {}
            soundRef.current = null;
        }
    }, []);

    const playTrack = useCallback(async (track: MediaTrack) => {
        if (
            state.track?.uri === track.uri &&
            soundRef.current &&
            state.isLoaded
        ) {
            await soundRef.current.playAsync();
            return;
        }

        await stopAndUnload();

        setState(s => ({
            ...s,
            track,
            isLoaded: false,
            isPlaying: false,
            positionMillis: 0,
            durationMillis: 0,
            isBuffering: true,
        }));

        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                staysActiveInBackground: true,
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            const { sound } = await Audio.Sound.createAsync(
                { uri: track.uri },
                { shouldPlay: true, isLooping: false },
                (status) => onStatusUpdate(status),
            );
            soundRef.current = sound;
        } catch (e) {
            console.error('[MediaPlayer] Failed to create sound:', e);
            setState(s => ({ ...s, isBuffering: false }));
        }
    }, [state.track, state.isLoaded, stopAndUnload, onStatusUpdate]);

    const pausePlayback = useCallback(async () => {
        if (soundRef.current) {
            try { await soundRef.current.pauseAsync(); } catch (_) {}
        }
    }, []);

    const resumePlayback = useCallback(async () => {
        if (soundRef.current) {
            try { await soundRef.current.playAsync(); } catch (_) {}
        }
    }, []);

    const stopPlayback = useCallback(async () => {
        await stopAndUnload();
        setState(s => ({
            ...s,
            track: null,
            isPlaying: false,
            isLoaded: false,
            positionMillis: 0,
            durationMillis: 0,
            isBuffering: false,
        }));
    }, [stopAndUnload]);

    const clearTrack = useCallback(async () => {
        await stopAndUnload();
        setState({
            track: null,
            isPlaying: false,
            isLoaded: false,
            positionMillis: 0,
            durationMillis: 0,
            isBuffering: false,
            isAudioScreenActive: false,
        });
    }, [stopAndUnload]);

    const seekTo = useCallback(async (millis: number) => {
        if (soundRef.current && state.isLoaded) {
            try { await soundRef.current.setPositionAsync(millis); } catch (_) {}
        }
    }, [state.isLoaded]);

    const togglePlay = useCallback(async () => {
        if (state.isPlaying) { await pausePlayback(); }
        else { await resumePlayback(); }
    }, [state.isPlaying, pausePlayback, resumePlayback]);

    const handleScreenBlur = useCallback(() => {
        if (state.isPlaying) {
            wasPlayingBeforeBlur.current = true;
            pausePlayback();
        } else {
            wasPlayingBeforeBlur.current = false;
        }
    }, [state.isPlaying, pausePlayback]);

    const handleScreenFocus = useCallback(() => {
        if (wasPlayingBeforeBlur.current) {
            wasPlayingBeforeBlur.current = false;
            resumePlayback();
        }
    }, [resumePlayback]);

    const hasActiveAudio =
        state.track?.type === 'audio' && (state.isPlaying || state.isLoaded);

    return (
        <MediaPlayerContext.Provider
            value={{
                ...state,
                soundRef,
                playTrack,
                pausePlayback,
                resumePlayback,
                stopPlayback,
                seekTo,
                togglePlay,
                onStatusUpdate,
                handleScreenBlur,
                handleScreenFocus,
                hasActiveAudio,
                clearTrack,
                setAudioScreenActive,
            }}
        >
            {children}
        </MediaPlayerContext.Provider>
    );
}

export function useMediaPlayer() {
    const ctx = useContext(MediaPlayerContext);
    if (!ctx) throw new Error('useMediaPlayer must be used within MediaPlayerProvider');
    return ctx;
}
