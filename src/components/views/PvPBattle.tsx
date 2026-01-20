
import React, { useState, useEffect, useRef } from 'react';
import { GameState, BattleCard, OnlineBattleState, Rarity, BattleMode, ActiveEffect } from '../../types';
import Button from '../Button';
import BattleCardRender from '../battle/BattleCardRender';
import { db, auth } from '../../firebaseConfig';
import { doc, onSnapshot, updateDoc, setDoc, deleteDoc, collection, query, where, getDocs, runTransaction, limit, orderBy } from 'firebase/firestore';
import { sfx } from '../../data/sounds';
import { playBattleTheme, stopBattleTheme } from '../../utils/sound';
import { SUPERPOWER_DESC } from './Battle'; // Import Descriptions from Battle

interface PvPBattleProps {
    gameState: GameState;
    preparedTeam: BattleCard[]; // New prop from Battle.tsx
    onBattleEnd: (reward: number, isWin: boolean) => void;
    onExit: () => void;
    playSfx: (key: keyof typeof sfx) => void;
    musicVolume: number;
    musicOn: boolean;
}

// Animation Types (Copied from Battle.tsx for consistency)
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

const PvPBattle: React.FC<PvPBattleProps> = ({ gameState, preparedTeam, onBattleEnd, onExit, playSfx, musicVolume, musicOn }) => {
    const [battleId, setBattleId] = useState<string | null>(null);
    const [battleState, setBattleState] = useState<OnlineBattleState | null>(null);
    const [status, setStatus] = useState<'lobby' | 'searching' | 'active' | 'finished'>('lobby');
    const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
    const [selectedAction, setSelectedAction] = useState<string>('standard');
    const [searchTime, setSearchTime] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    
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

    // Initial Team Setup from Props
    const myTeam = React.useMemo(() => {
        return preparedTeam.map((card, i) => ({
            ...card,
            // Ensure instanceId is unique for online play
            instanceId: `${auth.currentUser?.uid}-${i}-${card.id}`
        }));
    }, [preparedTeam]);

    // --- Audio Management ---
    useEffect(() => {
        if (status === 'active') {
            playBattleTheme(musicVolume, musicOn);
        } else {
            stopBattleTheme(musicVolume, musicOn);
        }
        // Cleanup music on component unmount
        return () => stopBattleTheme(musicVolume, musicOn);
    }, [status, musicVolume, musicOn]);

    // --- Animation Loop ---
    useEffect(() => {
        let lastTime = performance.now();
        const loop = (time: number) => {
            const dt = (time - lastTime) / 1000;
            lastTime = time;
            
            setHitParticles(prev => prev.map(p => ({
                ...p, 
                x: p.x + p.vx, 
                y: p.y + p.vy, 
                vy: p.vy + 0.3, 
                vx: p.vx * 0.95, 
                life: p.life - dt * 2,
                size: p.size * 0.95
            })).filter(p => p.life > 0));

            setFloatingTexts(prev => prev.map(ft => ({
                ...ft,
                y: ft.y - 1,
                life: ft.life - dt
            })).filter(ft => ft.life > 0));

            animationFrameRef.current = window.requestAnimationFrame(loop);
        };
        animationFrameRef.current = window.requestAnimationFrame(loop);
        return () => { if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current); };
    }, []);

    // --- Helper: Visual Effects ---
    const spawnParticles = (x: number, y: number, color: string, amount: number, type: HitParticle['type'] = 'spark') => {
        const newParticles: HitParticle[] = [];
        for (let i = 0; i < amount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 8 + 2;
            newParticles.push({
                id: Date.now() + Math.random(), x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                color, life: 1.0 + Math.random() * 0.5, size: Math.random() * 6 + 2, type
            });
        }
        setHitParticles(prev => [...prev, ...newParticles]);
    };

    const showFloatText = (x: number, y: number, text: string, color: string, scale = 1) => {
        setFloatingTexts(prev => [...prev, { id: Date.now() + Math.random(), x, y, text, color, scale, life: 1.5 }]);
    };

    const triggerSpecialEffect = (type: SpecialEffect['type'], x?: number, y?: number, scale: number = 1) => {
        const id = Date.now() + Math.random();
        setSpecialEffects(prev => [...prev, { id, type, x, y, scale }]);
        setTimeout(() => setSpecialEffects(prev => prev.filter(e => e.id !== id)), 1500);
    };

    // --- Firestore Listeners ---
    // Timer
    useEffect(() => {
        let interval: any;
        if (status === 'searching') interval = setInterval(() => setSearchTime(t => t + 1), 1000);
        else setSearchTime(0);
        return () => clearInterval(interval);
    }, [status]);

    // Cleanup queue on unmount
    useEffect(() => {
        return () => {
            if (status === 'searching' && auth.currentUser) {
                const qRef = doc(db, 'matchmaking_queue', auth.currentUser.uid);
                deleteDoc(qRef).catch(console.error);
            }
        };
    }, [status]);

    const findMatch = async () => {
        if (!auth.currentUser) return;
        setStatus('searching');
        playSfx('buttonClick');

        try {
            await runTransaction(db, async (transaction) => {
                const q = query(collection(db, 'matchmaking_queue'), orderBy('timestamp', 'asc'), limit(1));
                const snapshot = await getDocs(q);
                let opponentDoc = null;
                snapshot.forEach(doc => { if (doc.id !== auth.currentUser?.uid) opponentDoc = doc; });

                if (opponentDoc) {
                    const opponentData = (opponentDoc as any).data();
                    const newBattleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    const battleRef = doc(db, 'battles', newBattleId);
                    
                    const initialState: OnlineBattleState = {
                        id: newBattleId,
                        player1: { uid: opponentData.userId, username: opponentData.username, team: opponentData.team },
                        player2: { uid: auth.currentUser!.uid, username: gameState.userProfile?.username || 'Player 2', team: myTeam },
                        turn: opponentData.userId,
                        winner: null,
                        lastMoveTimestamp: Date.now(),
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
                        team: myTeam,
                        timestamp: Date.now()
                    });
                }
            });
        } catch (e: any) {
            console.error("Matchmaking error:", e);
            if (e.code === 'permission-denied') alert("Check Firebase Rules.");
            setStatus('lobby');
        }
    };

    // Listen for Battle ID assignment
    useEffect(() => {
        let unsubscribe: () => void;
        if (status === 'searching' && auth.currentUser) {
            const q = query(collection(db, 'battles'), where('player1.uid', '==', auth.currentUser.uid), where('status', '==', 'active'));
            unsubscribe = onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    const docData = snapshot.docs[0].data() as OnlineBattleState;
                    setBattleId(docData.id);
                }
            });
        }
        return () => { if (unsubscribe) unsubscribe(); }
    }, [status]);

    // Main Battle Logic & Sync Animation
    useEffect(() => {
        if (!battleId) return;

        const battleRef = doc(db, 'battles', battleId);
        const unsubscribe = onSnapshot(battleRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as OnlineBattleState;
                const prevData = battleState; // Closure captures current state? No, need ref or careful diffing.
                // React state updates are async, so direct comparison here might be tricky without ref.
                // But for simple "new move" check, timestamp is good.
                
                setBattleState(data);
                setStatus('active');

                // --- Trigger Animations based on State Change ---
                if (data.lastMoveTimestamp > lastProcessedMoveRef.current) {
                    lastProcessedMoveRef.current = data.lastMoveTimestamp;
                    
                    // Detect last log to guess action type (a bit hacky but works for MVP)
                    const lastLog = data.logs[0] || '';
                    const isAttack = lastLog.includes('hit') || lastLog.includes('damage');
                    const isSuper = lastLog.includes('uses') || lastLog.includes('superpower');
                    
                    // Find the card that took damage?
                    // We need to know target ID to position effects.
                    // For now, let's just use generic screen shake if it was a big hit
                    if (isAttack) {
                        playSfx('battleAttackMedium');
                        // Ideally we'd pass targetId in Firestore, but for now let's just shake screen lightly
                        // Or if we can find the card whose HP dropped...
                    } else if (isSuper) {
                        playSfx('battleAttackUltimate');
                    }
                }

                if (data.winner) {
                    setStatus('finished');
                    const amIWinner = data.winner === auth.currentUser?.uid;
                    if (amIWinner) playSfx('success');
                    let reward = amIWinner ? Math.floor(500 + (data.player1.team.length + data.player2.team.length) * 10) : 100;
                    onBattleEnd(reward, amIWinner);
                }
            }
        }, (error) => {
            console.error(error);
            if (error.code === 'permission-denied') {
                alert("Permission Error"); 
                onExit();
            }
        });

        return () => unsubscribe();
    }, [battleId]);

    const handleAttack = async (targetId: string | null, actionOverride?: string) => {
        if (!battleState || !auth.currentUser || isAnimating) return;
        if (battleState.turn !== auth.currentUser.uid) return;
        
        // Non-targeted moves can pass null targetId
        const actionName = actionOverride || selectedAction;
        const isTargeted = actionName === 'standard' || !['Chopper', 'Show Maker', 'ShowMaker', 'Notes Master', 'Note Master', 'The Artist', 'Storyteller', 'StoryTeller'].includes(actionName);
        
        if (isTargeted && !targetId && !selectedAttackerId) return;

        setIsAnimating(true);
        const imPlayer1 = battleState.player1.uid === auth.currentUser.uid;
        const mySquad = imPlayer1 ? battleState.player1.team : battleState.player2.team;
        const enemySquad = imPlayer1 ? battleState.player2.team : battleState.player1.team;

        const attacker = mySquad.find(c => c.instanceId === selectedAttackerId);
        if (!attacker) { setIsAnimating(false); return; }

        // --- Execute Logic Locally to Calc Updates ---
        let newEnemySquad = [...enemySquad];
        let newMySquad = [...mySquad];
        let logMsg = '';
        
        // Remove Superpower Charge
        if (actionName !== 'standard') {
            const attackerIdx = newMySquad.findIndex(c => c.instanceId === attacker.instanceId);
            if (attackerIdx > -1) {
                newMySquad[attackerIdx] = {
                    ...newMySquad[attackerIdx],
                    availableSuperpowers: newMySquad[attackerIdx].availableSuperpowers.filter(s => s !== actionName)
                };
            }
        }

        // Logic Switch
        if (actionName === 'standard') {
            const targetIndex = enemySquad.findIndex(c => c.instanceId === targetId);
            if (targetIndex > -1) {
                const damage = Math.floor(attacker.atk * (0.9 + Math.random() * 0.2));
                newEnemySquad[targetIndex] = { ...newEnemySquad[targetIndex], currentHp: Math.max(0, newEnemySquad[targetIndex].currentHp - damage) };
                logMsg = `${attacker.name} hit ${newEnemySquad[targetIndex].name} for ${damage}!`;
                
                // Local Visuals
                playSfx('battleAttackMedium');
                const targetNode = cardRefs.current[targetId!];
                if (targetNode) {
                    const rect = targetNode.getBoundingClientRect();
                    spawnParticles(rect.left + rect.width/2, rect.top + rect.height/2, '#fff', 20);
                    showFloatText(rect.left, rect.top, `-${damage}`, '#ff4444');
                }
            }
        } else if (actionName === 'Chopper') {
            playSfx('battleAttackUltimate');
            triggerSpecialEffect('shockwave');
            const damage = Math.floor(attacker.atk * 0.6);
            newEnemySquad = newEnemySquad.map(c => c.currentHp > 0 ? { ...c, currentHp: Math.max(0, c.currentHp - damage) } : c);
            logMsg = `${attacker.name} used Chopper! AoE ${damage} damage!`;
        } else if (actionName === 'Show Maker' || actionName === 'ShowMaker') {
            playSfx('battleBuff');
            triggerSpecialEffect('spotlight');
            const buffAmt = Math.floor(attacker.atk * 0.3);
            newMySquad = newMySquad.map(c => c.currentHp > 0 ? { ...c, atk: c.atk + buffAmt, activeEffects: [...c.activeEffects, { type: 'buff', duration: 99 } as ActiveEffect] } : c);
            logMsg = `${attacker.name} hypes up the crew! (+${buffAmt} ATK)`;
        } else if (targetId) {
            // Targeted Specials (Rhymes Crafter, etc)
            const targetIndex = enemySquad.findIndex(c => c.instanceId === targetId);
            if (targetIndex > -1) {
                if (actionName.includes('Rhyme')) {
                    newEnemySquad[targetIndex].activeEffects.push({ type: 'poison', duration: 3, val: 50 });
                    logMsg = `${attacker.name} poisoned ${newEnemySquad[targetIndex].name}!`;
                    playSfx('battleDebuff');
                } else if (actionName === 'Punchline Machine') {
                    newEnemySquad[targetIndex].activeEffects.push({ type: 'stun', duration: 2 });
                    logMsg = `${attacker.name} stunned ${newEnemySquad[targetIndex].name}!`;
                    playSfx('battleStun');
                }
                // Add simplified versions of other logic for MVP online
                else {
                    // Fallback attack
                    const damage = Math.floor(attacker.atk * 1.2);
                    newEnemySquad[targetIndex] = { ...newEnemySquad[targetIndex], currentHp: Math.max(0, newEnemySquad[targetIndex].currentHp - damage) };
                    logMsg = `${attacker.name} used ${actionName} on ${newEnemySquad[targetIndex].name}!`;
                }
            }
        }

        const enemyAlive = newEnemySquad.some(c => c.currentHp > 0);
        const nextTurn = enemyAlive ? (imPlayer1 ? battleState.player2.uid : battleState.player1.uid) : battleState.turn;
        const winner = enemyAlive ? null : auth.currentUser.uid;

        const battleRef = doc(db, 'battles', battleState.id);
        const updateData: Partial<OnlineBattleState> = {
            turn: nextTurn,
            logs: [logMsg, ...battleState.logs].slice(0, 5),
            lastMoveTimestamp: Date.now(),
            winner: winner
        };

        if (imPlayer1) {
            updateData.player1 = { ...battleState.player1, team: newMySquad };
            updateData.player2 = { ...battleState.player2, team: newEnemySquad };
        } else {
            updateData.player2 = { ...battleState.player2, team: newMySquad };
            updateData.player1 = { ...battleState.player1, team: newEnemySquad };
        }

        await updateDoc(battleRef, updateData);
        setSelectedAttackerId(null);
        setSelectedAction('standard');
        setIsAnimating(false);
    };

    // RENDER HELPERS
    if (status === 'lobby') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 animate-fadeIn">
                <h2 className="font-header text-5xl text-blue-glow mb-4 drop-shadow-[0_0_10px_#00c7e2]">Casual Online Battle</h2>
                <div className="bg-black/40 p-8 rounded-xl border-2 border-blue-900/50 max-w-md w-full text-center">
                    <p className="text-gray-300 mb-6">Battle real players in real-time. Win BP based on performance.</p>
                    <div className="text-left mb-6 bg-black/30 p-4 rounded text-sm text-gray-400">
                        <p>1. Squad selected from Tactics screen.</p>
                        <p>2. Find match.</p>
                        <p>3. Turn-based combat. 30s per turn.</p>
                    </div>
                    
                    <Button variant="cta" onClick={findMatch} className="w-full text-xl py-4 shadow-blue-glow">
                        Find Match
                    </Button>
                    <Button variant="default" onClick={onExit} className="w-full mt-4">
                        Back to Menu
                    </Button>
                </div>
            </div>
        );
    }

    if (status === 'searching') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 animate-fadeIn">
                <div className="w-24 h-24 border-t-4 border-blue-glow rounded-full animate-spin"></div>
                <h3 className="font-header text-3xl text-white">Searching for Opponent...</h3>
                <p className="text-xl text-gray-400 font-mono">{searchTime}s</p>
                <Button variant="sell" onClick={() => setStatus('lobby')}>Cancel</Button>
            </div>
        );
    }

    if (status === 'active' && battleState && auth.currentUser) {
        const imPlayer1 = battleState.player1.uid === auth.currentUser.uid;
        const mySquad = imPlayer1 ? battleState.player1.team : battleState.player2.team;
        const enemySquad = imPlayer1 ? battleState.player2.team : battleState.player1.team;
        const enemyName = imPlayer1 ? battleState.player2.username : battleState.player1.username;
        const isMyTurn = battleState.turn === auth.currentUser.uid;
        
        const activeAttacker = selectedAttackerId ? mySquad.find(c => c.instanceId === selectedAttackerId) : null;

        return (
            <div className="relative w-full max-w-6xl mx-auto min-h-[80vh] flex flex-col justify-between py-4 animate-fadeIn">
                
                {/* CSS for Effects */}
                <style>{`
                    .projectile-container { position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 50; pointer-events: none; }
                    .impact-burst { position: fixed; width: 100px; height: 100px; background: radial-gradient(circle, #fff 10%, transparent 70%); animation: impact-explode 0.4s ease-out forwards; pointer-events: none; z-index: 60; }
                    @keyframes impact-explode { 0% { transform: scale(0.2); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
                    @keyframes floatUp { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-80px); opacity: 0; } }
                `}</style>

                {hitParticles.map(p => (
                    <div key={p.id} className="fixed rounded-full pointer-events-none z-50" style={{ left: p.x, top: p.y, width: p.size, height: p.size, backgroundColor: p.color, opacity: Math.min(1, p.life) }} />
                ))}
                {floatingTexts.map(ft => (
                    <div key={ft.id} className="fixed text-4xl font-header font-bold z-50 pointer-events-none" style={{ left: ft.x, top: ft.y, color: ft.color, animation: 'floatUp 1.5s ease-out forwards' }}>{ft.text}</div>
                ))}

                {/* Enemy Team (Top) */}
                <div className="flex flex-col items-center">
                    <div className="text-red-400 font-header text-xl mb-2">{enemyName}</div>
                    <div className="flex justify-center gap-2 flex-wrap">
                        {enemySquad.map(card => (
                            <BattleCardRender 
                                key={card.instanceId} 
                                card={{...card, owner: 'opponent'}} 
                                isInteractable={isMyTurn && !!selectedAttackerId && (selectedAction === 'standard' || ['Rhymes Crafter', 'Punchline Machine', 'Career Killer'].some(s => selectedAction.includes(s)))} 
                                shakeIntensity={0}
                                onRef={(el) => cardRefs.current[card.instanceId] = el}
                                onClick={() => handleAttack(card.instanceId)}
                                smallScale={true}
                            />
                        ))}
                    </div>
                </div>

                {/* Center Controls / Logs */}
                <div className="flex flex-col items-center justify-center my-4 gap-2 relative min-h-[100px]">
                    <div className={`px-6 py-2 rounded-full font-header text-2xl border-2 transition-colors ${isMyTurn ? 'bg-blue-600/50 border-blue-400 text-white' : 'bg-red-600/50 border-red-400 text-white'}`}>
                        {isMyTurn ? "YOUR TURN" : "ENEMY TURN"}
                    </div>
                    
                    {/* Action Menu if Attacker Selected */}
                    {isMyTurn && activeAttacker ? (
                        <div className="flex gap-2 flex-wrap justify-center animate-fadeIn bg-black/60 p-2 rounded-lg border border-gold-dark/50 z-20">
                            {selectedAction !== 'standard' && (
                                <div className="absolute -top-12 left-0 right-0 text-center text-sm text-gold-light p-1 bg-black/80 rounded">{SUPERPOWER_DESC[selectedAction] || "Ability"}</div>
                            )}
                            <button 
                                onClick={() => setSelectedAction('standard')} 
                                className={`px-3 py-1 rounded border-2 font-bold text-sm ${selectedAction === 'standard' ? 'bg-white text-black border-gold-light' : 'bg-transparent text-gray-300 border-gray-600'}`}
                            >
                                Attack
                            </button>
                            {activeAttacker.availableSuperpowers.map(sp => {
                                const isImmediate = ['Show Maker', 'ShowMaker', 'Chopper', 'Notes Master', 'Note Master', 'The Artist', 'Storyteller', 'StoryTeller'].includes(sp);
                                return (
                                    <button 
                                        key={sp} 
                                        onClick={() => { setSelectedAction(sp); if (isImmediate) handleAttack(null, sp); }} 
                                        className={`px-3 py-1 rounded border-2 font-bold text-sm flex items-center gap-1 ${selectedAction === sp ? 'bg-blue-600 text-white border-blue-300' : 'bg-transparent text-blue-300 border-blue-800'}`}
                                    >
                                        {sp}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center text-gray-300 text-sm font-mono bg-black/40 p-2 rounded min-w-[300px]">
                            {battleState.logs[0] || "Match Started"}
                        </div>
                    )}
                </div>

                {/* My Team (Bottom) */}
                <div className="flex flex-col items-center">
                    <div className="flex justify-center gap-2 flex-wrap">
                        {mySquad.map(card => {
                            const isStunned = card.activeEffects.some(e => e.type === 'stun');
                            const canAct = isMyTurn && card.currentHp > 0 && !isStunned && card.mode === 'attack';
                            return (
                                <BattleCardRender 
                                    key={card.instanceId} 
                                    card={{...card, owner: 'player'}} 
                                    isInteractable={canAct} 
                                    isSelected={selectedAttackerId === card.instanceId}
                                    shakeIntensity={0}
                                    onRef={(el) => cardRefs.current[card.instanceId] = el}
                                    onClick={() => canAct && setSelectedAttackerId(card.instanceId)}
                                    smallScale={true}
                                />
                            );
                        })}
                    </div>
                    <div className="text-blue-300 font-header text-xl mt-2">You</div>
                </div>
            </div>
        );
    }

    return null;
};

export default PvPBattle;
