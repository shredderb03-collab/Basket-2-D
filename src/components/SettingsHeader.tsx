/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Music, 
  User, 
  Users, 
  Cpu, 
  Upload, 
  RotateCcw, 
  HelpCircle,
  Flame,
  ChevronDown,
  Sparkles,
  Lock,
  Sliders,
  ShoppingBag,
  Coins,
  Save,
  Check,
  Trophy,
  Shield
} from 'lucide-react';
import { GameMode, AudioSettings, GameScoreState } from '../types';
import { gameAudio } from '../lib/audio';
import { safeStorage } from '../lib/storage';

interface SettingsHeaderProps {
  mode: GameMode;
  setMode: (mode: GameMode) => void;
  audioSettings: AudioSettings;
  setAudioSettings: (settings: AudioSettings) => void;
  scoreState: GameScoreState;
  resetGame: () => void;
  hummanEnabled: boolean;
  setHummanEnabled: (enabled: boolean) => void;
  shotBlockingEnabled: boolean;
  setShotBlockingEnabled: (enabled: boolean) => void;
  ballRadius: number;
  setBallRadius: (radius: number) => void;
  money: number;
  setMoney: React.Dispatch<React.SetStateAction<number>>;
  unlockedItems: string[];
  setUnlockedItems: React.Dispatch<React.SetStateAction<string[]>>;
  activeTrail: string;
  setActiveTrail: (val: string) => void;
  activeHat: string;
  setActiveHat: (val: string) => void;
  activeWeight: string;
  setActiveWeight: (val: string) => void;
  activeBounce: string;
  setActiveBounce: (val: string) => void;
  restockTime: number;
  shopStock: Record<string, number>;
  setShopStock: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onOpenShop: () => void;
}

