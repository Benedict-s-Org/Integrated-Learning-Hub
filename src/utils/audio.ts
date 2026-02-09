const SUCCESS_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3';

export const playSuccessSound = () => {
    try {
        const audio = new Audio(SUCCESS_SOUND_URL);
        audio.volume = 0.5;
        audio.play().catch(err => {
            console.warn('Audio playback failed:', err);
        });
    } catch (err) {
        console.error('Failed to initialize audio:', err);
    }
};
