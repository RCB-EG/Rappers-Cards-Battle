
/**
 * Plays a sound effect from a given URL.
 * @param soundUrl The URL of the sound file to play.
 * @param volume The volume level (0-100).
 */
export const playSound = (soundUrl: string, volume: number): void => {
  // Guard against running in a non-browser environment or if no URL is provided
  if (typeof window === 'undefined' || !soundUrl) return;

  try {
    const audio = new Audio(soundUrl);
    audio.volume = Math.max(0, Math.min(1, volume / 100)); // Ensure volume is between 0.0 and 1.0
    audio.play().catch(e => {
        // Silently catch playback errors, common if user hasn't interacted with document yet
    });
  } catch (error) {
    console.error("Could not create or play sound:", error);
  }
};