export default function SettingsHeader({
  mode,
  setMode,
  audioSettings,
  setAudioSettings,
  scoreState,
  resetGame,
  hummanEnabled,
  setHummanEnabled,
  shotBlockingEnabled,
  setShotBlockingEnabled,
  ballRadius,
  setBallRadius,
  money,
  setMoney,
  unlockedItems,
  setUnlockedItems,
  activeTrail,
  setActiveTrail,
  activeHat,
  setActiveHat,
  activeWeight,
  setActiveWeight,
  activeBounce,
  setActiveBounce,
  restockTime,
  shopStock,
  setShopStock,
  onOpenShop,
}: SettingsHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploadedSong, setUploadedSong] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaveFlash, setIsSaveFlash] = useState(false);

  const handleManualSave = () => {
    try {
      safeStorage.setItem('ragdoll_basketball_money', money.toString());
      safeStorage.setItem('ragdoll_basketball_unlocked', JSON.stringify(unlockedItems));
      safeStorage.setItem('ragdoll_basketball_trail', activeTrail);
      safeStorage.setItem('ragdoll_basketball_hat', activeHat);
      safeStorage.setItem('ragdoll_basketball_weight', activeWeight);
      safeStorage.setItem('ragdoll_basketball_bounce', activeBounce);
    } catch (e) {
      console.error('Failed to save state to safeStorage:', e);
    }
    
    try { gameAudio.playChimeSound(); } catch (e) {}

    setIsSaveFlash(true);
    setTimeout(() => {
      setIsSaveFlash(false);
    }, 2500);
  };

  const toggleMusic = () => {
    const updated = { ...audioSettings, musicEnabled: !audioSettings.musicEnabled };
    setAudioSettings(updated);
    gameAudio.setSettings(updated);
  };

  const toggleSfx = () => {
    const updated = { ...audioSettings, sfxEnabled: !audioSettings.sfxEnabled };
    setAudioSettings(updated);
    gameAudio.setSettings(updated);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadedSong('Loading song...');
      const name = await gameAudio.loadCustomSong(file);
      setUploadedSong(name);
    } catch (err) {
      console.error(err);
      setUploadedSong('Error loading file');
    }
  };

  const clearCustomSong = () => {
    gameAudio.clearCustomSong();
    setUploadedSong('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <header className="w-full max-w-4xl mx-auto mb-4" id="game-header">
      {/* Main Glassmorphic Top Bar */}
      <div className="bg-slate-900/90 border border-slate-700/60 rounded-2xl shadow-xl backdrop-blur-md p-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300">
        
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500 rounded-xl shadow-lg shadow-orange-500/20 text-white animate-bounce-subtle">
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
              <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4C14.07,4 16,4.68 17.58,5.82C16.85,7 15.42,7.74 13.82,7.94C13.23,6.23 12.03,4.86 10.5,4.18C11,4.06 11.5,4 12,4M8.17,5.08C9.57,5.8 10.63,7.12 11.13,8.74C8.91,9 6.81,8.32 5.17,7.03C6,6.15 7,5.5 8.17,5.08M4.24,9.38C6,10.74 8.24,11.45 10.6,11.17C10.28,13.4 9.1,15.35 7.42,16.63C5.9,15.22 4.88,13.27 4.54,11.1C4.38,10.54 4.28,10 4.24,9.38M12.6,11.16C15,11.42 17.29,10.69 19,9.3C18.94,10 18.82,10.68 18.63,11.33C18.23,13.56 17.13,15.5 15.38,16.83C13.75,15.5 12.63,13.45 12.35,11.16H12.6M14,19.34C15.35,18.06 16.27,16.32 16.61,14.39C17.91,14.15 19.1,13.44 20,12.44C19.64,15.18 18.06,17.56 15.83,19C15.25,19.16 14.63,19.28 14,19.34M10,19.33C9.37,19.26 8.75,19.14 8.17,18.97C6,17.5 4.41,15.1 4.07,12.33C5,13.38 6.25,14.12 7.62,14.36C8,16.31 8.92,18.06 10,19.33M12,19.91C11.5,19.91 11,19.86 10.5,19.78C11.31,18.5 12,17 12.31,15.33C12.87,17 13.57,18.5 14.38,19.74C13.62,19.85 12.82,19.91 12,19.91Z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
              SLINGSHOT <span className="text-orange-500">2D</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">Physics Basketball</p>
          </div>
        </div>

        {/* Live Active Scoreboard */}
        <div className="flex-1 max-w-md w-full bg-slate-950/50 rounded-xl px-4 py-2 border border-slate-800/80 flex items-center justify-around gap-2 text-center shadow-inner">
          {mode === GameMode.PRACTICE && (
            <>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-mono">Score</span>
                <span className="text-xl font-bold text-orange-400">{scoreState.player1.score}</span>
              </div>
              <div className="w-[1px] h-6 bg-slate-800" />
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-mono">Level</span>
                <span className="text-xl font-bold text-emerald-400">{scoreState.level}</span>
              </div>
              <div className="w-[1px] h-6 bg-slate-800" />
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-mono flex items-center justify-center gap-0.5">
                  Streak <Flame className="w-2.5 h-2.5 text-orange-500 fill-orange-500 inline" />
                </span>
                <span className="text-xl font-bold text-amber-500">{scoreState.player1.streak}</span>
              </div>
              <div className="w-[1px] h-6 bg-slate-800" />
              <div>
                <span className="block text-[10px] text-slate-400 uppercase font-mono">Best</span>
                <span className="text-xl font-bold text-amber-400">{scoreState.player1.bestStreak}</span>
              </div>
            </>
          )}

          {mode === GameMode.PASS_AND_PLAY && (
            <>
              <div className={`transition-all p-1.5 rounded-lg ${scoreState.currentTurn === 1 ? 'bg-orange-500/15 border border-orange-500/30 ring-1 ring-orange-500/10' : ''}`}>
                <span className="block text-[9px] text-slate-400 uppercase font-mono">Player 1</span>
                <span className={`text-base font-bold ${scoreState.currentTurn === 1 ? 'text-orange-400 font-black' : 'text-slate-300'}`}>
                  {scoreState.player1.score}
                </span>
              </div>
              <div className="text-xs font-mono text-slate-500 animate-pulse">
                {scoreState.currentTurn === 1 ? '← TURN 1' : 'TURN 2 →'}
              </div>
              <div className={`transition-all p-1.5 rounded-lg ${scoreState.currentTurn === 2 ? 'bg-orange-500/15 border border-orange-500/30 ring-1 ring-orange-500/10' : ''}`}>
                <span className="block text-[9px] text-slate-400 uppercase font-mono">Player 2</span>
                <span className={`text-base font-bold ${scoreState.currentTurn === 2 ? 'text-orange-400 font-black' : 'text-slate-300'}`}>
                  {scoreState.player2.score}
                </span>
              </div>
            </>
          )}

          {mode === GameMode.VS_CPU && (
            <>
              <div className="text-left">
                <span className="block text-[9px] text-slate-400 uppercase font-mono">Human Player</span>
                <span className="text-lg font-bold text-orange-400">{scoreState.player1.score}</span>
              </div>
              <div className="w-[1px] h-6 bg-slate-800" />
              <div className="px-2 max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">
                <span className="block text-[9px] text-slate-500 uppercase font-mono">Turn</span>
                <span className="text-xs font-semibold text-slate-300">
                  {scoreState.currentTurn === 1 ? '🏀 Your Turn' : '🤖 CPU Aiming...'}
                </span>
              </div>
              <div className="w-[1px] h-6 bg-slate-800" />
              <div className="text-right">
                <span className="block text-[9px] text-slate-400 uppercase font-mono">Robo Opponent</span>
                <span className="text-lg font-bold text-sky-400">{scoreState.player2.score}</span>
              </div>
            </>
          )}
        </div>

        {/* Essential Buttons */}
        <div className="flex items-center gap-2">
          {/* Settings Toggle Trigger */}
          <button 
            id="toggle-settings-btn"
            onClick={() => setIsOpen(!isOpen)}
            className={`px-3 py-2 rounded-xl flex items-center gap-1.5 text-xs font-medium border transition-all ${
              isOpen 
                ? 'bg-slate-800 border-slate-600 text-white' 
                : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span>Options</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dedicated prominent Locker Room Shop button */}
          <button 
            id="header-open-shop-btn"
            onClick={onOpenShop}
            className="px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs font-extrabold border bg-gradient-to-r from-amber-500/15 to-orange-500/15 border-amber-500/45 hover:border-amber-400 text-amber-400 hover:text-amber-300 shadow-md shadow-amber-500/5 transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Locker Room Shop"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
            <span className="hidden xs:inline">Shop</span>
            <span className="bg-amber-400 text-slate-950 font-mono text-[10px] font-black px-1.5 py-0.5 rounded-full">
              ${money}
            </span>
          </button>

          {/* Quick Mute Toggle for Instant Audio Control */}
          <button
            id="quick-mute-btn"
            onClick={toggleMusic}
            title={audioSettings.musicEnabled ? "Mute Background Music" : "Unmute Background Music"}
            className={`p-2.5 rounded-xl border transition-all ${
              audioSettings.musicEnabled 
                ? 'bg-slate-950/40 border-slate-800 text-orange-400 hover:bg-slate-800 hover:text-orange-300' 
                : 'bg-red-950/20 border-red-900/50 text-red-400'
            }`}
          >
            {audioSettings.musicEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Quick Humman Mode Toggle */}
          <button
            id="quick-humman-btn"
            onClick={() => setHummanEnabled(!hummanEnabled)}
            title={hummanEnabled ? "Disable Humman Ragdoll" : "Enable Humman Ragdoll"}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center gap-1 ${
              hummanEnabled 
                ? 'bg-orange-500/15 border-orange-500/50 text-orange-400 hover:bg-orange-500/25 animate-pulse-slow' 
                : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span className="text-[10px] font-mono font-bold hidden sm:inline">HUMMAN</span>
          </button>

          {/* Hard Reset */}
          <button
            id="reset-game-btn"
            onClick={resetGame}
            title="Reset Score & Board"
            className="p-2.5 rounded-xl bg-slate-950/40 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Options Drawer/Panel */}
      {isOpen && (
        <div className="mt-2 p-5 bg-slate-900/95 border border-slate-700/60 rounded-2xl shadow-2xl backdrop-blur-md grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-300 animate-fadeIn" id="options-panel">
          
          {/* Column 1: Game Modes (UNLOCKED!) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <User className="w-3.5 h-3.5 text-orange-500" />
              Game Match Option
            </h3>
            
            <div className="grid grid-cols-1 gap-2.5">
              {/* Practice Mode */}
              <button
                id="mode-practice-btn"
                onClick={() => setMode(GameMode.PRACTICE)}
                className={`text-left p-3 rounded-xl border flex items-start gap-3 transition-all ${
                  mode === GameMode.PRACTICE
                    ? 'border-orange-500/50 bg-orange-500/10 text-white shadow-lg shadow-orange-500/5'
                    : 'bg-slate-950/20 border-slate-800/40 text-slate-400 hover:bg-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${mode === GameMode.PRACTICE ? 'bg-orange-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">Single Player Practice</span>
                    {mode === GameMode.PRACTICE && <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-mono uppercase font-bold">Active</span>}
                  </div>
                  <span className="block text-xs text-slate-400">Perfect your shots. Level up with every 3 baskets made and unlock movement.</span>
                </div>
              </button>

              {/* Pass and Play Mode */}
              <button
                id="mode-passplay-btn"
                onClick={() => setMode(GameMode.PASS_AND_PLAY)}
                className={`text-left p-3 rounded-xl border flex items-start gap-3 transition-all ${
                  mode === GameMode.PASS_AND_PLAY
                    ? 'border-orange-500/50 bg-orange-500/10 text-white shadow-lg shadow-orange-500/5'
                    : 'bg-slate-950/20 border-slate-800/40 text-slate-400 hover:bg-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${mode === GameMode.PASS_AND_PLAY ? 'bg-orange-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">Pass & Play (Local 2P)</span>
                    {mode === GameMode.PASS_AND_PLAY && <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-mono uppercase font-bold">Active</span>}
                  </div>
                  <span className="block text-xs text-slate-400">Take turns shooting with a friend on the same device! Pass the controls!</span>
                </div>
              </button>

              {/* VS Computer Mode */}
              <button
                id="mode-vscpu-btn"
                onClick={() => setMode(GameMode.VS_CPU)}
                className={`text-left p-3 rounded-xl border flex items-start gap-3 transition-all ${
                  mode === GameMode.VS_CPU
                    ? 'border-orange-500/50 bg-orange-500/10 text-white shadow-lg shadow-orange-500/5'
                    : 'bg-slate-950/20 border-slate-800/40 text-slate-400 hover:bg-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${mode === GameMode.VS_CPU ? 'bg-orange-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">Robot Duel (Human vs CPU)</span>
                    {mode === GameMode.VS_CPU && <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded font-mono uppercase font-bold">Active</span>}
                  </div>
                  <span className="block text-xs text-slate-400">Go head-to-head with the computer bot! Take turns launching the ball.</span>
                </div>
              </button>
            </div>
          </div>

          {/* Column 2: Audio & Custom Song Upload */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <Music className="w-3.5 h-3.5 text-orange-500" />
              Audio & Custom Music
            </h3>

            {/* Quick Toggle Switches */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                id="toggle-music-btn"
                onClick={toggleMusic}
                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-medium transition-all ${
                  audioSettings.musicEnabled
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-slate-950/40 border-slate-850 text-slate-500'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Music className="w-4 h-4 text-orange-400" />
                  Music
                </span>
                <span className={`w-8 h-4 rounded-full p-0.5 transition-colors ${audioSettings.musicEnabled ? 'bg-orange-500' : 'bg-slate-700'}`}>
                  <span className={`block w-3 h-3 rounded-full bg-white transition-transform ${audioSettings.musicEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </span>
              </button>

              <button
                id="toggle-sfx-btn"
                onClick={toggleSfx}
                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-medium transition-all ${
                  audioSettings.sfxEnabled
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-slate-950/40 border-slate-850 text-slate-500'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-orange-400" />
                  SFX
                </span>
                <span className={`w-8 h-4 rounded-full p-0.5 transition-colors ${audioSettings.sfxEnabled ? 'bg-orange-500' : 'bg-slate-700'}`}>
                  <span className={`block w-3 h-3 rounded-full bg-white transition-transform ${audioSettings.sfxEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </span>
              </button>

              <button
                id="toggle-humman-btn"
                onClick={() => setHummanEnabled(!hummanEnabled)}
                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-medium transition-all ${
                  hummanEnabled
                    ? 'bg-orange-500/10 border-orange-500/50 text-white'
                    : 'bg-slate-950/40 border-slate-850 text-slate-500'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-orange-400" />
                  Humman
                </span>
                <span className={`w-8 h-4 rounded-full p-0.5 transition-colors ${hummanEnabled ? 'bg-orange-500' : 'bg-slate-700'}`}>
                  <span className={`block w-3 h-3 rounded-full bg-white transition-transform ${hummanEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </span>
              </button>

              <button
                id="toggle-blocking-btn"
                onClick={() => setShotBlockingEnabled(!shotBlockingEnabled)}
                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-medium transition-all ${
                  shotBlockingEnabled
                    ? 'bg-orange-500/10 border-orange-500/50 text-white'
                    : 'bg-slate-950/40 border-slate-850 text-slate-500'
                }`}
                title={shotBlockingEnabled ? "Disable defender blocking" : "Enable defender blocking"}
              >
                <span className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-orange-400" />
                  Blocking
                </span>
                <span className={`w-8 h-4 rounded-full p-0.5 transition-colors ${shotBlockingEnabled ? 'bg-orange-500' : 'bg-slate-700'}`}>
                  <span className={`block w-3 h-3 rounded-full bg-white transition-transform ${shotBlockingEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </span>
              </button>
            </div>

            {/* Custom Ball Size Controller */}
            <div className="bg-slate-950/50 rounded-xl p-3.5 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-orange-500" />
                  Custom Ball Radius
                </span>
                <span className="text-xs font-mono font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded">
                  {ballRadius}px
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Adjust the size of the basketball. A smaller ball makes it easier for the bot's human and yourself to shoot and score clean points!
              </p>
              
              <div className="flex items-center gap-4 py-1.5">
                <input
                  type="range"
                  min="8"
                  max="24"
                  step="1"
                  value={ballRadius}
                  onChange={(e) => setBallRadius(parseInt(e.target.value, 10))}
                  className="flex-1 accent-orange-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  id="ball-size-slider"
                />
                <div 
                  className="w-10 h-10 rounded-full bg-orange-500 border border-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/10 text-lg transition-transform duration-200"
                  style={{ transform: `scale(${ballRadius / 18})` }}
                  title="Actual Size Scale"
                >
                  🏀
                </div>
              </div>
            </div>

            {/* Custom Background Music Section */}
            <div className="bg-slate-950/50 rounded-xl p-3.5 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Custom Game Soundtrack</span>
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" title="Upload any .mp3 or .wav song file. It will play on repeat in the background!" />
              </div>
              <p className="text-[11px] text-slate-500">
                You can upload any song from your computer to use as the background music, fulfilling "the background music will be the song I put down".
              </p>

              {/* Upload Selector */}
              <div className="flex gap-2 items-center">
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  ref={fileInputRef}
                  className="hidden"
                  id="music-file-uploader"
                />
                <button
                  id="trigger-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2 shadow"
                >
                  <Upload className="w-3.5 h-3.5 text-orange-400" />
                  <span>Choose Song file...</span>
                </button>

                {uploadedSong && (
                  <button
                    id="clear-custom-song-btn"
                    onClick={clearCustomSong}
                    className="px-2 py-1 bg-red-950/30 border border-red-900/50 text-red-400 text-[10px] rounded hover:bg-red-900/40 transition-all font-mono"
                  >
                    Use Built-in Synth
                  </button>
                )}
              </div>

              {uploadedSong && (
                <div className="text-[11px] font-mono text-emerald-400 truncate flex items-center gap-1 bg-emerald-950/20 border border-emerald-900/30 px-2 py-1 rounded">
                  <span className="animate-pulse">●</span> Currently Playing: {uploadedSong}
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Pro Player Shop & Save */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-orange-500" />
                Locker Room Shop
              </h3>
              {/* Money counter */}
              <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full font-mono">
                <Coins className="w-3.5 h-3.5" />
                ${money}
              </div>
            </div>

            {/* Shop Promo Card */}
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col items-center text-center space-y-2.5">
              <span className="text-3xl animate-bounce">👑</span>
              <div>
                <h4 className="text-xs font-bold text-slate-200">The Shop has Moved!</h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  We upgraded the shop to a standalone dedicated popup modal. Tap the glowing gold button in the main bar anytime!
                </p>
              </div>
              <button
                onClick={onOpenShop}
                className="w-full py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] font-mono tracking-wider transition-all"
              >
                OPEN LOCKER ROOM SHOP
              </button>
            </div>

            {/* Manual Save Button */}
            <div className="pt-1">
              <button
                onClick={handleManualSave}
                className={`w-full py-2 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                  isSaveFlash
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 animate-pulse'
                    : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                }`}
              >
                {isSaveFlash ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>PROGRESS SAVED!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-orange-400" />
                    <span>SAVE PROGRESS</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      )}
    </header>
  );
}
