import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Coins, 
  X, 
  Sparkles, 
  Check, 
  Flame, 
  Zap, 
  Crown, 
  Eye, 
  TrendingUp 
} from 'lucide-react';
import { gameAudio } from '../lib/audio';

interface ShopItem {
  id: string;
  name: string;
  cost: number;
  category: 'trail' | 'hat' | 'weight' | 'bounce';
  desc: string;
  emoji: string;
  color: string;
  accentBg: string;
}

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
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
}

const SHOP_ITEMS: ShopItem[] = [
  { id: 'gold_trail', name: 'Golden Spark Trail', cost: 150, category: 'trail', desc: 'Dazzling gold dust trailing behind the ball', emoji: '💫', color: 'text-amber-400', accentBg: 'bg-amber-500/10' },
  { id: 'cyberpunk_hat', name: 'Cyberpunk Visor', cost: 200, category: 'hat', desc: 'Sleek neon headset with glowing purple visor', emoji: '🕶️', color: 'text-purple-400', accentBg: 'bg-purple-500/10' },
  { id: 'featherweight', name: 'Feather Ball physics', cost: 250, category: 'weight', desc: 'Reduces ball mass so it flies higher and easier', emoji: '🪶', color: 'text-sky-400', accentBg: 'bg-sky-500/10' },
  { id: 'super_bouncy', name: 'Super Bounce physics', cost: 350, category: 'bounce', desc: 'Unlocks elastic high-rebound ball dynamics', emoji: '⚡', color: 'text-emerald-400', accentBg: 'bg-emerald-500/10' },
  { id: 'crown', name: 'Kings Golden Crown', cost: 500, category: 'hat', desc: 'Studded real-gold crown with custom gemstone overlays', emoji: '👑', color: 'text-yellow-400', accentBg: 'bg-yellow-500/10' },
];

export default function ShopModal({
  isOpen,
  onClose,
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
}: ShopModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"
          id="shop-modal-backdrop"
        />

        {/* Modal Window */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative z-10"
          id="shop-modal-content"
        >
          {/* Header */}
          <div className="p-6 bg-gradient-to-b from-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-orange-500/15 text-orange-400 rounded-xl">
                <ShoppingBag className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-wider text-white">Locker Room Shop</h2>
                <p className="text-xs text-slate-400">Unlock customization cosmetics & ball physics</p>
              </div>
            </div>
            
            {/* Close button */}
            <button 
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
              id="shop-modal-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Subheader info panel (Restock timer and Wallet) */}
          <div className="px-6 py-4 bg-slate-950/40 border-b border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Automatic Restocking */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Restocking in:</span>
              <span className="font-mono text-orange-400 font-bold bg-orange-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span className="animate-spin text-[10px]">⏳</span> 
                {`${Math.floor(restockTime / 60)}:${restockTime % 60 < 10 ? '0' : ''}${restockTime % 60}`}
              </span>
            </div>

            {/* Wallet Cash Balance */}
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-extrabold px-3.5 py-1 rounded-full font-mono shadow-md shadow-amber-500/5">
              <Coins className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>Balance:</span>
              <span className="text-white">${money}</span>
            </div>
          </div>

          {/* Body items list */}
          <div className="p-6 max-h-[360px] overflow-y-auto space-y-3 custom-scrollbar">
            {SHOP_ITEMS.map((item) => {
              const stock = shopStock[item.id] ?? 0;
              const isUnlocked = unlockedItems.includes(item.id);
              
              // Active check
              let isActive = false;
              if (item.category === 'trail') isActive = activeTrail === item.id;
              else if (item.category === 'hat') isActive = activeHat === item.id;
              else if (item.category === 'weight') isActive = activeWeight === item.id;
              else if (item.category === 'bounce') isActive = activeBounce === item.id;

              const buyItem = () => {
                if (money >= item.cost && stock > 0) {
                  setMoney(prev => prev - item.cost);
                  setUnlockedItems(prev => [...prev, item.id]);
                  setShopStock(prev => ({ ...prev, [item.id]: Math.max(0, stock - 1) }));
                  try { gameAudio.playChimeSound(); } catch (e) {}
                }
              };

              const equipItem = () => {
                if (item.category === 'trail') {
                  setActiveTrail(isActive ? 'default' : item.id);
                } else if (item.category === 'hat') {
                  setActiveHat(isActive ? 'none' : item.id);
                } else if (item.category === 'weight') {
                  setActiveWeight(isActive ? 'normal' : item.id);
                } else if (item.category === 'bounce') {
                  setActiveBounce(isActive ? 'normal' : item.id);
                }
                try { gameAudio.playRimSound(); } catch (e) {}
              };

              return (
                <div 
                  key={item.id} 
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                    isActive 
                      ? 'bg-slate-800/40 border-orange-500/50 shadow-md shadow-orange-500/5' 
                      : 'bg-slate-950/30 border-slate-800/60 hover:border-slate-700/80'
                  }`}
                >
                  {/* Left info */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-inner ${item.accentBg}`}>
                      <span>{item.emoji}</span>
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-slate-200 text-sm truncate">{item.name}</h4>
                        {!isUnlocked && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold font-mono uppercase ${
                            stock > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {stock > 0 ? `Stock: ${stock}` : 'OUT OF STOCK'}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5 leading-tight">{item.desc}</p>
                    </div>
                  </div>

                  {/* Right Button Action */}
                  <div className="flex-shrink-0">
                    {isUnlocked ? (
                      <button
                        onClick={equipItem}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1 ${
                          isActive
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20 hover:bg-orange-400'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {isActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        {isActive ? 'EQUIPPED' : 'EQUIP'}
                      </button>
                    ) : (
                      <button
                        onClick={buyItem}
                        disabled={money < item.cost || stock === 0}
                        className={`px-4 py-2 rounded-xl text-xs font-extrabold font-mono transition-all flex items-center gap-1 ${
                          money >= item.cost && stock > 0
                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-500/10 hover:scale-102'
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>${item.cost}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer instruction */}
          <div className="p-4 bg-slate-950/40 border-t border-slate-800/60 text-center text-[11px] text-slate-500">
            Customize your play style! Make shots during the game to earn cash rewards.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
