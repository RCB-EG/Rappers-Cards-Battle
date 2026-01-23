
import React, { useState, useEffect, useRef } from 'react';
import { GameState, BattleCard, OnlineBattleState, Rarity, ActiveEffect, BattleAction } from '../../types';
import Button from '../Button';
import Modal from '../modals/Modal';
import BattleCardRender from '../battle/BattleCardRender';
import { db, auth } from '../../firebaseConfig';
import { doc, onSnapshot, updateDoc, deleteDoc, collection, query, where, getDocs, runTransaction, limit, orderBy } from 'firebase/firestore';
import { sfx } from '../../data/sounds';
import { playBattleTheme, stopBattleTheme } from '../../utils/sound';
import { SUPERPOWER_DESC } from './Battle';

interface PvPBattleProps {
    gameState: GameState;
    preparedTeam: BattleCard[];
    onBattleEnd: (reward: number, isWin: boolean) => void;
    onExit: () => void;
    playSfx: (key: keyof typeof sfx) => void;
    musicVolume: number;
    musicOn: boolean;
    initialBattleId?: string; // New prop for friend invites
    blitzMode?: boolean; // New prop for Blitz Mode
}

// Animation Types
interface Projectile {
    id: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    rarity: Rarity;
    isCrit: boolean;
    type: 'orb' | 'beam' | 'note' | 'mic';
}

interface FloatingText {
    id: number;
    x: number;
    y: number;
    text: string;
    color: string;
    scale: number;
    life: number;
}

interface HitParticle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    life: number;
    size: number;
    type: 'spark' | 'smoke' | 'debris' | 'star';
}

interface SpecialEffect {
    id: number;
    type: 'shockwave' | 'lightning' | 'spotlight' | 'slash' | 'notes' | 'poison-cloud' | 'heal-aura' | 'impact-burst';
    x?: number;
    y?: number;
    scale?: number;
}

