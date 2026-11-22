/** A soft paper rustle, made on the spot so there's no sound file to download. */
let audio: AudioContext | null = null;

export function playPageTurn() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const length = 0.5;
    const rate = audio.sampleRate;
    const buffer = audio.createBuffer(1, rate * length, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      // Swells as the page lifts, with a small settle as it lands.
      const swell = Math.sin(Math.PI * Math.min(1, t / 0.75)) ** 2;
      const settle = Math.exp(-(((t - 0.82) / 0.05) ** 2)) * 0.7;
      const crackle = Math.random() < 0.02 ? 1.8 : 1;
      data[i] = (Math.random() * 2 - 1) * (swell * 0.6 + settle) * crackle;
    }
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const band = audio.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.8;
    band.frequency.setValueAtTime(1800, audio.currentTime);
    band.frequency.linearRampToValueAtTime(4200, audio.currentTime + 0.3);
    band.frequency.linearRampToValueAtTime(1500, audio.currentTime + length);
    const gain = audio.createGain();
    gain.gain.value = 0.16;
    source.connect(band).connect(gain).connect(audio.destination);
    source.start();
  } catch {
    /* no sound available: turn quietly */
  }
}
