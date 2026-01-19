
import { battleMusicTracks } from "../data/sounds";

/**
 * Plays a sound effect from a given URL.
 * @param soundUrl The URL of the sound file to play.
 * @param volume The volume level (0-100).
 */
export const playSound = (soundUrl: string, volume: number): void => {
  if (typeof window === 'undefined' || !soundUrl) return;

  try {
    const audio = new Audio(soundUrl);
    audio.volume = Math.max(0, Math.min(1, volume / 100));
    audio.play().catch(() => {
        // Silently catch playback errors
    });
  } catch (error) {
    console.error("Could not create or play sound:", error);
  }
};

let battleAudio: HTMLAudioElement | null = null;

/**
 * Plays the main background music.
 * @param volume Volume (0-100)
 * @param enabled Whether music is enabled
 */
export const updateMainMusic = (volume: number, enabled: boolean) => {
    const mainBg = document.getElementById('bg-music') as HTMLAudioElement;
    if (mainBg) {
        mainBg.volume = Math.max(0, Math.min(1, volume / 100));
        
        // Only play if enabled AND battle music is NOT playing
        if (enabled && !battleAudio) {
            if (mainBg.paused) mainBg.play().catch(() => {});
        } else {
            mainBg.pause();
        }
    }
    
    // Also update battle audio volume if it's currently playing
    if (battleAudio) {
        battleAudio.volume = Math.max(0, Math.min(1, volume / 100));
        if (!enabled) battleAudio.pause();
        else if (battleAudio.paused) battleAudio.play().catch(() => {});
    }
};

/**
 * Stops main music and plays a random battle track.
 */
export const playBattleTheme = (volume: number, enabled: boolean) => {
    if (!enabled) return;

    // 1. Pause Main Music
    const mainBg = document.getElementById('bg-music') as HTMLAudioElement;
    if (mainBg) mainBg.pause();

    // 2. Stop existing battle music
    if (battleAudio) {
        battleAudio.pause();
        battleAudio = null;
    }

    // 3. Pick random track
    const randomTrack = battleMusicTracks[Math.floor(Math.random() * battleMusicTracks.length)];
    
    try {
        battleAudio = new Audio(randomTrack);
        battleAudio.volume = Math.max(0, Math.min(1, volume / 100));
        battleAudio.loop = true;
        battleAudio.play().catch(e => console.warn("Battle music blocked", e));
    } catch (e) {
        console.error("Error playing battle music", e);
    }
};

/**
 * Stops battle music and resumes main music.
 */
export const stopBattleTheme = (volume: number, enabled: boolean) => {
    // 1. Stop battle music
    if (battleAudio) {
        battleAudio.pause();
        battleAudio = null;
    }

    // 2. Resume main music
    if (enabled) {
        const mainBg = document.getElementById('bg-music') as HTMLAudioElement;
        if (mainBg) {
            mainBg.volume = Math.max(0, Math.min(1, volume / 100));
            mainBg.play().catch(e => console.warn("Main music resume blocked", e));
        }
    }
};