const formatTime = (ms: number) => {
    if (ms < 0) ms = 0;
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs.toString().padStart(2, '0')}`;
};

const PvPBattle: React.FC<PvPBattleProps> = ({ gameState, preparedTeam, onBattleEnd, onExit, playSfx, musicVolume, musicOn, initialBattleId, blitzMode = false }) => {
    const [battleId, setBattleId] = useState<string | null>(initialBattleId || null);
    const [battleState, setBattleState] = useState<OnlineBattleState | null>(null);
    const [status, setStatus] = useState<'lobby' | 'searching' | 'preparing' | 'active' | 'finished'>(initialBattleId ? 'preparing' : 'lobby');
    const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
    const [selectedAction, setSelectedAction] = useState<string>('standard');
    const [searchTime, setSearchTime] = useState(0);
    const [showForfeitModal, setShowForfeitModal] = useState(false);
    
    // Animation State
    const [projectiles, setProjectiles] = useState<Projectile[]>([]);
    const [specialEffects, setSpecialEffects] = useState<SpecialEffect[]>([]);
    const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
    const [hitParticles, setHitParticles] = useState<HitParticle[]>([]);
    const [shakeCardId, setShakeCardId] = useState<string | null>(null);
    const [shakeIntensity, setShakeIntensity] = useState<number>(0);
    
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const animationFrameRef = useRef<number | null>(null);
    const lastProcessedMoveRef = useRef<number>(0);

    // Initial Team Setup
    const myTeam = React.useMemo(() => {
        return preparedTeam.map((card, i) => ({
            ...card,
            instanceId: `${auth.currentUser?.uid}-${i}-${card.id}`
        }));
    }, [preparedTeam]);

    // --- Audio ---
    useEffect(() => {
        if (status === 'active') playBattleTheme(musicVolume, musicOn);
        else stopBattleTheme(musicVolume, musicOn);
        return () => stopBattleTheme(musicVolume, musicOn);
    }, [status, musicVolume, musicOn]);

    // --- Animation Loop ---
    useEffect(() => {
        let lastTime = performance.now();
        const loop = (time: number) => {
            const dt = (time - lastTime) / 1000;
            lastTime = time;
            
            setHitParticles(prev => prev.map(p => ({
                ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.3, vx: p.vx * 0.95, life: p.life - dt * 2, size: p.size * 0.95
            })).filter(p => p.life > 0));

            setFloatingTexts(prev => prev.map(ft => ({
                ...ft, y: ft.y - 1, life: ft.life - dt
            })).filter(ft => ft.life > 0));

            animationFrameRef.current = window.requestAnimationFrame(loop);
        };
        animationFrameRef.current = window.requestAnimationFrame(loop);
        return () => { if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current); };
    }, []);

    // --- Helpers (Same as Battle.tsx for consistency) ---
    const spawnParticles = (x: number, y: number, color: string, amount: number) => {
        const particles: HitParticle[] = [];
        for (let i = 0; i < amount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 2;
            particles.push({
                id: Date.now() + Math.random(), x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                color, life: 1.0 + Math.random() * 0.5, size: Math.random() * 6 + 2, type: 'spark'
            });
        }
        setHitParticles(prev => [...prev, ...particles]);
    };

    const showFloatText = (x: number, y: number, text: string, color: string, scale = 1) => {
        setFloatingTexts(prev => [...prev, { id: Date.now() + Math.random(), x, y, text, color, scale, life: 1.5 }]);
    };

    const triggerSpecialEffect = (type: SpecialEffect['type'], x?: number, y?: number, scale = 1) => {
        const id = Date.now() + Math.random();
        setSpecialEffects(prev => [...prev, { id, type, x, y, scale }]);
        setTimeout(() => setSpecialEffects(prev => prev.filter(e => e.id !== id)), 1500);
    };

    const isTargetable = (target: BattleCard, targetTeam: BattleCard[]) => {
        if (target.currentHp <= 0) return false;
        
        const activeTeammates = targetTeam.filter(c => c.currentHp > 0);
        if (activeTeammates.length > 1 && target.activeEffects.some(e => e.type === 'untargetable')) return false;
        
        const taunters = activeTeammates.filter(c => c.activeEffects.some(e => e.type === 'taunt'));
        if (taunters.length > 0) {
            return taunters.some(c => c.instanceId === target.instanceId);
        }
        
        const defenders = activeTeammates.filter(c => c.mode === 'defense');
        if (defenders.length > 0) {
            if (target.mode !== 'defense') return false;
        }
        
        return true;
    };

    // --- Matchmaking ---
    useEffect(() => {
        let interval: any;
        if (status === 'searching') interval = setInterval(() => setSearchTime(t => t + 1), 1000);
        else setSearchTime(0);
        return () => clearInterval(interval);
    }, [status]);

    useEffect(() => {
        return () => {
            if (status === 'searching' && auth.currentUser) {
                deleteDoc(doc(db, 'matchmaking_queue', auth.currentUser.uid)).catch(console.error);
            }
        };
    }, [status]);

    const findMatch = async () => {
        if (!auth.currentUser) return;
        if (myTeam.length < 5) {
            alert("Error: Team not loaded. Please re-select your squad.");
            onExit();
            return;
        }

        setStatus('searching');
        playSfx('buttonClick');

        try {
            await runTransaction(db, async (transaction) => {
                let q = query(collection(db, 'matchmaking_queue'), orderBy('timestamp', 'asc'), limit(5));
                
                const snapshot = await getDocs(q);
                let opponentDoc = null;
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (doc.id !== auth.currentUser?.uid) {
                        // Basic matching logic
                        if (blitzMode) {
                            if (data.mode === 'blitz' && data.blitzRank === (gameState.blitzRank || 5)) {
                                opponentDoc = doc;
                            }
                        } else {
                            if (!data.mode || data.mode === 'standard') {
                                opponentDoc = doc;
                            }
                        }
                    }
                });

                if (opponentDoc) {
                    const opponentData = (opponentDoc as any).data();
                    const newBattleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    const battleRef = doc(db, 'battles', newBattleId);
                    
                    const initialState: OnlineBattleState = {
                        id: newBattleId,
                        mode: blitzMode ? 'blitz' : 'standard',
                        player1: { 
                            uid: opponentData.userId, 
                            username: opponentData.username, 
                            avatar: opponentData.avatar || null,
                            team: opponentData.team 
                        },
                        player2: { 
                            uid: auth.currentUser!.uid, 
                            username: gameState.userProfile?.username || 'Player 2', 
                            avatar: gameState.userProfile?.avatar || null,
                            team: myTeam 
                        },
                        player1TimeRemaining: 120000, // 2 mins
                        player2TimeRemaining: 120000,
                        turn: opponentData.userId,
                        winner: null,
                        lastMoveTimestamp: Date.now(),
                        lastAction: null,
                        logs: ['Battle Started!'],
                        status: 'active'
                    };

                    transaction.set(battleRef, initialState);
                    transaction.delete((opponentDoc as any).ref);
                    setBattleId(newBattleId);
                } else {
                    const myRef = doc(db, 'matchmaking_queue', auth.currentUser!.uid);
                    transaction.set(myRef, {
                        userId: auth.currentUser!.uid,
                        username: gameState.userProfile?.username || 'Player 1',
                        avatar: gameState.userProfile?.avatar || null,
                        team: myTeam,
                        mode: blitzMode ? 'blitz' : 'standard',
                        blitzRank: blitzMode ? (gameState.blitzRank || 5) : null,
                        timestamp: Date.now()
                    });
                }
            });
        } catch (e: any) {
            console.error("Matchmaking error:", e);
            if (e.code === 'permission-denied') alert("Database Permission Error: Please update Firebase Rules.");
            setStatus('lobby');
        }
    };

    useEffect(() => {
        let unsubscribe: () => void;
        if (status === 'searching' && auth.currentUser) {
            const q = query(collection(db, 'battles'), where('player1.uid', '==', auth.currentUser.uid), where('status', '==', 'active'));
            unsubscribe = onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data() as OnlineBattleState;
                        if (Date.now() - data.lastMoveTimestamp < 120000) {
                            setBattleId(data.id);
                        }
                    }
                });
            });
        }
        return () => { if (unsubscribe) unsubscribe(); }
    }, [status]);

    useEffect(() => {
        if (!battleId) return;
        const unsub = onSnapshot(doc(db, 'battles', battleId), (doc) => {
            if (doc.exists()) {
                const data = doc.data() as OnlineBattleState;
                setBattleState(data);
                setStatus(data.status);
                
                // Visual FX triggers from lastAction
                if (data.lastAction && data.lastMoveTimestamp !== lastProcessedMoveRef.current) {
                    lastProcessedMoveRef.current = data.lastMoveTimestamp;
                    
                    // Shake target
                    if (data.lastAction.targetId) {
                        setShakeCardId(data.lastAction.targetId);
                        setShakeIntensity(data.lastAction.isCrit ? 2 : 1);
                        setTimeout(() => setShakeCardId(null), 500);
                        
                        // Particles
                        const targetNode = cardRefs.current[data.lastAction.targetId];
                        if (targetNode) {
                            const rect = targetNode.getBoundingClientRect();
                            const cx = rect.left + rect.width / 2;
                            const cy = rect.top + rect.height / 2;
                            spawnParticles(cx, cy, data.lastAction.isCrit ? '#ff0000' : '#ffffff', 20);
                            showFloatText(cx, cy - 50, `-${data.lastAction.damage}`, data.lastAction.isCrit ? '#ff0000' : '#fff', data.lastAction.isCrit ? 2 : 1.2);
                        }
                        
                        // Play sound based on action type
                        // We use the lastAction.actionType string (superpower name) or infer standard attack
                        const actType = data.lastAction.actionType;
                        if (actType && actType !== 'standard') {
                            // Map superpower name to sound key
                            if (actType.includes('Chopper')) playSfx('spChopper');
                            else if (actType.includes('Show Maker') || actType.includes('ShowMaker')) playSfx('spShowMaker');
                            else if (actType.includes('Rhyme')) playSfx('spRhymesCrafter');
                            else if (actType.includes('Punchline')) playSfx('spPunchline');
                            else if (actType.includes('Words') || actType.includes('Word')) playSfx('spWordsBender');
                            else if (actType.includes('Career')) playSfx('spCareerKiller');
                            else if (actType.includes('Flow')) playSfx('spFlowSwitcher');
                            else if (actType.includes('Freestyle')) playSfx('spFreestyler');
                            else if (actType.includes('Artist')) playSfx('spTheArtist');
                            else playSfx('battleBuff'); // Fallback for buff/debuff
                        } else {
                            // Standard attack sound based on rarity
                            const r = data.lastAction.rarity;
                            switch(r) {
                                case 'bronze': 
                                case 'silver': playSfx('attackBronzeSilver'); break;
                                case 'gold': playSfx('attackGold'); break;
                                case 'rotm': playSfx('attackRotm'); break;
                                case 'icon': playSfx('attackIcon'); break;
                                case 'legend': playSfx('attackIcon'); break;
                                default: playSfx('attackGold');
                            }
                        }
                    }
                }

                if (data.winner) {
                    const isWin = data.winner === auth.currentUser?.uid;
                    onBattleEnd(isWin ? 200 : 50, isWin); // Simple fixed reward for now
                }
            }
        });
        return () => unsub();
    }, [battleId]);

    const executeAction = async (target: BattleCard) => {
        if (!battleId || !battleState || !auth.currentUser || battleState.turn !== auth.currentUser.uid || !selectedAttackerId) return;
        
        try {
            const attacker = (battleState.player1.uid === auth.currentUser.uid ? battleState.player1.team : battleState.player2.team).find(c => c.instanceId === selectedAttackerId);
            if (!attacker) return;

            // Optimistic Update (Prevent double click)
            setSelectedAttackerId(null); 

            // Calculate damage
            let damage = attacker.atk;
            const isCrit = Math.random() < 0.15;
            if (isCrit) damage = Math.floor(damage * 1.5);
            if (selectedAction === 'Freestyler') damage = Math.random() > 0.5 ? damage * 3 : 0;

            // Apply to Firestore
            // Note: In a real app, this logic should be cloud function to prevent cheating.
            // Here we trust the client for simplicity.
            
            await runTransaction(db, async (transaction) => {
                const battleRef = doc(db, 'battles', battleId);
                const freshDoc = await transaction.get(battleRef);
                if (!freshDoc.exists()) throw "Battle ended";
                
                const currentData = freshDoc.data() as OnlineBattleState;
                if (currentData.turn !== auth.currentUser?.uid) throw "Not your turn";

                const isP1 = currentData.player1.uid === auth.currentUser.uid;
                const enemyTeamKey = isP1 ? 'player2' : 'player1';
                const enemyTeam = isP1 ? currentData.player2.team : currentData.player1.team;
                
                const targetIndex = enemyTeam.findIndex(c => c.instanceId === target.instanceId);
                if (targetIndex === -1) throw "Target not found";

                const newEnemyTeam = [...enemyTeam];
                const newTarget = { ...newEnemyTeam[targetIndex] };
                newTarget.currentHp = Math.max(0, newTarget.currentHp - damage);
                newEnemyTeam[targetIndex] = newTarget;

                // Check Win
                const enemyAlive = newEnemyTeam.some(c => c.currentHp > 0);
                const winner = !enemyAlive ? auth.currentUser!.uid : null;

                const actionData: BattleAction = {
                    attackerId: attacker.instanceId,
                    targetId: target.instanceId,
                    actionType: selectedAction,
                    damage,
                    isCrit,
                    timestamp: Date.now(),
                    rarity: attacker.rarity
                };

                transaction.update(battleRef, {
                    [`${enemyTeamKey}.team`]: newEnemyTeam,
                    turn: isP1 ? currentData.player2.uid : currentData.player1.uid,
                    lastAction: actionData,
                    lastMoveTimestamp: Date.now(),
                    logs: [`${attacker.name} hit ${target.name} for ${damage}!`, ...currentData.logs.slice(0, 4)],
                    winner: winner,
                    status: winner ? 'finished' : 'active'
                });
            });
            
            // Note: Sound plays via onSnapshot update for consistency with opponent moves

        } catch (e) {
            console.error("Move failed:", e);
        }
    };

    const handleForfeit = async () => {
        if (!battleId || !battleState || !auth.currentUser) return;
        try {
            const opponentId = battleState.player1.uid === auth.currentUser.uid ? battleState.player2.uid : battleState.player1.uid;
            await updateDoc(doc(db, 'battles', battleId), {
                winner: opponentId,
                status: 'finished',
                logs: [`${auth.currentUser.uid === battleState.player1.uid ? battleState.player1.username : battleState.player2.username} forfeited!`, ...battleState.logs]
            });
        } catch (e) { console.error(e); }
    };

    if (status === 'lobby') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fadeIn">
                <h2 className="font-header text-4xl text-white">Online Lobby</h2>
                <div className="bg-black/40 p-6 rounded-xl border border-gold-dark/30 text-center max-w-md">
                    <p className="text-gray-300 mb-4">Find a worthy opponent and battle for glory!</p>
                    <div className="flex gap-4 justify-center">
                        <Button variant="default" onClick={onExit}>Back</Button>
                        <Button variant="cta" onClick={findMatch}>Find Match</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (status === 'searching') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-pulse">
                <h2 className="font-header text-4xl text-gold-light">Searching...</h2>
                <div className="w-16 h-16 border-4 border-gold-dark border-t-gold-light rounded-full animate-spin"></div>
                <p className="text-gray-400 font-mono">{formatTime(searchTime * 1000)}</p>
                <Button variant="sell" onClick={() => setStatus('lobby')}>Cancel</Button>
            </div>
        );
    }

    if (status === 'preparing' || status === 'active' || status === 'finished') {
        if (!battleState || !auth.currentUser) return <div className="text-center text-white">Loading Battle State...</div>;

        const isP1 = battleState.player1.uid === auth.currentUser.uid;
        const myData = isP1 ? battleState.player1 : battleState.player2;
        const oppData = isP1 ? battleState.player2 : battleState.player1;
        const isMyTurn = battleState.turn === auth.currentUser.uid;

        return (
            <div className="relative w-full max-w-6xl mx-auto min-h-[80vh] flex flex-col justify-between py-4 animate-fadeIn">
                {/* Forfeit Button */}
                {!battleState.winner && (
                    <div className="absolute top-0 right-0 z-[60]">
                        <Button variant="sell" onClick={() => setShowForfeitModal(true)} className="py-1 px-3 text-xs bg-red-900/80 border-red-700 hover:bg-red-800">
                            Give Up
                        </Button>
                    </div>
                )}

                {/* Confirm Forfeit Modal */}
                <Modal isOpen={showForfeitModal} onClose={() => setShowForfeitModal(false)} title="Give Up?">
                    <p className="text-white mb-6">Are you sure you want to forfeit? This will count as a loss.</p>
                    <div className="flex justify-center gap-4">
                        <Button variant="sell" onClick={handleForfeit}>Yes, I Give Up</Button>
                        <Button variant="default" onClick={() => setShowForfeitModal(false)}>Cancel</Button>
                    </div>
                </Modal>

                {/* Particles & Effects Layers */}
                {hitParticles.map(p => (
                    <div key={p.id} className="fixed rounded-full pointer-events-none z-50" 
                        style={{ left: p.x, top: p.y, width: p.size, height: p.size, backgroundColor: p.color, opacity: Math.min(1, p.life) }} />
                ))}
                {floatingTexts.map(ft => (
                    <div key={ft.id} className="fixed text-4xl font-header font-bold z-50 pointer-events-none drop-shadow-md transition-transform" 
                        style={{ left: ft.x, top: ft.y, color: ft.color, transform: `scale(${ft.scale})` }}>{ft.text}</div>
                ))}

                {/* Opponent Team (Top) */}
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-3 mb-2 bg-black/50 px-4 py-1 rounded-full border border-red-900/50">
                        <img src={oppData.avatar || 'https://api.dicebear.com/8.x/bottts/svg?seed=opp'} className="w-8 h-8 rounded-full bg-gray-700" />
                        <span className="text-red-400 font-bold">{oppData.username}</span>
                    </div>
                    <div className="flex justify-center gap-2 md:gap-4 flex-wrap">
                        {oppData.team.map(card => {
                            const targetable = isMyTurn && selectedAttackerId && isTargetable(card, oppData.team);
                            return (
                                <BattleCardRender 
                                    key={card.instanceId} 
                                    card={card} 
                                    isInteractable={!!targetable} 
                                    shakeIntensity={shakeCardId === card.instanceId ? shakeIntensity : 0} 
                                    onRef={(el) => cardRefs.current[card.instanceId] = el}
                                    onClick={() => executeAction(card)}
                                    smallScale={true}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Battle Info / Turn Indicator */}
                <div className="flex flex-col items-center justify-center gap-4 my-2">
                    <div className={`text-2xl font-header px-8 py-2 rounded-full border-2 transition-all shadow-lg ${isMyTurn ? 'bg-blue-600/80 border-blue-400 text-white scale-110' : 'bg-red-900/50 border-red-800 text-gray-300'}`}>
                        {battleState.winner ? (battleState.winner === auth.currentUser.uid ? "VICTORY!" : "DEFEAT") : (isMyTurn ? "YOUR TURN" : "OPPONENT'S TURN")}
                    </div>
                    <div className="text-xs text-gray-400 bg-black/60 px-3 py-1 rounded border border-gray-700">{battleState.logs[0]}</div>
                </div>

                {/* My Team (Bottom) */}
                <div className="flex flex-col items-center">
                    <div className="flex justify-center gap-2 md:gap-4 flex-wrap mb-4">
                        {myData.team.map(card => {
                            const canAct = isMyTurn && card.currentHp > 0 && !card.activeEffects.some(e => e.type === 'stun');
                            return (
                                <BattleCardRender 
                                    key={card.instanceId} 
                                    card={card} 
                                    isInteractable={canAct} 
                                    isSelected={selectedAttackerId === card.instanceId}
                                    shakeIntensity={shakeCardId === card.instanceId ? shakeIntensity : 0} 
                                    onRef={(el) => cardRefs.current[card.instanceId] = el}
                                    onClick={() => { if (canAct) setSelectedAttackerId(card.instanceId); }}
                                    smallScale={true}
                                />
                            );
                        })}
                    </div>
                    
                    {/* Controls */}
                    {isMyTurn && selectedAttackerId && (
                        <div className="flex gap-2 bg-black/80 p-2 rounded-lg border border-gold-dark/50 animate-slideUp">
                            <button onClick={() => setSelectedAction('standard')} className={`px-4 py-1 rounded border font-bold text-sm ${selectedAction === 'standard' ? 'bg-white text-black' : 'bg-transparent text-gray-300'}`}>Attack</button>
                            {myData.team.find(c => c.instanceId === selectedAttackerId)?.availableSuperpowers.map(sp => (
                                <button key={sp} onClick={() => setSelectedAction(sp)} className={`px-4 py-1 rounded border font-bold text-sm ${selectedAction === sp ? 'bg-blue-500 text-white' : 'bg-transparent text-blue-300 border-blue-900'}`}>{sp}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
};

export default PvPBattle;
