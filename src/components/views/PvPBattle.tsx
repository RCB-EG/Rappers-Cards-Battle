
import React, { useState, useEffect, useRef } from 'react';
import { GameState, BattleCard, OnlineBattleState, Rarity, BattleMode, ActiveEffect } from '../../types';
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

const PvPBattle: React.FC<PvPBattleProps> = ({ gameState, preparedTeam, onBattleEnd, onExit, playSfx, musicVolume, musicOn, initialBattleId }) => {
    const [battleId, setBattleId] = useState<string | null>(initialBattleId || null);
    const [battleState, setBattleState] = useState<OnlineBattleState | null>(null);
    const [status, setStatus] = useState<'lobby' | 'searching' | 'preparing' | 'active' | 'finished'>(initialBattleId ? 'preparing' : 'lobby');
    const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
    const [selectedAction, setSelectedAction] = useState<string>('standard');
    const [searchTime, setSearchTime] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [showResultScreen, setShowResultScreen] = useState(false);
    const [gameResult, setGameResult] = useState<{isWin: boolean, reward: number} | null>(null);
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
                const q = query(collection(db, 'matchmaking_queue'), orderBy('timestamp', 'asc'), limit(5));
                const snapshot = await getDocs(q);
                let opponentDoc = null;
                
                snapshot.forEach(doc => {
                    if (doc.id !== auth.currentUser?.uid) {
                        opponentDoc = doc;
                    }
                });

                if (opponentDoc) {
                    const opponentData = (opponentDoc as any).data();
                    const newBattleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    const battleRef = doc(db, 'battles', newBattleId);
                    
                    const initialState: OnlineBattleState = {
                        id: newBattleId,
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
                        avatar: gameState.userProfile?.avatar || null,
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
        if (!battleState || !auth.currentUser || battleState.winner) return;

        const isMyTurn = battleState.turn === auth.currentUser.uid;
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
                    if (effect.type === 'poison' && effect.val) {
                        newHp -= effect.val;
                        if (newHp <= 0) diedFromPoison = true;
                    }
                    if (effect.duration > 1) {
                        newEffects.push({ ...effect, duration: effect.duration - 1 });
                    }
                });

                if (newHp !== card.currentHp || newEffects.length !== card.activeEffects.length) {
                    stateChanged = true;
                }

                return { ...card, currentHp: Math.max(0, newHp), activeEffects: newEffects };
            });

            if (stateChanged) {
                const battleRef = doc(db, 'battles', battleState.id);
                const updateData: Partial<OnlineBattleState> = {};
                
                if (imPlayer1) updateData.player1 = { ...battleState.player1, team: processedTeam };
                else updateData.player2 = { ...battleState.player2, team: processedTeam };

                const alive = processedTeam.some(c => c.currentHp > 0);
                if (!alive) {
                    updateData.winner = imPlayer1 ? battleState.player2.uid : battleState.player1.uid;
                    updateData.status = 'finished';
                }

                if (diedFromPoison) playSfx('battleDebuff');
                updateDoc(battleRef, updateData).catch(console.error);
            }
        }
    }, [battleState, auth.currentUser]);

    useEffect(() => {
        if (!battleId) return;

        const battleRef = doc(db, 'battles', battleId);
        const unsubscribe = onSnapshot(battleRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as OnlineBattleState;
                setBattleState(data);
                
                // Transition logic
                if (data.status === 'active' && status !== 'active' && status !== 'finished') {
                    setStatus('active');
                } else if (data.status === 'preparing' && status !== 'preparing') {
                    setStatus('preparing');
                }

                if (data.status === 'active' && data.lastMoveTimestamp > lastProcessedMoveRef.current) {
                    lastProcessedMoveRef.current = data.lastMoveTimestamp;
                    const lastLog = data.logs[0] || '';
                    if (lastLog.includes('hit') || lastLog.includes('damage') || lastLog.includes('drained')) playSfx('battleAttackMedium');
                    else if (lastLog.includes('used') || lastLog.includes('superpower') || lastLog.includes('ended')) playSfx('battleAttackUltimate');
                }

                if (data.winner && !showResultScreen) {
                    const amIWinner = data.winner === auth.currentUser?.uid;
                    // Only trigger if we aren't already finished locally
                    if (status !== 'finished') {
                        setStatus('finished');
                        if (amIWinner) playSfx('success');
                        
                        // FIXED REWARD: Winner 100, Loser 25
                        const rewardAmt = amIWinner ? 100 : 25;
                        setGameResult({ isWin: amIWinner, reward: rewardAmt });
                        setShowResultScreen(true);
                        // Trigger App callback for data persistence
                        onBattleEnd(rewardAmt, amIWinner);
                    }
                }
            } else {
                alert("Match connection lost.");
                onExit();
            }
        }, (error) => {
            console.error(error);
        });

        return () => unsubscribe();
    }, [battleId, status, showResultScreen]);

    const handleAttack = async (targetId: string | null, actionOverride?: string) => {
        if (!battleState || !auth.currentUser || isAnimating) return;
        if (battleState.turn !== auth.currentUser.uid) return;
        
        const actionName = actionOverride || selectedAction;
        const isNonTargeted = ['Chopper', 'Show Maker', 'ShowMaker', 'Notes Master', 'Note Master', 'The Artist', 'Storyteller', 'StoryTeller'].includes(actionName);
        
        if (!isNonTargeted && !targetId && !selectedAttackerId) return;

        setIsAnimating(true);
        const imPlayer1 = battleState.player1.uid === auth.currentUser.uid;
        
        const mySquad = imPlayer1 ? battleState.player1.team : battleState.player2.team;
        const enemySquad = imPlayer1 ? battleState.player2.team : battleState.player1.team;

        const attacker = mySquad.find(c => c.instanceId === selectedAttackerId);
        if (!attacker) { setIsAnimating(false); return; }

        let newEnemySquad = [...enemySquad];
        let newMySquad = [...mySquad];
        let logMsg = '';
        let nextTurn = imPlayer1 ? battleState.player2.uid : battleState.player1.uid;
        
        if (actionName !== 'standard') {
            const attackerIdx = newMySquad.findIndex(c => c.instanceId === attacker.instanceId);
            if (attackerIdx > -1) {
                newMySquad[attackerIdx] = {
                    ...newMySquad[attackerIdx],
                    availableSuperpowers: newMySquad[attackerIdx].availableSuperpowers.filter(s => s !== actionName)
                };
            }
        }

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
                newMySquad[attackerIdx].activeEffects.push({ type: 'untargetable', duration: 1 });
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
        else if (targetId) {
            const targetIndex = enemySquad.findIndex(c => c.instanceId === targetId);
            if (targetIndex > -1) {
                if (actionName.includes('Rhyme')) {
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
                    const damage = Math.floor(attacker.atk);
                    newEnemySquad[targetIndex] = { ...newEnemySquad[targetIndex], currentHp: Math.max(0, newEnemySquad[targetIndex].currentHp - damage) };
                    logMsg = `${attacker.name} uses Flow Switcher! Extra Turn!`;
                    playSfx('battleBuff');
                    nextTurn = auth.currentUser.uid;
                }
                else {
                    const damage = Math.floor(attacker.atk * 1.2);
                    newEnemySquad[targetIndex] = { ...newEnemySquad[targetIndex], currentHp: Math.max(0, newEnemySquad[targetIndex].currentHp - damage) };
                    logMsg = `${attacker.name} used ${actionName} on ${newEnemySquad[targetIndex].name}!`;
                    playSfx('battleAttackMedium');
                }
                
                const targetNode = cardRefs.current[targetId];
                if (targetNode && actionName !== 'Flow Switcher' && actionName !== 'Freestyler') {
                    const rect = targetNode.getBoundingClientRect();
                    triggerSpecialEffect('impact-burst', rect.left + rect.width/2, rect.top + rect.height/2);
                }
            }
        }

        const enemyAlive = newEnemySquad.some(c => c.currentHp > 0);
        const winner = enemyAlive ? null : auth.currentUser.uid;
        if (!enemyAlive) nextTurn = auth.currentUser.uid; 

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

    const handleForfeit = async () => {
        if (!battleId || !battleState || !auth.currentUser) return;
        try {
            const battleRef = doc(db, 'battles', battleId);
            const opponentId = battleState.player1.uid === auth.currentUser.uid ? battleState.player2.uid : battleState.player1.uid;
            await updateDoc(battleRef, { winner: opponentId, status: 'finished' });
            setShowForfeitModal(false);
        } catch (e) {
            console.error("Error forfeiting:", e);
        }
    };

    if (showResultScreen && gameResult) {
        return (
            <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center gap-8 animate-fadeIn">
                {/* Result Animation Background */}
                <div className={`absolute inset-0 z-0 ${gameResult.isWin ? 'bg-green-900/30' : 'bg-red-900/30'} pointer-events-none`}>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)]"></div>
                </div>

                <div className="z-10 flex flex-col items-center gap-6 p-4">
                    <h2 className={`font-header text-6xl md:text-8xl drop-shadow-[0_0_25px_rgba(0,0,0,0.8)] animate-bounce ${gameResult.isWin ? 'text-green-400 [text-shadow:0_0_20px_#4ade80]' : 'text-red-500 [text-shadow:0_0_20px_#ef4444]'}`}>
                        {gameResult.isWin ? "VICTORY" : "DEFEAT"}
                    </h2>
                    
                    <div className="bg-black/60 p-6 md:p-8 rounded-2xl border-2 border-gold-dark/50 backdrop-blur-sm shadow-[0_0_50px_rgba(0,0,0,0.5)] transform hover:scale-105 transition-transform w-full max-w-sm">
                        <p className="text-2xl md:text-3xl text-white mb-4 font-header text-center">Reward Claimed</p>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-5xl md:text-6xl text-blue-glow font-bold font-header drop-shadow-md">{gameResult.reward} BP</span>
                            <span className="text-gray-400 text-sm uppercase tracking-widest border-t border-gray-600 pt-2 w-full text-center">Battle Points</span>
                        </div>
                    </div>
                    
                    <Button variant={gameResult.isWin ? 'cta' : 'default'} onClick={onExit} className="px-12 py-4 text-xl shadow-lg mt-4 w-full max-w-sm">
                        Return to Menu
                    </Button>
                </div>
            </div>
        );
    }

    if (status === 'lobby') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 animate-fadeIn">
                <h2 className="font-header text-5xl text-blue-glow mb-4 drop-shadow-[0_0_10px_#00c7e2] text-center">Casual Online Battle</h2>
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

    // New Preparing Status
    if (status === 'preparing') {
        const isMyTeamReady = battleState?.player1.uid === auth.currentUser?.uid 
            ? (battleState?.player1.team?.length || 0) > 0 
            : (battleState?.player2.team?.length || 0) > 0;

        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 animate-fadeIn">
                <div className="relative">
                    <div className="w-24 h-24 border-4 border-gold-light/30 border-t-gold-light rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center font-header text-2xl text-gold-light animate-pulse">VS</div>
                </div>
                <h3 className="font-header text-3xl text-white text-center">
                    {isMyTeamReady ? "Waiting for Opponent..." : "Prepare your Squad!"}
                </h3>
                <p className="text-gray-400 max-w-md text-center">
                    {isMyTeamReady 
                        ? "Your team is ready. The battle will start automatically when your opponent is ready."
                        : "Please finish your setup."}
                </p>
                <Button variant="sell" onClick={onExit}>Cancel</Button>
            </div>
        );
    }

    if (status === 'active' && battleState && auth.currentUser) {
        const imPlayer1 = battleState.player1.uid === auth.currentUser.uid;
        const mySquad = (imPlayer1 ? battleState.player1.team : battleState.player2.team) || [];
        const enemySquad = (imPlayer1 ? battleState.player2.team : battleState.player1.team) || [];
        
        const enemyData = imPlayer1 ? battleState.player2 : battleState.player1;
        const enemyName = enemyData.username || "Opponent";
        const enemyAvatar = enemyData.avatar || `https://api.dicebear.com/8.x/bottts/svg?seed=${enemyName}`;
        
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
            <div className="relative w-full max-w-6xl mx-auto h-[calc(100vh-80px)] flex flex-col justify-between py-2 animate-fadeIn overflow-hidden">
                
                {/* Custom Modal for Forfeit */}
                <Modal isOpen={showForfeitModal} onClose={() => setShowForfeitModal(false)} title="Forfeit Match?">
                    <p className="text-white mb-6">Are you sure you want to give up? This will count as a loss.</p>
                    <div className="flex justify-center gap-4">
                        <Button variant="sell" onClick={handleForfeit}>Yes, Forfeit</Button>
                        <Button variant="default" onClick={() => setShowForfeitModal(false)}>Cancel</Button>
                    </div>
                </Modal>

                {/* Forfeit Button for PvP */}
                <div className="absolute top-2 right-2 z-[60]">
                    <Button variant="sell" onClick={() => setShowForfeitModal(true)} className="py-1 px-3 text-xs bg-red-900/80 border-red-700 hover:bg-red-800">
                        Give Up
                    </Button>
                </div>

                <style>{`
                    .projectile-container { position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 50; pointer-events: none; }
                    .impact-burst { position: fixed; width: 100px; height: 100px; background: radial-gradient(circle, #fff 10%, transparent 70%); animation: impact-explode 0.4s ease-out forwards; pointer-events: none; z-index: 60; }
                    @keyframes impact-explode { 0% { transform: scale(0.2); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
                    @keyframes floatUp { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(-80px); opacity: 0; } }
                `}</style>
                {hitParticles.map(p => <div key={p.id} className="fixed rounded-full pointer-events-none z-50" style={{ left: p.x, top: p.y, width: p.size, height: p.size, backgroundColor: p.color, opacity: Math.min(1, p.life) }} />)}
                {floatingTexts.map(ft => <div key={ft.id} className="fixed text-4xl font-header font-bold z-50 pointer-events-none" style={{ left: ft.x, top: ft.y, color: ft.color, animation: 'floatUp 1.5s ease-out forwards' }}>{ft.text}</div>)}

                {/* --- Top: Enemy --- */}
                <div className="flex flex-col items-center flex-shrink-0">
                    <div className="flex items-center gap-3 mb-2">
                        <img src={enemyAvatar} alt="Opponent" className="w-10 h-10 rounded-full border-2 border-red-500 bg-gray-800" />
                        <div className="text-red-400 font-header text-xl drop-shadow-md">{enemyName}</div>
                    </div>
                    <div className="flex justify-center gap-1 md:gap-2 flex-wrap max-w-full">
                        {enemySquad.map(card => {
                            const isTarget = isTargetable(card, enemySquad);
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
                <div className="flex flex-col items-center justify-center my-1 gap-2 relative flex-grow min-h-[80px]">
                    <div className={`px-6 py-1 md:py-2 rounded-full font-header text-xl md:text-2xl border-2 transition-colors shadow-lg z-20 ${isMyTurn ? 'bg-blue-600/80 border-blue-400 text-white' : 'bg-red-600/80 border-red-400 text-white'}`}>
                        {isMyTurn ? "YOUR TURN" : "ENEMY TURN"}
                    </div>
                    
                    {isMyTurn && activeAttacker ? (
                        <div className="flex flex-col items-center animate-fadeIn bg-black/80 p-2 rounded-lg border border-gold-dark/50 z-30 max-w-[95%] md:max-w-xl">
                            {/* VISUAL FIX: Moved description inside normal flow to prevent overlapping */}
                            {selectedAction !== 'standard' && (
                                <div className="text-gold-light text-xs md:text-sm mb-2 text-center w-full border-b border-white/10 pb-1">
                                    {SUPERPOWER_DESC[selectedAction] || "Ability"}
                                </div>
                            )}
                            
                            <div className="flex gap-2 flex-wrap justify-center">
                                <button onClick={() => setSelectedAction('standard')} className={`px-3 py-1 rounded border-2 font-bold text-sm transition-all ${selectedAction === 'standard' ? 'bg-white text-black border-gold-light' : 'bg-transparent text-gray-300 border-gray-600'}`}>Attack</button>
                                {activeAttacker.availableSuperpowers.map(sp => {
                                    const isImmediate = ['Show Maker', 'ShowMaker', 'Chopper', 'Notes Master', 'Note Master', 'Storyteller', 'StoryTeller', 'The Artist'].includes(sp);
                                    return (
                                        <button key={sp} onClick={() => { setSelectedAction(sp); if (isImmediate) handleAttack(null, sp); }} className={`px-3 py-1 rounded border-2 font-bold text-sm flex items-center gap-1 transition-all ${selectedAction === sp ? 'bg-blue-600 text-white border-blue-300 shadow-blue-glow' : 'bg-transparent text-blue-300 border-blue-800'}`}>
                                            {sp}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-gray-300 text-xs md:text-sm font-mono bg-black/60 p-2 rounded min-w-[200px] border border-gray-700">
                            {battleState.logs[0] || "Match Started"}
                        </div>
                    )}
                </div>

                {/* --- Bottom: Me --- */}
                <div className="flex flex-col items-center flex-shrink-0 pb-safe">
                    <div className="flex justify-center gap-1 md:gap-2 flex-wrap max-w-full">
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
                    <div className="text-blue-300 font-header text-xl mt-1 drop-shadow-md">You</div>
                </div>
            </div>
        );
    }

    return null;
};

export default PvPBattle;
