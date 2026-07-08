/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AudioSettings } from '../types';

class GameAudioManager {
  private ctx: AudioContext | null = null;
  private musicIntervalId: any = null;
  private customMusicSource: AudioBufferSourceNode | null = null;
  private customMusicBuffer: AudioBuffer | null = null;
  private settings: AudioSettings = { musicEnabled: true, sfxEnabled: true };
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private tempo = 112; // BPM
  private beatDuration = 60 / this.tempo;
  private currentStep = 0;
  private activeOscillators: AudioNode[] = [];
  
  // Custom music metadata
  public customFileName = '';

  constructor() {
    // We defer creation of the AudioContext until the first user interaction
  }

  private initContext() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create separate gain nodes for music and sfx
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
      
      // Initial volumes
      this.musicGain.gain.setValueAtTime(this.settings.musicEnabled ? 0.15 : 0, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(this.settings.sfxEnabled ? 0.35 : 0, this.ctx.currentTime);
    } catch (e) {
      console.error('Web Audio API not supported in this browser', e);
    }
  }

  public ensureInitialized() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setSettings(settings: AudioSettings) {
    this.settings = settings;
    this.ensureInitialized();
    
    if (this.ctx) {
      if (this.musicGain) {
        this.musicGain.gain.setValueAtTime(settings.musicEnabled ? 0.12 : 0, this.ctx.currentTime);
      }
      if (this.sfxGain) {
        this.sfxGain.gain.setValueAtTime(settings.sfxEnabled ? 0.35 : 0, this.ctx.currentTime);
      }
    }

    if (settings.musicEnabled) {
      this.startMusic();
    } else {
      this.stopMusicTrackOnly();
    }
  }

  // --- BACKGROUND MUSIC ---
  public async loadCustomSong(file: File): Promise<string> {
    this.ensureInitialized();
    if (!this.ctx) throw new Error('Audio context not initialized');

    this.customFileName = file.name;
    const arrayBuffer = await file.arrayBuffer();
    
    // Stop existing custom music and synthesizers
    this.stopMusicTrackOnly();

    return new Promise((resolve, reject) => {
      this.ctx!.decodeAudioData(
        arrayBuffer,
        (buffer) => {
          this.customMusicBuffer = buffer;
          this.playCustomMusicLoop();
          resolve(file.name);
        },
        (err) => {
          console.error('Error decoding audio data', err);
          reject(err);
        }
      );
    });
  }

  private playCustomMusicLoop() {
    if (!this.ctx || !this.customMusicBuffer || !this.settings.musicEnabled) return;
    
    // Stop any existing source
    if (this.customMusicSource) {
      try { this.customMusicSource.stop(); } catch(e) {}
      this.customMusicSource.disconnect();
    }

    this.customMusicSource = this.ctx.createBufferSource();
    this.customMusicSource.buffer = this.customMusicBuffer;
    this.customMusicSource.loop = true;
    this.customMusicSource.connect(this.musicGain!);
    this.customMusicSource.start(0);
  }

  public startMusic() {
    this.ensureInitialized();
    if (!this.settings.musicEnabled) return;
    
    if (this.customMusicBuffer) {
      this.playCustomMusicLoop();
      return;
    }

    // Play synthesized loop if no custom song is loaded
    if (this.musicIntervalId) return;

    this.currentStep = 0;
    const intervalMs = (this.beatDuration / 2) * 1000; // Eighth notes
    
    this.musicIntervalId = setInterval(() => {
      if (!this.ctx || this.ctx.state === 'suspended' || !this.settings.musicEnabled) return;
      this.playSynthBeatStep();
    }, intervalMs);
  }

  private stopMusicTrackOnly() {
    if (this.customMusicSource) {
      try { this.customMusicSource.stop(); } catch (e) {}
      this.customMusicSource.disconnect();
      this.customMusicSource = null;
    }
    if (this.musicIntervalId) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
    this.activeOscillators.forEach(osc => {
      try { (osc as any).stop(); } catch(e) {}
    });
    this.activeOscillators = [];
  }

  public clearCustomSong() {
    this.customMusicBuffer = null;
    this.customFileName = '';
    this.stopMusicTrackOnly();
    if (this.settings.musicEnabled) {
      this.startMusic();
    }
  }

  // A catchy retro 16-step bass & chord sequence synth
  private playSynthBeatStep() {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    
    // Chord progression: A catchy, energetic sports-funk sequence (Am - Dm7 - G7 - Cmaj7)
    // 4 beats per chord = 8 eighth-note steps per chord
    const progression = [
      { root: 'A1', chord: ['A3', 'C4', 'E4', 'G4'] },
      { root: 'D1', chord: ['F3', 'A3', 'C4', 'E4'] },
      { root: 'G1', chord: ['G3', 'B3', 'D4', 'F4'] },
      { root: 'C2', chord: ['C4', 'E4', 'G4', 'B4'] }
    ];

    const chordIndex = Math.floor(this.currentStep / 8) % 4;
    const stepInChord = this.currentStep % 8;
    const { root, chord } = progression[chordIndex];

    const noteToFreq = (note: string): number => {
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const key = note.slice(0, -1);
      const octave = parseInt(note.slice(-1));
      const keyIndex = notes.indexOf(key);
      return 440 * Math.pow(2, (keyIndex - 9 + (octave - 4) * 12) / 12);
    };

    // --- 1. SYNTH DRUMS (KICK, SNARE, HI-HAT) ---
    // Punchy Kick Drum on steps 0, 3, and 6
    if (stepInChord === 0 || stepInChord === 3 || stepInChord === 6) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(160, t);
      kickOsc.frequency.exponentialRampToValueAtTime(42, t + 0.1);
      
      kickGain.gain.setValueAtTime(0.35, t);
      kickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      
      kickOsc.connect(kickGain);
      kickGain.connect(this.musicGain);
      kickOsc.start(t);
      kickOsc.stop(t + 0.12);
    }

    // Snappy Snare Drum on steps 2 and 6
    if (stepInChord === 2 || stepInChord === 6) {
      const noiseBuffer = this.createNoiseBuffer();
      if (noiseBuffer) {
        const snareNoise = this.ctx.createBufferSource();
        snareNoise.buffer = noiseBuffer;
        
        const snareFilter = this.ctx.createBiquadFilter();
        snareFilter.type = 'bandpass';
        snareFilter.frequency.setValueAtTime(1000, t);
        snareFilter.Q.setValueAtTime(2.0, t);
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.08, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        
        snareNoise.connect(snareFilter);
        snareFilter.connect(noiseGain);
        noiseGain.connect(this.musicGain);
        snareNoise.start(t);
        snareNoise.stop(t + 0.14);
      }
      
      const snareTone = this.ctx.createOscillator();
      const toneGain = this.ctx.createGain();
      snareTone.type = 'triangle';
      snareTone.frequency.setValueAtTime(180, t);
      snareTone.frequency.exponentialRampToValueAtTime(110, t + 0.08);
      
      toneGain.gain.setValueAtTime(0.12, t);
      toneGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      
      snareTone.connect(toneGain);
      toneGain.connect(this.musicGain);
      snareTone.start(t);
      snareTone.stop(t + 0.08);
    }

    // Crisp Closed Hi-Hat on offbeats (steps 1, 3, 5, 7)
    if (stepInChord === 1 || stepInChord === 3 || stepInChord === 5 || stepInChord === 7) {
      const noiseBuffer = this.createNoiseBuffer();
      if (noiseBuffer) {
        const hatNoise = this.ctx.createBufferSource();
        hatNoise.buffer = noiseBuffer;
        
        const hatFilter = this.ctx.createBiquadFilter();
        hatFilter.type = 'highpass';
        hatFilter.frequency.setValueAtTime(8500, t);
        
        const hatGain = this.ctx.createGain();
        // Step 7 is an open hat sound (longer decay) if desired, else crisp short decay
        const decayTime = stepInChord === 7 ? 0.12 : 0.04;
        hatGain.gain.setValueAtTime(stepInChord === 7 ? 0.035 : 0.025, t);
        hatGain.gain.exponentialRampToValueAtTime(0.001, t + decayTime);
        
        hatNoise.connect(hatFilter);
        hatFilter.connect(hatGain);
        hatGain.connect(this.musicGain);
        hatNoise.start(t);
        hatNoise.stop(t + decayTime + 0.01);
      }
    }

    // --- 2. SYNTH BASSLINE ---
    let playBass = false;
    let bassOctaveMultiplier = 1;
    // Bouncy, syncopated street funk groove
    if (stepInChord === 0 || stepInChord === 2 || stepInChord === 3 || stepInChord === 5 || stepInChord === 6 || stepInChord === 7) {
      playBass = true;
      if (stepInChord === 3 || stepInChord === 7) bassOctaveMultiplier = 2; // high slap octave bounce!
    }

    if (playBass) {
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      // Combine triangle and sawtooth for that authentic FM-synth arcade slap-bass
      bassOsc.type = stepInChord === 3 || stepInChord === 7 ? 'sawtooth' : 'triangle';
      
      const freq = noteToFreq(root) * bassOctaveMultiplier;
      bassOsc.frequency.setValueAtTime(freq, t);
      
      // Slap sound filter envelope sweep
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);
      filter.frequency.exponentialRampToValueAtTime(150, t + this.beatDuration * 0.3);

      const vol = stepInChord === 3 || stepInChord === 7 ? 0.10 : 0.18; // balance the slap volume
      bassGain.gain.setValueAtTime(vol, t);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + this.beatDuration * 0.35);
      
      bassOsc.connect(filter);
      filter.connect(bassGain);
      bassGain.connect(this.musicGain);
      bassOsc.start(t);
      bassOsc.stop(t + this.beatDuration * 0.35);
    }

    // --- 3. RETRO CHORDS (ELEGANT BRASS-LIKE SYNTH PADS) ---
    // Play full chord stabs on steps 1, 4, and 7 to complement the melody
    if (stepInChord === 1 || stepInChord === 4 || stepInChord === 7) {
      chord.forEach((note, idx) => {
        const padOsc = this.ctx!.createOscillator();
        const padGain = this.ctx!.createGain();
        padOsc.type = 'sawtooth'; // soft brass stab
        padOsc.frequency.setValueAtTime(noteToFreq(note), t);
        
        // Lowpass filter to make it warm, not harsh
        const padFilter = this.ctx!.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.frequency.setValueAtTime(500 + idx * 80, t);

        const stabVolume = stepInChord === 1 ? 0.035 : 0.02;
        padGain.gain.setValueAtTime(stabVolume, t);
        padGain.gain.exponentialRampToValueAtTime(0.001, t + this.beatDuration * 0.6);
        
        padOsc.connect(padFilter);
        padFilter.connect(padGain);
        padGain.connect(this.musicGain!);
        padOsc.start(t);
        padOsc.stop(t + this.beatDuration * 0.6);
      });
    }

    // --- 4. ARCADE SPORTS MELODY ---
    // High-energy hook on steps 0, 2, 4, 5
    if (stepInChord === 0 || stepInChord === 2 || stepInChord === 4 || stepInChord === 5) {
      const melodyNotes = [
        ['E5', 'G5', 'A5', 'C6'], // Am hook
        ['A5', 'C6', 'D6', 'G6'], // Dm7 hook
        ['G5', 'B5', 'C6', 'E6'], // G7 hook
        ['C6', 'E6', 'G6', 'A6']  // Cmaj7 hook
      ];
      const melodyChoice = melodyNotes[chordIndex][stepInChord % 4];
      
      const leadOsc = this.ctx.createOscillator();
      const leadGain = this.ctx.createGain();
      leadOsc.type = 'triangle';
      leadOsc.frequency.setValueAtTime(noteToFreq(melodyChoice), t);
      
      // Delay-like envelope echo effect
      leadGain.gain.setValueAtTime(0.045, t);
      leadGain.gain.linearRampToValueAtTime(0.035, t + 0.04);
      leadGain.gain.exponentialRampToValueAtTime(0.0001, t + this.beatDuration * 0.45);
      
      leadOsc.connect(leadGain);
      leadGain.connect(this.musicGain!);
      leadOsc.start(t);
      leadOsc.stop(t + this.beatDuration * 0.45);
    }

    this.currentStep = (this.currentStep + 1) % 32; // 32 steps total
  }


  // --- SOUND EFFECTS ---

  // 1. Drag / Pull back elastic sound
  public playDragSound(tension: number) {
    if (!this.ctx || !this.settings.sfxEnabled || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    
    // Quick mini pitch bend to show tension
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150 + tension * 100, t);
    
    gain.gain.setValueAtTime(0.015 * tension, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // 2. Shoot / Release ball (swoosh)
  public playShootSound() {
    if (!this.ctx || !this.settings.sfxEnabled || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const noiseBuffer = this.createNoiseBuffer();
    if (!noiseBuffer) return;

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(3.0, t);
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(1600, t + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noiseSource.start(t);
    noiseSource.stop(t + 0.15);
  }

  // 3. Bounce sound (damp heavy hollow thud)
  public playBounceSound(intensity: number = 1) {
    if (!this.ctx || !this.settings.sfxEnabled || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const volume = Math.min(0.6, 0.1 + intensity * 0.4);

    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(75, t);
    osc2.frequency.exponentialRampToValueAtTime(30, t + 0.1);

    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc2.start(t);
    osc.stop(t + 0.15);
    osc2.stop(t + 0.15);
  }

  // 4. Rim bounce sound (metallic ringing sound)
  public playRimSound() {
    if (!this.ctx || !this.settings.sfxEnabled || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(650, t);
    
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1020, t);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.2);
    osc2.stop(t + 0.2);
  }

  // 5. Net Swish (pure, satisfying friction sound)
  public playSwishSound() {
    if (!this.ctx || !this.settings.sfxEnabled || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const noiseBuffer = this.createNoiseBuffer();
    if (!noiseBuffer) return;

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(4.0, t);
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.exponentialRampToValueAtTime(900, t + 0.25);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noiseSource.start(t);
    noiseSource.stop(t + 0.3);
  }

  // 6. Crowd cheering (noise swelling)
  public playCheerSound() {
    if (!this.ctx || !this.settings.sfxEnabled || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const noiseBuffer = this.createNoiseBuffer();
    if (!noiseBuffer) return;

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(1.5, t);
    filter.frequency.setValueAtTime(450, t);
    filter.frequency.linearRampToValueAtTime(750, t + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    // Also a quick secondary higher pitch cheer arpeggio
    const chord = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    chord.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const oscGain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);
      
      oscGain.gain.setValueAtTime(0, t);
      oscGain.gain.setValueAtTime(0.03, t + idx * 0.08);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8 + idx * 0.08);
      
      osc.connect(oscGain);
      oscGain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 1.2);
    });

    noiseSource.start(t);
    noiseSource.stop(t + 2.0);
  }

  // 7. Chime / Level up / Streak reward
  public playChimeSound() {
    if (!this.ctx || !this.settings.sfxEnabled || !this.sfxGain) return;
    const t = this.ctx.currentTime;

    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    notes.forEach((freq, index) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + index * 0.12);
      
      gain.gain.setValueAtTime(0.15, t + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + index * 0.12 + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t + index * 0.12);
      osc.stop(t + index * 0.12 + 0.4);
    });
  }

  // Helper to generate white noise buffer
  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}

export const gameAudio = new GameAudioManager();
