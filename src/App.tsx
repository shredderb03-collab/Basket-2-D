/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GameMode, 
  AudioSettings, 
  GameScoreState 
} from './types';
import { gameAudio } from './lib/audio';
import SettingsHeader from './components/SettingsHeader';
import BasketballCanvas from './components/BasketballCanvas';
import { 
  Trophy, 
  HelpCircle, 
  Music, 
  ArrowUpRight, 
  CloudRain, 
  Sparkles,
  Award,
  Zap,
  Flame,
  Volume2
} from 'lucide-react';

const INITIAL_SCORE_STATE: GameScoreState = {
  player1: { score: 0, shotsTaken: 0, shotsMade: 0, streak: 0, bestStreak: 0 },
  player2: { score: 0, shotsTaken: 0, shotsMade: 0, streak: 0, bestStreak: 0 },
  currentTurn: 1,
  level: 1,
};

export default function App() {
  const [mode, setMode] = useState<GameMode>(GameMode.VS_CPU);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    musicEnabled: true,
    sfxEnabled: true,
  });
  const [hummanEnabled, setHummanEnabled] = useState<boolean>(true);
  const [ballRadius, setBallRadius] = useState<number>(11);
  const [scoreState, setScoreState] = useState<GameScoreState>(INITIAL_SCORE_STATE);
  
  // Drag-and-drop file upload overlay state
  const [isDraggingFileOver, setIsDraggingFileOver] = useState(false);
  const [customMusicName, setCustomMusicName] = useState<string>('');

  // Start background synth music loop on first interaction
  useEffect(() => {
    const startAudioOnInteract = () => {
      gameAudio.ensureInitialized();
      gameAudio.startMusic();
      // Remove listeners once initiated
      window.removeEventListener('click', startAudioOnInteract);
      window.removeEventListener('touchstart', startAudioOnInteract);
      window.removeEventListener('mousedown', startAudioOnInteract);
    };

    window.addEventListener('click', startAudioOnInteract);
    window.addEventListener('touchstart', startAudioOnInteract);
    window.addEventListener('mousedown', startAudioOnInteract);

    return () => {
      window.removeEventListener('click', startAudioOnInteract);
      window.removeEventListener('touchstart', startAudioOnInteract);
      window.removeEventListener('mousedown', startAudioOnInteract);
    };
  }, []);

  // Update audio when mute toggles are modified
  useEffect(() => {
    gameAudio.setSettings(audioSettings);
  }, [audioSettings]);

  // Reset core scoreboard state
  const handleResetGame = () => {
    setScoreState(INITIAL_SCORE_STATE);
    // Play level up/chime sound to confirm
    gameAudio.playChimeSound();
  };

  // Handle global drag & drop for background audio files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFileOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFileOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFileOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      try {
        const name = await gameAudio.loadCustomSong(file);
        setCustomMusicName(name);
        
        // Ensure music is active
        const updated = { ...audioSettings, musicEnabled: true };
        setAudioSettings(updated);
        gameAudio.setSettings(updated);
      } catch (err) {
        console.error('Failed to load custom audio file:', err);
      }
    }
  };

  return (
    <div 
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between py-6 px-4 selection:bg-orange-500 selection:text-white relative overflow-x-hidden"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      id="app-container"
    >
      {/* Visual background ambient glowing orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Grid Layout */}
      <div className="max-w-4xl w-full mx-auto flex-1 flex flex-col justify-center">
        
        {/* settings & scoreboard bar */}
        <SettingsHeader
          mode={mode}
          setMode={setMode}
          audioSettings={audioSettings}
          setAudioSettings={setAudioSettings}
          scoreState={scoreState}
          resetGame={handleResetGame}
          hummanEnabled={hummanEnabled}
          setHummanEnabled={setHummanEnabled}
          ballRadius={ballRadius}
          setBallRadius={setBallRadius}
        />

        {/* 2D CANVAS ARENA WRAPPER */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="mb-6 relative"
          id="canvas-motion-wrapper"
        >
          <BasketballCanvas
            mode={mode}
            scoreState={scoreState}
            setScoreState={setScoreState}
            audioSettings={audioSettings}
            hummanEnabled={hummanEnabled}
            ballRadius={ballRadius}
          />

          {/* Dynamic drag & drop audio alert overlay */}
          <AnimatePresence>
            {isDraggingFileOver && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/85 border-4 border-dashed border-orange-500 rounded-3xl flex flex-col items-center justify-center p-8 text-center z-50 pointer-events-none"
              >
                <div className="p-4 bg-orange-500 rounded-2xl text-white mb-4 animate-bounce">
                  <Music className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">Drop your Song file here!</h3>
                <p className="text-slate-300 text-sm max-w-sm">
                  Release the file to decode and play your song as the active background soundtrack loop.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* STATS SUMMARY & DETAILED USER INTERACTIVE MANUAL */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="stats-and-manual-section">
          
          {/* Practice/Multiplayer Stats Summary Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-slate-900/55 border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between shadow"
            id="stats-summary-card"
          >
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-3">
                <Trophy className="w-3.5 h-3.5 text-orange-400" />
                Session Highlights
              </h3>

              {mode === GameMode.PRACTICE ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-slate-400">Streak Record:</span>
                    <span className="text-amber-400 font-bold flex items-center gap-0.5">
                      <Flame className="w-3 h-3 text-orange-500 fill-orange-500" />
                      {scoreState.player1.bestStreak}
                    </span>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-slate-400">Total Baskets:</span>
                    <span className="text-slate-200">{scoreState.player1.shotsMade}</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-slate-400">Current Level:</span>
                    <span className="text-emerald-400 font-semibold">{scoreState.level}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-slate-400">Player 1 Score:</span>
                    <span className="text-orange-400 font-bold">{scoreState.player1.score}</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-slate-400">Player 2 / CPU:</span>
                    <span className="text-sky-400 font-bold">{scoreState.player2.score}</span>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span className="text-slate-400">Turn Indicator:</span>
                    <span className="text-slate-300">Player {scoreState.currentTurn}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center gap-2 text-[11px] text-slate-400">
              <Award className="w-3.5 h-3.5 text-orange-400" />
              <span>Perfect "Swish" counts as 2 points!</span>
            </div>
          </motion.div>

          {/* Slingshot Instructions Card */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-slate-900/55 border border-slate-800/80 p-4 rounded-2xl md:col-span-2 shadow"
            id="instructions-card"
          >
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-3">
              <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
              How to Play & Controls
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
              <div className="space-y-2 leading-relaxed">
                <div className="flex items-start gap-1.5">
                  <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[10px] font-black font-mono">1</span>
                  <p><strong>Grab Ball</strong>: Click or tap the basketball sitting on the left platform stand.</p>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[10px] font-black font-mono">2</span>
                  <p><strong>Slingshot Pull</strong>: Drag the ball backwards/downwards. See the yellow dotted path preview its flight trajectory.</p>
                </div>
              </div>

              <div className="space-y-2 leading-relaxed">
                <div className="flex items-start gap-1.5">
                  <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded text-[10px] font-black font-mono">3</span>
                  <p><strong>Release Shot</strong>: Let go of the cursor or lift your finger to throw. Score clean "Swishes" for 2 points.</p>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-black font-mono">4</span>
                  <p><strong>Custom Tracks</strong>: Drag any mp3/wav song from your computer directly into the game window to load your track!</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Level Progression Indicator Bar (Only for Practice Solo) */}
        {mode === GameMode.PRACTICE && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-4 bg-slate-900/40 border border-slate-800/60 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
            id="progression-indicator"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <Zap className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div>
                <span className="font-semibold text-white block">Level {scoreState.level} Mode</span>
                <span className="text-[10px] text-slate-400">
                  {scoreState.level === 1 && "Level 1: Stationary hoop. Nice and easy!"}
                  {scoreState.level === 2 && "Level 2: Backboard moves up and down slowly."}
                  {scoreState.level === 3 && "Level 3: Hoop moves both vertically and horizontally."}
                  {scoreState.level >= 4 && "Level 4: Hoop moves dynamically, and lateral wind gusts are active!"}
                </span>
              </div>
            </div>
            
            <div className="w-full sm:w-44 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/80 p-0.5">
              <div 
                className="bg-gradient-to-r from-orange-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, ((scoreState.player1.shotsMade % 3) / 3) * 100)}%` }}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Footer Branding & Music indicator */}
      <footer className="w-full max-w-4xl mx-auto mt-6 text-center text-[10px] text-slate-500 border-t border-slate-800/40 pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
        <p className="font-mono">Created with Google AI Studio • Antigravity Physics Engine</p>
        
        {audioSettings.musicEnabled && (
          <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-800 px-2 py-1 rounded text-orange-400 font-mono animate-pulse-slow">
            <Volume2 className="w-3 h-3" />
            <span>{customMusicName ? `Playing: ${customMusicName}` : "Synthesizer: Active Dusk beat"}</span>
          </div>
        )}
      </footer>
    </div>
  );
}
