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
    
    // Chord progression in A minor (Am - F - C - G)
    // 4 beats per chord = 8 eighth-note steps per chord
    const progression = [
      { root: 'A1', chord: ['A3', 'C4', 'E4'] },
      { root: 'F1', chord: ['F3', 'A3', 'C4'] },
      { root: 'C2', chord: ['C4', 'E4', 'G4'] },
      { root: 'G1', chord: ['G3', 'B3', 'D4'] }
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

    // 1. Synth Bassline
    let playBass = false;
    let bassOctaveMultiplier = 1;
    // Cool rhythmic syncopation for the bass
    if (stepInChord === 0 || stepInChord === 2 || stepInChord === 3 || stepInChord === 5 || stepInChord === 6) {
      playBass = true;
      if (stepInChord === 3 || stepInChord === 6) bassOctaveMultiplier = 1.5; // octave jump
    }

    if (playBass) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      
      const freq = noteToFreq(root) * bassOctaveMultiplier;
      osc.frequency.setValueAtTime(freq, t);
      
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + this.beatDuration * 0.4);
      
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + this.beatDuration * 0.4);
    }

    // 2. Chords on the off-beat (synth pads)
    if (stepInChord === 2 || stepInChord === 6) {
      chord.forEach((note) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(noteToFreq(note), t);
        
        gain.gain.setValueAtTime(0.04, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + this.beatDuration * 0.8);
        
        osc.connect(gain);
        gain.connect(this.musicGain!);
        osc.start(t);
        osc.stop(t + this.beatDuration * 0.8);
      });
    }

    // 3. Simple retro melody arpeggio
    // Play on step 0, 4, 6 of the bar
    if (stepInChord === 0 || stepInChord === 3 || stepInChord === 5) {
      const melodyNotes = [
        ['E5', 'G5', 'A5'], // Am chord melodies
        ['A5', 'C6', 'F5'], // F
        ['G5', 'B5', 'E5'], // C
        ['D5', 'G5', 'B5']  // G
      ];
      const melodyChoice = melodyNotes[chordIndex][stepInChord % 3];
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(noteToFreq(melodyChoice), t);
      
      // Delay effect
      gain.gain.setValueAtTime(0.03, t);
      gain.gain.linearRampToValueAtTime(0.02, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + this.beatDuration * 0.5);
      
      osc.connect(gain);
      gain.connect(this.musicGain!);
      osc.start(t);
      osc.stop(t + this.beatDuration * 0.5);
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
