
import React, { useState, useEffect, useRef } from 'react';
import { GameState, BattleCard, OnlineBattleState, Rarity, BattleMode, ActiveEffect } from '../../types';
import Button from '../Button';
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
    // Track if we have processed the "Start of Turn" effects for the current turn ID
    const turnStartProcessedRef = useRef<string | null>(null);

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

    // --- Helpers ---
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

    const showFloatText = (x: number, y: number, text: string, color: string) => {
        setFloatingTexts(prev => [...prev, { id: Date.now() + Math.random(), x, y, text, color, scale: 1.5, life: 1.5 }]);
    };

    const triggerSpecialEffect = (type: SpecialEffect['type'], x?: number, y?: number) => {
        const id = Date.now() + Math.random();
        setSpecialEffects(prev => [...prev, { id, type, x, y, scale: 1 }]);
        setTimeout(() => setSpecialEffects(prev => prev.filter(e => e.id !== id)), 1500);
    };

    const isTargetable = (target: BattleCard, targetTeam: BattleCard[]) => {
        if (target.currentHp <= 0) return false;
        
        const activeTeammates = targetTeam.filter(c => c.currentHp > 0);
        
        // 1. Untargetable check
        if (activeTeammates.length > 1 && target.activeEffects.some(e => e.type === 'untargetable')) return false;
        
        // 2. Taunt check (Taunt overrides Defense priority)
        const taunters = activeTeammates.filter(c => c.activeEffects.some(e => e.type === 'taunt'));
        if (taunters.length > 0) {
            return taunters.some(c => c.instanceId === target.instanceId);
        }
        
        // 3. Defense Mode Priority
        const defenders = activeTeammates.filter(c => c.mode === 'defense');
        if (defenders.length > 0) {
            // If target is NOT a defender, it's not targetable
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

    // Force remove from queue on unmount
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
                // Find opponent (not self)
                const q = query(collection(db, 'matchmaking_queue'), orderBy('timestamp', 'asc'), limit(5)); // Fetch a few to find valid one
                const snapshot = await getDocs(q);
                let opponentDoc = null;
                
                snapshot.forEach(doc => {
                    if (doc.id !== auth.currentUser?.uid) {
                        opponentDoc = doc; // Simple FIFO
                    }
                });

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
            if (e.code === 'permission-denied') alert("Database Permission Error: Please update Firebase Rules.");
            setStatus('lobby');
        }
    };

    // Listen for Battle Creation (If I was in queue)
    useEffect(() => {
        let unsubscribe: () => void;
        if (status === 'searching' && auth.currentUser) {
            const q = query(collection(db, 'battles'), where('player1.uid', '==', auth.currentUser.uid), where('status', '==', 'active'));
            unsubscribe = onSnapshot(q, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const data = change.doc.data() as OnlineBattleState;
                        // Filter out stale battles (older than 2 minutes)
                        if (Date.now() - data.lastMoveTimestamp < 120000) {
                            setBattleId(data.id);
                        }
                    }
                });
            });
        }
        return () => { if (unsubscribe) unsubscribe(); }
    }, [status]);

    // --- GAME LOOP & TURN PROCESSING ---
    // This effect runs whenever battleState changes to process "Start of Turn" logic (DoT, Durations)
    useEffect(() => {
        if (!battleState || !auth.currentUser || battleState.winner) return;

        const isMyTurn = battleState.turn === auth.currentUser.uid;
        
        // Only process if it's MY turn and I haven't processed THIS specific turn state yet
        // We use lastMoveTimestamp as a unique signature for the turn state
        const turnSignature = `${battleState.turn}-${battleState.lastMoveTimestamp}`;

        if (isMyTurn && turnStartProcessedRef.current !== turnSignature) {
            turnStartProcessedRef.current = turnSignature;
            
            const imPlayer1 = battleState.player1.uid === auth.currentUser.uid;
            const mySquad = imPlayer1 ? battleState.player1.team : battleState.player2.team;
            
            let stateChanged = false;
            let diedFromPoison = false;

            const processedTeam = mySquad.map(card => {
                if (card.currentHp <= 0) return card;

                let newHp = card.currentHp;
                const newEffects: ActiveEffect[] = [];
                
                card.activeEffects.forEach(effect => {
                    // Poison Logic
                    if (effect.type === 'poison' && effect.val) {
                        newHp -= effect.val;
                        if (newHp <= 0) diedFromPoison = true;
                    }
                    
                    // Duration Logic
                    if (effect.duration > 1) {
                        newEffects.push({ ...effect, duration: effect.duration - 1 });
                    }
                });

                if (newHp !== card.currentHp || newEffects.length !== card.activeEffects.length) {
                    stateChanged = true;
                }

                return { ...card, currentHp: Math.max(0, newHp), activeEffects: newEffects };
            });

            // Check Stun to auto-skip? 
            // Simplified: If all active cards are stunned, skip turn. 
            // For now, let the user manually pass or click inactive cards (which are blocked).

            if (stateChanged) {
                const battleRef = doc(db, 'battles', battleState.id);
                const updateData: Partial<OnlineBattleState> = {};
                
                if (imPlayer1) updateData.player1 = { ...battleState.player1, team: processedTeam };
                else updateData.player2 = { ...battleState.player2, team: processedTeam };

                // If someone died from poison, check win condition immediately
                const alive = processedTeam.some(c => c.currentHp > 0);
                if (!alive) {
                    updateData.winner = imPlayer1 ? battleState.player2.uid : battleState.player1.uid;
                    updateData.status = 'finished';
                }

                if (diedFromPoison) playSfx('battleDebuff');
                
                // Write the processed state back so opponent sees the poison damage
                updateDoc(battleRef, updateData).catch(console.error);
            }
        }
    }, [battleState, auth.currentUser]);


    // Sync Battle State
    useEffect(() => {
        if (!battleId) return;

        const battleRef = doc(db, 'battles', battleId);
        const unsubscribe = onSnapshot(battleRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as OnlineBattleState;
                setBattleState(data);
                if (status !== 'active') setStatus('active');

                // Animation Triggers
                if (data.lastMoveTimestamp > lastProcessedMoveRef.current) {
                    lastProcessedMoveRef.current = data.lastMoveTimestamp;
                    const lastLog = data.logs[0] || '';
                    if (lastLog.includes('hit') || lastLog.includes('damage') || lastLog.includes('drained')) playSfx('battleAttackMedium');
                    else if (lastLog.includes('used') || lastLog.includes('superpower') || lastLog.includes('ended')) playSfx('battleAttackUltimate');
                }

                if (data.winner) {
                    setStatus('finished');
                    const amIWinner = data.winner === auth.currentUser?.uid;
                    if (amIWinner) playSfx('success');
                    let reward = amIWinner ? Math.floor(500 + (data.player1.team.length + data.player2.team.length) * 10) : 100;
                    onBattleEnd(reward, amIWinner);
                }
            } else {
                alert("Match connection lost.");
                onExit();
            }
        }, (error) => {
            console.error(error);
        });

        return () => unsubscribe();
    }, [battleId]);

    const handleAttack = async (targetId: string | null, actionOverride?: string) => {
        if (!battleState || !auth.currentUser || isAnimating) return;
        if (battleState.turn !== auth.currentUser.uid) return;
        
        const actionName = actionOverride || selectedAction;
        const isNonTargeted = ['Chopper', 'Show Maker', 'ShowMaker', 'Notes Master', 'Note Master', 'The Artist', 'Storyteller', 'StoryTeller'].includes(actionName);
        
        // Validation: If it's a targeted move (standard or special), we need a target
        if (!isNonTargeted && !targetId && !selectedAttackerId) return;

        setIsAnimating(true);
        const imPlayer1 = battleState.player1.uid === auth.currentUser.uid;
        
        // Identify squads
        const mySquad = imPlayer1 ? battleState.player1.team : battleState.player2.team;
        const enemySquad = imPlayer1 ? battleState.player2.team : battleState.player1.team;

        const attacker = mySquad.find(c => c.instanceId === selectedAttackerId);
        if (!attacker) { setIsAnimating(false); return; }

        let newEnemySquad = [...enemySquad];
        let newMySquad = [...mySquad];
        let logMsg = '';
        let nextTurn = imPlayer1 ? battleState.player2.uid : battleState.player1.uid;
        
        // Remove Superpower Charge (if using one)
        if (actionName !== 'standard') {
            const attackerIdx = newMySquad.findIndex(c => c.instanceId === attacker.instanceId);
            if (attackerIdx > -1) {
                newMySquad[attackerIdx] = {
                    ...newMySquad[attackerIdx],
                    availableSuperpowers: newMySquad[attackerIdx].availableSuperpowers.filter(s => s !== actionName)
                };
            }
        }

        // --- Logic Execution ---
        if (actionName === 'standard') {
            const targetIndex = enemySquad.findIndex(c => c.instanceId === targetId);
            if (targetIndex > -1) {
                const damage = Math.floor(attacker.atk * (0.9 + Math.random() * 0.2));
                newEnemySquad[targetIndex] = { ...newEnemySquad[targetIndex], currentHp: Math.max(0, newEnemySquad[targetIndex].currentHp - damage) };
                logMsg = `${attacker.name} hit ${newEnemySquad[targetIndex].name} for ${damage}!`;
                
                playSfx('battleAttackMedium');
                const targetNode = cardRefs.current[targetId!];
                if (targetNode) {
                    const rect = targetNode.getBoundingClientRect();
                    spawnParticles(rect.left + rect.width/2, rect.top + rect.height/2, '#fff', 20);
                    showFloatText(rect.left, rect.top, `-${damage}`, '#ff4444');
                }
            }
        } 
        // --- AoE / Global Specials ---
        else if (actionName === 'Chopper') {
            playSfx('battleAttackUltimate');
            triggerSpecialEffect('shockwave');
            const damage = Math.floor(attacker.atk * 0.6);
            newEnemySquad = newEnemySquad.map(c => c.currentHp > 0 ? { ...c, currentHp: Math.max(0, c.currentHp - damage) } : c);
            logMsg = `${attacker.name} used Chopper! AoE ${damage}!`;
        } 
        else if (['Show Maker', 'ShowMaker'].includes(actionName)) {
            playSfx('battleBuff');
            triggerSpecialEffect('spotlight');
            const buffAmt = Math.floor(attacker.atk * 0.3);
            newMySquad = newMySquad.map(c => c.currentHp > 0 ? { ...c, atk: c.atk + buffAmt, activeEffects: [...c.activeEffects, { type: 'buff', duration: 99 } as ActiveEffect] } : c);
            logMsg = `${attacker.name} hypes up the crew! (+${buffAmt} ATK)`;
        } 
        else if (['Notes Master', 'Note Master'].includes(actionName)) {
            playSfx('battleBuff');
            const attackerIdx = newMySquad.findIndex(c => c.instanceId === attacker.instanceId);
            if (attackerIdx > -1) {
                newMySquad[attackerIdx].activeEffects.push({ type: 'taunt', duration: 2 });
            }
            logMsg = `${attacker.name} demands attention! (Taunt)`;
        }
        else if (['Storyteller', 'StoryTeller'].includes(actionName)) {
            playSfx('battleBuff');
            const attackerIdx = newMySquad.findIndex(c => c.instanceId === attacker.instanceId);
            if (attackerIdx > -1) {
                newMySquad[attackerIdx].activeEffects.push({ type: 'untargetable', duration: 2 });
            }
            logMsg = `${attacker.name} fades into the background...`;
        }
        else if (actionName === 'The Artist') {
            playSfx('battleBuff');
            const aliveEnemies = enemySquad.filter(c => c.currentHp > 0);
            if (aliveEnemies.length > 0) {
                const strongest = aliveEnemies.reduce((prev, curr) => (curr.atk > prev.atk ? curr : prev));
                const attackerIdx = newMySquad.findIndex(c => c.instanceId === attacker.instanceId);
                if (attackerIdx > -1) {
                    newMySquad[attackerIdx] = { 
                        ...newMySquad[attackerIdx], 
                        atk: strongest.atk, 
                        maxHp: Math.max(newMySquad[attackerIdx].maxHp, strongest.maxHp), 
                        currentHp: Math.max(newMySquad[attackerIdx].currentHp, strongest.currentHp) 
                    };
                }
                logMsg = `${attacker.name} copied ${strongest.name}'s stats!`;
            } else {
                logMsg = `${attacker.name} tried to copy stats but no enemies found!`;
            }
        }
        // --- Targeted Specials ---
        else if (targetId) {
            const targetIndex = enemySquad.findIndex(c => c.instanceId === targetId);
            if (targetIndex > -1) {
                if (actionName.includes('Rhyme')) {
                    // Deal 50% ATK immediately THEN apply poison
                    const initialDmg = Math.floor(attacker.atk * 0.5);
                    newEnemySquad[targetIndex] = { ...newEnemySquad[targetIndex], currentHp: Math.max(0, newEnemySquad[targetIndex].currentHp - initialDmg) };
                    newEnemySquad[targetIndex].activeEffects.push({ type: 'poison', duration: 3, val: 50 });
                    
                    logMsg = `${attacker.name} hit & poisoned ${newEnemySquad[targetIndex].name}!`;
                    playSfx('battleDebuff');
                    const targetNode = cardRefs.current[targetId];
                    if (targetNode) {
                        const rect = targetNode.getBoundingClientRect();
                        showFloatText(rect.left, rect.top, `-${initialDmg}`, '#ff00ff');
                        triggerSpecialEffect('poison-cloud', rect.left + rect.width/2, rect.top + rect.height/2);
                    }
                } else if (actionName.includes('Punchline')) {
                    newEnemySquad[targetIndex].activeEffects.push({ type: 'stun', duration: 2 });
                    logMsg = `${attacker.name} stunned ${newEnemySquad[targetIndex].name}!`;
                    playSfx('battleStun');
                } else if (actionName === 'Career Killer') {
                    const target = newEnemySquad[targetIndex];
                    if (target.currentHp < target.maxHp * 0.3) {
                        newEnemySquad[targetIndex] = { ...target, currentHp: 0 };
                        logMsg = `${attacker.name} ENDED ${target.name}'s career!`;
                        playSfx('battleAttackUltimate');
                    } else {
                        const damage = Math.floor(attacker.atk * 1.5);
                        newEnemySquad[targetIndex] = { ...target, currentHp: Math.max(0, target.currentHp - damage) };
                        logMsg = `${attacker.name} hit ${target.name} hard for ${damage}!`;
                    }
                } else if (actionName === 'Battler') {
                    newEnemySquad[targetIndex].activeEffects.push({ type: 'silence', duration: 99 });
                    logMsg = `${attacker.name} silenced ${newEnemySquad[targetIndex].name}!`;
                    playSfx('battleDebuff');
                } else if (['Words Bender', 'Word Bender'].includes(actionName)) {
                    const damage = Math.floor(attacker.atk * 0.8);
                    newEnemySquad[targetIndex] = { ...newEnemySquad[targetIndex], currentHp: Math.max(0, newEnemySquad[targetIndex].currentHp - damage) };
                    const attackerIdx = newMySquad.findIndex(c => c.instanceId === attacker.instanceId);
                    if (attackerIdx > -1) {
                        newMySquad[attackerIdx].currentHp = Math.min(newMySquad[attackerIdx].maxHp, newMySquad[attackerIdx].currentHp + damage);
                    }
                    logMsg = `${attacker.name} drained ${damage} HP from ${newEnemySquad[targetIndex].name}!`;
                    playSfx('battleHeal');
                } else if (actionName === 'Freestyler') {
                    // 50% chance for 3x damage, 50% fail
                    const isSuccess = Math.random() > 0.5;
                    if (isSuccess) {
                        const damage = attacker.atk * 3;
                        newEnemySquad[targetIndex] = { ...newEnemySquad[targetIndex], currentHp: Math.max(0, newEnemySquad[targetIndex].currentHp - damage) };
                        logMsg = `${attacker.name} spit FIRE! Critical Hit (${damage})!`;
                        playSfx('battleAttackHeavy');
                    } else {
                        logMsg = `${attacker.name} choked the freestyle... (0 Dmg)`;
                    }
                } else if (actionName === 'Flow Switcher') {
                    // Attack normally, but DO NOT switch turn
                    const damage = Math.floor(attacker.atk);
                    newEnemySquad[targetIndex] = { ...newEnemySquad[targetIndex], currentHp: Math.max(0, newEnemySquad[targetIndex].currentHp - damage) };
                    logMsg = `${attacker.name} uses Flow Switcher! Extra Turn!`;
                    playSfx('battleBuff');
                    // KEEP TURN
                    nextTurn = auth.currentUser.uid;
                }
                else {
                    // Generic damage for unhandled specials
                    const damage = Math.floor(attacker.atk * 1.2);
                    newEnemySquad[targetIndex] = { ...newEnemySquad[targetIndex], currentHp: Math.max(0, newEnemySquad[targetIndex].currentHp - damage) };
                    logMsg = `${attacker.name} used ${actionName} on ${newEnemySquad[targetIndex].name}!`;
                    playSfx('battleAttackMedium');
                }
                
                // Visuals for targeted hit
                const targetNode = cardRefs.current[targetId];
                if (targetNode && actionName !== 'Flow Switcher' && actionName !== 'Freestyler') {
                    const rect = targetNode.getBoundingClientRect();
                    triggerSpecialEffect('impact-burst', rect.left + rect.width/2, rect.top + rect.height/2);
                }
            }
        }

        const enemyAlive = newEnemySquad.some(c => c.currentHp > 0);
        // If enemy is dead, no next turn, just winner logic
        const winner = enemyAlive ? null : auth.currentUser.uid;
        if (!enemyAlive) nextTurn = auth.currentUser.uid; // Doesn't matter, game ends

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

    if (status === 'lobby') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 animate-fadeIn">
                <h2 className="font-header text-5xl text-blue-glow mb-4 drop-shadow-[0_0_10px_#00c7e2]">Casual Online Battle</h2>
                <div className="bg-black/40 p-8 rounded-xl border-2 border-blue-900/50 max-w-md w-full text-center">
                    <p className="text-gray-300 mb-6">Battle real players. Ensure you have a strong connection.</p>
                    <div className="text-left mb-6 bg-black/30 p-4 rounded text-sm text-gray-400">
                        <p>1. Squad selected: {myTeam.length} cards.</p>
                        <p>2. Find match.</p>
                        <p>3. Turn-based combat.</p>
                    </div>
                    <Button variant="cta" onClick={findMatch} className="w-full text-xl py-4 shadow-blue-glow">Find Match</Button>
                    <Button variant="default" onClick={onExit} className="w-full mt-4">Back to Menu</Button>
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
        const mySquad = (imPlayer1 ? battleState.player1.team : battleState.player2.team) || [];
        const enemySquad = (imPlayer1 ? battleState.player2.team : battleState.player1.team) || [];
        const enemyName = (imPlayer1 ? battleState.player2.username : battleState.player1.username) || "Opponent";
        
        if (enemySquad.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                    <h3 className="text-2xl text-red-500 font-header">Connection Error</h3>
                    <p className="text-gray-400">Match data invalid.</p>
                    <Button variant="sell" onClick={onExit}>Exit</Button>
                </div>
            );
        }

        const isMyTurn = battleState.turn === auth.currentUser.uid;
        const activeAttacker = selectedAttackerId ? mySquad.find(c => c.instanceId === selectedAttackerId) : null;

        return (
            <div className="relative w-full max-w-6xl mx-auto min-h-[80vh] flex flex-col justify-between py-4 animate-fadeIn">
                
                <style>{`
                    .projectile-container { position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 50; pointer-events: none; }
                    .impact-burst { position: fixed; width: 100px; height: 100px; background: radial-gradient(circle, #fff 10%, transparent 70%); animation: impact-explode 0.4s ease-out forwards; pointer-events: none; z-index: 60; }
                    @keyframes impact-explode { 0% { transform: scale(0.2); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
                    @keyframes floatUp { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-80px); opacity: 0; } }
                `}</style>
                {hitParticles.map(p => <div key={p.id} className="fixed rounded-full pointer-events-none z-50" style={{ left: p.x, top: p.y, width: p.size, height: p.size, backgroundColor: p.color, opacity: Math.min(1, p.life) }} />)}
                {floatingTexts.map(ft => <div key={ft.id} className="fixed text-4xl font-header font-bold z-50 pointer-events-none" style={{ left: ft.x, top: ft.y, color: ft.color, animation: 'floatUp 1.5s ease-out forwards' }}>{ft.text}</div>)}

                {/* --- Top: Enemy --- */}
                <div className="flex flex-col items-center">
                    <div className="text-red-400 font-header text-xl mb-2">{enemyName}</div>
                    <div className="flex justify-center gap-2 flex-wrap">
                        {enemySquad.map(card => {
                            // Determine interaction validity based on targeting rules
                            const isTarget = isTargetable(card, enemySquad);
                            // Can interact if: My Turn AND Attacker Selected AND (Standard Attack OR Targeted Superpower) AND Card is a Valid Target
                            const canClick = isMyTurn && !!selectedAttackerId && 
                                             (selectedAction === 'standard' || !['Chopper', 'Show Maker', 'ShowMaker', 'Notes Master', 'Note Master', 'Storyteller', 'StoryTeller', 'The Artist'].includes(selectedAction)) &&
                                             isTarget;

                            return (
                                <BattleCardRender 
                                    key={card.instanceId} 
                                    card={{...card, owner: 'opponent'}} 
                                    isInteractable={canClick} 
                                    shakeIntensity={0}
                                    onRef={(el) => cardRefs.current[card.instanceId] = el}
                                    onClick={() => handleAttack(card.instanceId)}
                                    smallScale={true}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* --- Middle: Controls --- */}
                <div className="flex flex-col items-center justify-center my-4 gap-2 relative min-h-[100px]">
                    <div className={`px-6 py-2 rounded-full font-header text-2xl border-2 transition-colors ${isMyTurn ? 'bg-blue-600/50 border-blue-400 text-white' : 'bg-red-600/50 border-red-400 text-white'}`}>
                        {isMyTurn ? "YOUR TURN" : "ENEMY TURN"}
                    </div>
                    
                    {isMyTurn && activeAttacker ? (
                        <div className="flex gap-2 flex-wrap justify-center animate-fadeIn bg-black/60 p-2 rounded-lg border border-gold-dark/50 z-20">
                            {selectedAction !== 'standard' && (
                                <div className="absolute -top-12 left-0 right-0 text-center text-sm text-gold-light p-1 bg-black/80 rounded">{SUPERPOWER_DESC[selectedAction] || "Ability"}</div>
                            )}
                            <button onClick={() => setSelectedAction('standard')} className={`px-3 py-1 rounded border-2 font-bold text-sm ${selectedAction === 'standard' ? 'bg-white text-black border-gold-light' : 'bg-transparent text-gray-300 border-gray-600'}`}>Attack</button>
                            {activeAttacker.availableSuperpowers.map(sp => {
                                const isImmediate = ['Show Maker', 'ShowMaker', 'Chopper', 'Notes Master', 'Note Master', 'Storyteller', 'StoryTeller', 'The Artist'].includes(sp);
                                return (
                                    <button key={sp} onClick={() => { setSelectedAction(sp); if (isImmediate) handleAttack(null, sp); }} className={`px-3 py-1 rounded border-2 font-bold text-sm flex items-center gap-1 ${selectedAction === sp ? 'bg-blue-600 text-white border-blue-300' : 'bg-transparent text-blue-300 border-blue-800'}`}>
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

                {/* --- Bottom: Me --- */}
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
