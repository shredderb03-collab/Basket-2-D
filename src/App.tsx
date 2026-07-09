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
import { safeStorage } from './lib/storage';
import SettingsHeader from './components/SettingsHeader';
import BasketballCanvas from './components/BasketballCanvas';
import ShopModal from './components/ShopModal';
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
  Volume2,
  Crown,
  RotateCcw
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
  const [shotBlockingEnabled, setShotBlockingEnabled] = useState<boolean>(() => {
    try {
      const saved = safeStorage.getItem('ragdoll_basketball_shot_blocking');
      return saved ? saved === 'true' : true;
    } catch (e) {
      return true;
    }
  });
  const [ballRadius, setBallRadius] = useState<number>(18);
  const [isShopOpen, setIsShopOpen] = useState<boolean>(false);
  const [scoreState, setScoreState] = useState<GameScoreState>(INITIAL_SCORE_STATE);
  const [winner, setWinner] = useState<1 | 2 | null>(null);
  
  // --- Shop & Economy System ---
  const [money, setMoney] = useState<number>(() => {
    try {
      const saved = safeStorage.getItem('ragdoll_basketball_money');
      if (saved) {
        const parsed = parseInt(saved, 10);
        return isNaN(parsed) ? 100 : parsed;
      }
    } catch (e) {
      console.error('Error reading money from safeStorage', e);
    }
    return 100; // start with $100 so they can buy something!
  });

  const [unlockedItems, setUnlockedItems] = useState<string[]>(() => {
    try {
      const saved = safeStorage.getItem('ragdoll_basketball_unlocked');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error reading unlockedItems from safeStorage', e);
    }
    return [];
  });

  const [activeTrail, setActiveTrail] = useState<string>(() => {
    try {
      return safeStorage.getItem('ragdoll_basketball_trail') || 'default';
    } catch (e) {
      return 'default';
    }
  });

  const [activeHat, setActiveHat] = useState<string>(() => {
    try {
      return safeStorage.getItem('ragdoll_basketball_hat') || 'none';
    } catch (e) {
      return 'none';
    }
  });

  const [activeWeight, setActiveWeight] = useState<string>(() => {
    try {
      return safeStorage.getItem('ragdoll_basketball_weight') || 'normal';
    } catch (e) {
      return 'normal';
    }
  });

  const [activeBounce, setActiveBounce] = useState<string>(() => {
    try {
      return safeStorage.getItem('ragdoll_basketball_bounce') || 'normal';
    } catch (e) {
      return 'normal';
    }
  });

  const [restockTime, setRestockTime] = useState<number>(120);
  const [shopStock, setShopStock] = useState<Record<string, number>>(() => {
    try {
      const saved = safeStorage.getItem('ragdoll_basketball_shop_stock');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.error('Error reading shopStock from safeStorage', e);
    }
    return {
      gold_trail: 1,
      featherweight: 2,
      super_bouncy: 1,
      cyberpunk_hat: 1,
      crown: 1
    };
  });

  // Automatically save progress whenever money or unlocked items update!
  useEffect(() => {
    try {
      safeStorage.setItem('ragdoll_basketball_money', money.toString());
    } catch (e) {}
  }, [money]);

  useEffect(() => {
    try {
      safeStorage.setItem('ragdoll_basketball_shot_blocking', shotBlockingEnabled.toString());
    } catch (e) {}
  }, [shotBlockingEnabled]);

  useEffect(() => {
    try {
      safeStorage.setItem('ragdoll_basketball_unlocked', JSON.stringify(unlockedItems));
    } catch (e) {}
  }, [unlockedItems]);

  useEffect(() => {
    try {
      safeStorage.setItem('ragdoll_basketball_trail', activeTrail);
    } catch (e) {}
  }, [activeTrail]);

  useEffect(() => {
    try {
      safeStorage.setItem('ragdoll_basketball_hat', activeHat);
    } catch (e) {}
  }, [activeHat]);

  useEffect(() => {
    try {
      safeStorage.setItem('ragdoll_basketball_weight', activeWeight);
    } catch (e) {}
  }, [activeWeight]);

  useEffect(() => {
    try {
      safeStorage.setItem('ragdoll_basketball_bounce', activeBounce);
    } catch (e) {}
  }, [activeBounce]);

  // Reset game scores when switching modes
  useEffect(() => {
    setScoreState(INITIAL_SCORE_STATE);
    setWinner(null);
  }, [mode]);

  // Monitor scores for first to 30 wins
  useEffect(() => {
    if (mode === GameMode.PRACTICE) {
      setWinner(null);
      return;
    }
    if (scoreState.player1.score >= 30) {
      setWinner(1);
      try {
        gameAudio.playChimeSound();
        setTimeout(() => gameAudio.playCheerSound(), 500);
      } catch (e) {}
    } else if (scoreState.player2.score >= 30) {
      setWinner(2);
      try {
        gameAudio.playChimeSound();
        setTimeout(() => gameAudio.playCheerSound(), 500);
      } catch (e) {}
    } else {
      setWinner(null);
    }
  }, [scoreState.player1.score, scoreState.player2.score, mode]);

  // Shop Restock Timer (ticks down 120s / 2mins)
  useEffect(() => {
    const interval = setInterval(() => {
      setRestockTime((prev) => {
        if (prev <= 1) {
          try { gameAudio.playChimeSound(); } catch (e) {}
          const newStock = {
            gold_trail: Math.floor(Math.random() * 3),
            featherweight: Math.floor(Math.random() * 4),
            super_bouncy: Math.floor(Math.random() * 2),
            cyberpunk_hat: Math.floor(Math.random() * 3),
            crown: Math.floor(Math.random() * 2)
          };
          setShopStock(newStock);
          try {
            safeStorage.setItem('ragdoll_basketball_shop_stock', JSON.stringify(newStock));
          } catch (e) {}
          return 120;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleScoreMade = (isSwish: boolean, isPlayerTurn: boolean) => {
    if (isPlayerTurn) {
      const reward = isSwish ? 50 : 25;
      setMoney((prev) => prev + reward);
    }
  };

  const computedMass = activeWeight === 'featherweight' ? 0.60 : 1.0;
  const computedRestitution = activeBounce === 'super_bouncy' ? 0.96 : 0.88;

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
    setWinner(null);
    // Play level up/chime sound to confirm
    try { gameAudio.playChimeSound(); } catch (e) {}
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
          shotBlockingEnabled={shotBlockingEnabled}
          setShotBlockingEnabled={setShotBlockingEnabled}
          ballRadius={ballRadius}
          setBallRadius={setBallRadius}
          money={money}
          setMoney={setMoney}
          unlockedItems={unlockedItems}
          setUnlockedItems={setUnlockedItems}
          activeTrail={activeTrail}
          setActiveTrail={setActiveTrail}
          activeHat={activeHat}
          setActiveHat={setActiveHat}
          activeWeight={activeWeight}
          setActiveWeight={setActiveWeight}
          activeBounce={activeBounce}
          setActiveBounce={setActiveBounce}
          restockTime={restockTime}
          shopStock={shopStock}
          setShopStock={setShopStock}
          onOpenShop={() => setIsShopOpen(true)}
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
            shotBlockingEnabled={shotBlockingEnabled}
            ballRadius={ballRadius}
            activeTrail={activeTrail}
            activeHat={activeHat}
            ballMass={computedMass}
            ballRestitution={computedRestitution}
            onScoreMade={handleScoreMade}
          />
          
          {/* Victory overlay for first to 30 wins */}
          <AnimatePresence>
            {winner !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 bg-slate-950/90 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-8 text-center z-40 border border-emerald-500/30 shadow-2xl shadow-emerald-500/10"
                id="victory-overlay"
              >
                <div className="absolute top-4 left-4 flex gap-1 animate-pulse">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <Sparkles className="w-3 h-3 text-emerald-400 mt-2" />
                </div>
                <div className="absolute bottom-4 right-4 flex gap-1 animate-pulse">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <Sparkles className="w-5 h-5 text-amber-400 mb-2" />
                </div>

                <motion.div
                  initial={{ y: -20, scale: 0.8 }}
                  animate={{ y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.15 }}
                  className="mb-4 relative"
                >
                  <div className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-yellow-300 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20">
                    <Trophy className="w-10 h-10 text-slate-950 animate-bounce" />
                  </div>
                  <motion.div 
                    animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                    className="absolute -top-3 -right-3"
                  >
                    <Crown className="w-8 h-8 text-yellow-400 fill-yellow-400 drop-shadow" />
                  </motion.div>
                </motion.div>

                <h2 className="text-3xl font-black text-white tracking-wider uppercase mb-1 drop-shadow bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-emerald-300 to-amber-400 animate-pulse">
                  {mode === GameMode.VS_CPU 
                    ? (winner === 1 ? 'Human Victory!' : 'CPU Victory!')
                    : (winner === 1 ? 'Player 1 Wins!' : 'Player 2 Wins!')
                  }
                </h2>
                
                <p className="text-slate-400 text-xs font-mono tracking-widest uppercase mb-4">
                  First to 30 Points Achieved!
                </p>

                <div className="flex items-center gap-6 bg-slate-900/80 px-6 py-3 rounded-2xl border border-slate-800 mb-6 font-mono">
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase">
                      {mode === GameMode.VS_CPU ? 'You' : 'P1 Score'}
                    </span>
                    <span className="text-2xl font-black text-orange-400">
                      {scoreState.player1.score}
                    </span>
                  </div>
                  <div className="text-slate-600 text-lg font-bold">VS</div>
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase">
                      {mode === GameMode.VS_CPU ? 'Bot' : 'P2 Score'}
                    </span>
                    <span className="text-2xl font-black text-sky-400">
                      {scoreState.player2.score}
                    </span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleResetGame}
                  className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-orange-500/20 border border-orange-400/20 cursor-pointer transition-all"
                  id="rematch-btn"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Rematch
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

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

      <ShopModal
        isOpen={isShopOpen}
        onClose={() => setIsShopOpen(false)}
        money={money}
        setMoney={setMoney}
        unlockedItems={unlockedItems}
        setUnlockedItems={setUnlockedItems}
        activeTrail={activeTrail}
        setActiveTrail={setActiveTrail}
        activeHat={activeHat}
        setActiveHat={setActiveHat}
        activeWeight={activeWeight}
        setActiveWeight={setActiveWeight}
        activeBounce={activeBounce}
        setActiveBounce={setActiveBounce}
        restockTime={restockTime}
        shopStock={shopStock}
        setShopStock={setShopStock}
      />
    </div>
  );
}
