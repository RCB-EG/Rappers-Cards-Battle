
import React, { useState, useEffect, useRef } from 'react';
import { GameState, BattleCard, OnlineBattleState, Rarity, ActiveEffect, BattleAction } from '../../types';
import Button from '../Button';
import Modal from '../modals/Modal';
import BattleCardRender from '../battle/BattleCardRender';
import Card from '../Card'; 
import { db, auth } from '../../firebaseConfig';
import { doc, onSnapshot, updateDoc, deleteDoc, collection, query, limit, orderBy, getDocs, runTransaction, where, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { sfx } from '../../data/sounds';
import { playBattleTheme, stopBattleTheme } from '../../utils/sound';
import { SUPERPOWER_DESC } from '../../data/gameData';

interface PvPBattleProps {
    gameState: GameState;
    preparedTeam: BattleCard[];
    onBattleEnd: (reward: number, isWin: boolean) => void;
    onExit: () => void;
    playSfx: (key: keyof typeof sfx) => void;
    musicVolume: number;
    musicOn: boolean;
    initialBattleId?: string;
    blitzMode?: boolean;
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
    const [status, setStatus] = useState<'lobby' | 'searching' | 'faceoff' | 'active' | 'finished'>(initialBattleId ? 'faceoff' : 'lobby');
    const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
    const [selectedAction, setSelectedAction] = useState<string>('standard');
    const [searchTime, setSearchTime] = useState(0);
    const [showForfeitModal, setShowForfeitModal] = useState(false);
    
    // FaceOff State
    const [faceOffTimer, setFaceOffTimer] = useState(5);
    const [imReady, setImReady] = useState(false);

    // Blitz Timers
    const [p1Timer, setP1Timer] = useState(120000);
    const [p2Timer, setP2Timer] = useState(120000);
    const [serverTimeOffset, setServerTimeOffset] = useState(0);
    
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
    const timerIntervalRef = useRef<number | null>(null);
    
    // Guard against unmounted state updates
    const isMountedRef = useRef(true);

    const currentUserUid = auth.currentUser?.uid;

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

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
        if (!isMountedRef.current) return;
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
        if (!isMountedRef.current) return;
        setFloatingTexts(prev => [...prev, { id: Date.now() + Math.random(), x, y, text, color, scale, life: 1.5 }]);
    };

    const triggerSpecialEffect = (type: SpecialEffect['type'], x?: number, y?: number, scale: number = 1) => {
        if (!isMountedRef.current) return;
        const id = Date.now() + Math.random();
        setSpecialEffects(prev => [...prev, { id, type, x, y, scale }]);
        setTimeout(() => {
            if (isMountedRef.current) {
                setSpecialEffects(prev => prev.filter(e => e.id !== id));
            }
        }, 1500); 
    };

    const isTargetable = (target: BattleCard, targetTeam: BattleCard[]) => {
        if (target.currentHp <= 0) return false;
        const activeTeammates = targetTeam.filter(c => c.currentHp > 0);
        if (activeTeammates.length > 1 && target.activeEffects.some(e => e.type === 'untargetable')) return false;
        const taunters = activeTeammates.filter(c => c.activeEffects.some(e => e.type === 'taunt'));
        if (taunters.length > 0) return taunters.some(c => c.instanceId === target.instanceId);
        const defenders = activeTeammates.filter(c => c.mode === 'defense');
        if (defenders.length > 0 && target.mode !== 'defense') return false;
        return true;
    };

    // --- Matchmaking & Setup ---
    useEffect(() => {
        let interval: any;
        if (status === 'searching') interval = setInterval(() => setSearchTime(t => t + 1), 1000);
        else setSearchTime(0);
        return () => clearInterval(interval);
    }, [status]);

    useEffect(() => {
        return () => {
            if (status === 'searching' && currentUserUid) {
                deleteDoc(doc(db, 'matchmaking_queue', currentUserUid)).catch(console.error);
            }
        };
    }, [status, currentUserUid]);

    // Listener for when an opponent picks us up (Player 1 flow)
    useEffect(() => {
        if (status === 'searching' && currentUserUid) {
            const q = query(
                collection(db, 'battles'),
                where('player1.uid', '==', currentUserUid),
                where('status', 'in', ['preparing', 'active']),
                limit(1)
            );
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    setBattleId(doc.id);
                    // The main battle listener will handle the status switch to 'faceoff'
                }
            });
            return () => unsubscribe();
        }
    }, [status, currentUserUid]);

    const findMatch = async () => {
        if (!currentUserUid) return;
        if (preparedTeam.length < 5) {
            alert("Error: Team not loaded. Please re-select your squad.");
            onExit();
            return;
        }
        
        // Prepare team
        const myTeamWithIds = preparedTeam.map((card, i) => ({
            ...card,
            instanceId: `${currentUserUid}-${i}-${card.id}`
        }));

        setStatus('searching');
        playSfx('buttonClick');

        // RETRY LOOP: Try to find a match up to 3 times before creating a new lobby
        let attempts = 0;
        let matchFound = false;

        while (attempts < 3 && !matchFound) {
            try {
                await runTransaction(db, async (transaction) => {
                    // Query for a waiting opponent
                    let q = query(collection(db, 'matchmaking_queue'), orderBy('timestamp', 'asc'), limit(5));
                    const snapshot = await getDocs(q);
                    let opponentDoc = null;
                    
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        if (doc.id !== currentUserUid) {
                            // Filter by mode
                            if (blitzMode) {
                                if (data.mode === 'blitz' && data.blitzRank === (gameState.blitzRank || 5)) opponentDoc = doc;
                            } else {
                                if (!data.mode || data.mode === 'standard') opponentDoc = doc;
                            }
                        }
                    });

                    if (opponentDoc) {
                        const oppRef = (opponentDoc as any).ref;
                        const freshOppDoc = await transaction.get(oppRef);
                        
                        if (!freshOppDoc.exists()) {
                            throw "Opponent taken"; // Triggers retry
                        }

                        const opponentData = freshOppDoc.data();
                        const newBattleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                        const battleRef = doc(db, 'battles', newBattleId);
                        
                        const initialState: OnlineBattleState = {
                            id: newBattleId,
                            mode: blitzMode ? 'blitz' : 'standard',
                            player1: { uid: opponentData.userId, username: opponentData.username, avatar: opponentData.avatar || null, team: opponentData.team },
                            player2: { uid: currentUserUid, username: gameState.userProfile?.username || 'Player 2', avatar: gameState.userProfile?.avatar || null, team: myTeamWithIds },
                            player1TimeRemaining: 120000, 
                            player2TimeRemaining: 120000,
                            turn: opponentData.userId, // Challenger (P1) starts
                            winner: null,
                            lastMoveTimestamp: Date.now(), // Server timestamp happens on first move or status change
                            lastAction: null,
                            logs: ['Match Found! Prepare for battle...'],
                            status: 'preparing'
                        };

                        transaction.set(battleRef, initialState);
                        transaction.delete(oppRef);
                        if (isMountedRef.current) setBattleId(newBattleId);
                        matchFound = true;
                    } else {
                        if (attempts === 2) {
                            const myRef = doc(db, 'matchmaking_queue', currentUserUid);
                            transaction.set(myRef, {
                                userId: currentUserUid,
                                username: gameState.userProfile?.username || 'Player 1',
                                avatar: gameState.userProfile?.avatar || null,
                                team: myTeamWithIds,
                                mode: blitzMode ? 'blitz' : 'standard',
                                blitzRank: blitzMode ? (gameState.blitzRank || 5) : null,
                                timestamp: Date.now()
                            });
                            matchFound = true; 
                        }
                    }
                });
            } catch (e) {
                console.warn(`Matchmaking attempt ${attempts + 1} failed, retrying...`, e);
            }
            attempts++;
        }

        if (!matchFound && attempts >= 3) {
             // We are now queuing via the transaction above (attempts === 2 branch)
             // Just wait for listener to pick up match
        }
    };

    // --- FaceOff Logic ---
    useEffect(() => {
        if (status === 'faceoff') {
            const timer = setInterval(() => {
                setFaceOffTimer(prev => {
                    if (prev <= 1) { setImReady(true); return 0; }
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [status]);

    useEffect(() => {
        if (imReady && battleId && status === 'faceoff' && battleState?.status === 'preparing') {
             updateDoc(doc(db, 'battles', battleId), { 
                 status: 'active', 
                 lastMoveTimestamp: serverTimestamp() // Reset timer on start
             });
        }
    }, [imReady, battleId, status, battleState]);

    // --- Battle Listener ---
    useEffect(() => {
        if (!battleId) return;
        const unsub = onSnapshot(doc(db, 'battles', battleId), (docSnap) => {
            if (docSnap.exists() && isMountedRef.current) {
                // Calculate Server Time Offset
                if (docSnap.metadata && docSnap.readTime) {
                    const serverTime = docSnap.readTime.toMillis();
                    const localTime = Date.now();
                    setServerTimeOffset(serverTime - localTime);
                }

                const data = docSnap.data() as OnlineBattleState;
                
                // --- FIX: Normalize Timestamp ---
                let normalizedLastMoveTime = Date.now();
                if (data.lastMoveTimestamp) {
                    if (typeof (data.lastMoveTimestamp as any).toMillis === 'function') {
                        normalizedLastMoveTime = (data.lastMoveTimestamp as any).toMillis();
                    } else if (typeof data.lastMoveTimestamp === 'number') {
                        normalizedLastMoveTime = data.lastMoveTimestamp;
                    }
                }
                const normalizedData = { ...data, lastMoveTimestamp: normalizedLastMoveTime };

                setBattleState(normalizedData);
                
                if (data.status === 'preparing') setStatus('faceoff');
                else if (data.status === 'active') setStatus('active');
                else if (data.status === 'finished') setStatus('finished');

                if (data.player1TimeRemaining !== undefined) setP1Timer(data.player1TimeRemaining);
                if (data.player2TimeRemaining !== undefined) setP2Timer(data.player2TimeRemaining);

                // --- Visual Effects Triggering ---
                // Check if lastAction exists and if the timestamp (number) has changed
                if (data.lastAction && data.lastAction.timestamp !== lastProcessedMoveRef.current) {
                    lastProcessedMoveRef.current = data.lastAction.timestamp;
                    
                    const actionType = data.lastAction.actionType;
                    const targetId = data.lastAction.targetId;
                    const attackerId = data.lastAction.attackerId; 
                    const targetNode = targetId ? cardRefs.current[targetId] : null;
                    const attackerNode = attackerId ? cardRefs.current[attackerId] : null;

                    // 1. Special Effects (Layer 1)
                    if (actionType.includes('Chopper')) triggerSpecialEffect('shockwave');
                    else if (actionType.includes('Show Maker') || actionType.includes('ShowMaker')) triggerSpecialEffect('spotlight');
                    else if (actionType.includes('Rhyme')) {
                        if (targetNode) {
                            const rect = targetNode.getBoundingClientRect();
                            triggerSpecialEffect('poison-cloud', rect.left + rect.width/2, rect.top + rect.height/2);
                        }
                    }
                    else if (actionType.includes('Punchline')) {
                        if (targetNode) {
                            const rect = targetNode.getBoundingClientRect();
                            triggerSpecialEffect('lightning', rect.left + rect.width/2, rect.top + rect.height/2);
                        }
                    }
                    else if (actionType.includes('Words') || actionType.includes('Word')) {
                        if (attackerNode) {
                            const rect = attackerNode.getBoundingClientRect();
                            triggerSpecialEffect('heal-aura', rect.left + rect.width/2, rect.top + rect.height/2);
                        }
                    }
                    else if (actionType.includes('Career')) {
                        if (targetNode) {
                            const rect = targetNode.getBoundingClientRect();
                            triggerSpecialEffect('slash', rect.left + rect.width/2, rect.top + rect.height/2);
                        }
                    }
                    else if (actionType.includes('Notes') || actionType.includes('Note')) {
                        if (attackerNode) {
                            const rect = attackerNode.getBoundingClientRect();
                            triggerSpecialEffect('notes', rect.left + rect.width/2, rect.top + rect.height/2);
                        }
                    }

                    // 2. Damage Effects (Shake/Text/Particles) & Projectiles
                    if (attackerNode && targetNode && data.lastAction.damage > 0) {
                        const startRect = attackerNode.getBoundingClientRect();
                        const endRect = targetNode.getBoundingClientRect();
                        
                        let projType: Projectile['type'] = 'orb';
                        if (data.lastAction.rarity === 'rotm' || data.lastAction.rarity === 'icon') projType = 'beam';

                        setProjectiles(prev => [...prev, { 
                            id: Date.now(), 
                            startX: startRect.left + startRect.width/2, 
                            startY: startRect.top + startRect.height/2, 
                            endX: endRect.left + endRect.width/2, 
                            endY: endRect.top + endRect.height/2, 
                            rarity: data.lastAction.rarity, 
                            isCrit: data.lastAction.isCrit, 
                            type: projType 
                        }]);

                        // Wait for projectile travel time (0.45s) before impact
                        setTimeout(() => {
                            if (!isMountedRef.current) return;
                            setShakeCardId(targetId);
                            setShakeIntensity(data.lastAction.isCrit ? 2 : 1);
                            
                            const cx = endRect.left + endRect.width / 2;
                            const cy = endRect.top + endRect.height / 2;
                            triggerSpecialEffect('impact-burst', cx, cy, data.lastAction.isCrit ? 1.5 : 1);
                            spawnParticles(cx, cy, data.lastAction.isCrit ? '#ff0000' : '#ffffff', 20);
                            showFloatText(cx, cy - 50, `-${data.lastAction.damage}`, data.lastAction.isCrit ? '#ff0000' : '#fff', data.lastAction.isCrit ? 2 : 1.2);
                            
                            setTimeout(() => { if (isMountedRef.current) setShakeCardId(null) }, 500);
                        }, 400);
                    }

                    // 3. Sound Effects
                    if (actionType && actionType !== 'standard') {
                        if (actionType.includes('Chopper')) playSfx('spChopper');
                        else if (actionType.includes('Show Maker') || actionType.includes('ShowMaker')) playSfx('spShowMaker');
                        else if (actionType.includes('Rhyme')) playSfx('spRhymesCrafter');
                        else if (actionType.includes('Punchline')) playSfx('spPunchline');
                        else if (actionType.includes('Words') || actionType.includes('Word')) playSfx('spWordsBender');
                        else if (actionType.includes('Career')) playSfx('spCareerKiller');
                        else if (actionType.includes('Flow')) playSfx('spFlowSwitcher');
                        else if (actionType.includes('Freestyle')) playSfx('spFreestyler');
                        else if (actionType.includes('Artist')) playSfx('spTheArtist');
                        else playSfx('battleBuff'); 
                    } else {
                        // Standard Rarity Sounds
                        const r = data.lastAction.rarity;
                        switch(r) {
                            case 'bronze': case 'silver': playSfx('attackBronzeSilver'); break;
                            case 'gold': playSfx('attackGold'); break;
                            case 'rotm': playSfx('attackRotm'); break;
                            case 'icon': playSfx('attackIcon'); break;
                            case 'legend': playSfx('attackIcon'); break;
                            default: playSfx('attackGold');
                        }
                    }
                }

                if (data.winner) {
                    const isWin = data.winner === currentUserUid;
                    onBattleEnd(isWin ? 200 : 50, isWin); 
                }
            }
        });
        return () => unsub();
    }, [battleId]);

    // --- Blitz Timer & Timeout Logic ---
    useEffect(() => {
        if (blitzMode && status === 'active' && battleState && !battleState.winner) {
            timerIntervalRef.current = window.setInterval(() => {
                const now = Date.now();
                // FIX: Use Offset-Corrected Server Time for local display accuracy
                const serverNow = now + serverTimeOffset;
                
                const lastMove = battleState.lastMoveTimestamp || serverNow;
                const delta = serverNow - lastMove;

                // Update local visual timers
                if (battleState.turn === battleState.player1.uid) {
                    const timeLeft = Math.max(0, (battleState.player1TimeRemaining || 120000) - delta);
                    setP1Timer(timeLeft);
                    
                    if (timeLeft === 0 && currentUserUid !== battleState.player1.uid) {
                        handleClaimTimeoutWin(battleState.player2.uid);
                    }
                    if (timeLeft === 0 && currentUserUid === battleState.player1.uid) {
                        handleClaimTimeoutWin(battleState.player2.uid);
                    }

                } else {
                    const timeLeft = Math.max(0, (battleState.player2TimeRemaining || 120000) - delta);
                    setP2Timer(timeLeft);

                    if (timeLeft === 0 && currentUserUid !== battleState.player2.uid) {
                        handleClaimTimeoutWin(battleState.player1.uid);
                    }
                    if (timeLeft === 0 && currentUserUid === battleState.player2.uid) {
                        handleClaimTimeoutWin(battleState.player1.uid);
                    }
                }
            }, 1000);
        }
        return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); }
    }, [blitzMode, status, battleState?.turn, battleState?.lastMoveTimestamp, currentUserUid, serverTimeOffset]);

    const handleClaimTimeoutWin = async (winnerUid: string) => {
        if (!battleId || !battleState) return;
        
        // Prevent spamming
        if (battleState.status === 'finished') return;

        try {
            await updateDoc(doc(db, 'battles', battleId), {
                winner: winnerUid,
                status: 'finished',
                logs: ["Time's up! Victory by Timeout!", ...battleState.logs]
            });
        } catch (e) { console.error(e); }
    };

    // --- EXECUTE ACTION (Logic) ---
    const executeAction = async (target: BattleCard | null) => {
        if (!battleId || !battleState || !currentUserUid || battleState.turn !== currentUserUid || !selectedAttackerId) return;
        
        try {
            // Optimistic Update
            const myAttackerId = selectedAttackerId;
            const chosenAction = selectedAction;
            setSelectedAttackerId(null); 
            setSelectedAction('standard');

            await runTransaction(db, async (transaction) => {
                const battleRef = doc(db, 'battles', battleId);
                const freshDoc = await transaction.get(battleRef);
                if (!freshDoc.exists()) throw "Battle ended";
                
                const currentData = freshDoc.data() as OnlineBattleState;
                if (currentData.turn !== currentUserUid) throw "Not your turn";

                // Resolve last move timestamp safely from server data
                let lastServerTime = Date.now();
                if (currentData.lastMoveTimestamp) {
                    if (typeof (currentData.lastMoveTimestamp as any).toMillis === 'function') {
                        lastServerTime = (currentData.lastMoveTimestamp as any).toMillis();
                    } else if (typeof currentData.lastMoveTimestamp === 'number') {
                        lastServerTime = currentData.lastMoveTimestamp;
                    }
                }

                const isP1 = currentData.player1.uid === currentUserUid;
                const myKey = isP1 ? 'player1' : 'player2';
                const enemyKey = isP1 ? 'player2' : 'player1';
                const myTeam = isP1 ? currentData.player1.team : currentData.player2.team;
                const enemyTeam = isP1 ? currentData.player2.team : currentData.player1.team;

                const attackerIndex = myTeam.findIndex(c => c.instanceId === myAttackerId);
                if (attackerIndex === -1) throw "Attacker not found";
                const attacker = myTeam[attackerIndex];

                // Remove used superpower from available list
                let newMyTeam = [...myTeam];
                if (chosenAction !== 'standard') {
                    newMyTeam[attackerIndex] = {
                        ...attacker,
                        availableSuperpowers: attacker.availableSuperpowers.filter(s => s !== chosenAction)
                    };
                }

                // Superpower Logic
                let newEnemyTeam = [...enemyTeam];
                let damageDealt = 0;
                let isCrit = false;
                let logMsg = "";
                let shouldSwitchTurn = true;

                // --- LOGIC SWITCH ---
                if (chosenAction === 'Chopper') {
                    // AoE Damage
                    damageDealt = Math.floor(attacker.atk * 0.6);
                    newEnemyTeam = newEnemyTeam.map(c => c.currentHp > 0 ? { ...c, currentHp: Math.max(0, c.currentHp - damageDealt) } : c);
                    logMsg = `${attacker.name} uses Chopper! AoE Damage!`;
                }
                else if (['Show Maker', 'ShowMaker'].includes(chosenAction)) {
                    // Team Buff
                    const buffAmt = Math.floor(attacker.atk * 0.3);
                    newMyTeam = newMyTeam.map(c => c.currentHp > 0 ? { 
                        ...c, 
                        atk: c.atk + buffAmt, 
                        activeEffects: [...c.activeEffects, { type: 'buff', duration: 99 } as ActiveEffect] 
                    } : c);
                    logMsg = `${attacker.name} hypes the crew! (+${buffAmt} ATK)`;
                }
                else if (['Words Bender', 'Word Bender'].includes(chosenAction)) {
                    // Lifesteal
                    if (!target) throw "Target required";
                    const targetIndex = newEnemyTeam.findIndex(c => c.instanceId === target.instanceId);
                    if (targetIndex === -1) throw "Target not found";
                    
                    damageDealt = Math.floor(attacker.atk * 1.0);
                    newEnemyTeam[targetIndex] = { ...newEnemyTeam[targetIndex], currentHp: Math.max(0, newEnemyTeam[targetIndex].currentHp - damageDealt) };
                    newMyTeam[attackerIndex] = { ...newMyTeam[attackerIndex], currentHp: Math.min(newMyTeam[attackerIndex].maxHp, newMyTeam[attackerIndex].currentHp + damageDealt) };
                    logMsg = `${attacker.name} drains life from ${target.name}!`;
                }
                else if (['The Artist'].includes(chosenAction)) {
                    // Copy Stats
                    const aliveEnemies = newEnemyTeam.filter(c => c.currentHp > 0);
                    if (aliveEnemies.length > 0) {
                        const strongest = aliveEnemies.reduce((prev, curr) => (curr.atk > prev.atk ? curr : prev));
                        newMyTeam[attackerIndex] = { 
                            ...newMyTeam[attackerIndex], 
                            atk: strongest.atk, 
                            maxHp: Math.max(attacker.maxHp, strongest.maxHp), 
                            currentHp: Math.max(attacker.currentHp, strongest.currentHp) 
                        };
                        logMsg = `${attacker.name} copies ${strongest.name}!`;
                    }
                }
                else if (['Notes Master', 'Note Master'].includes(chosenAction)) {
                    // Taunt
                    newMyTeam[attackerIndex] = { ...newMyTeam[attackerIndex], activeEffects: [...attacker.activeEffects, { type: 'taunt', duration: 2 } as ActiveEffect] };
                    logMsg = `${attacker.name} demands attention!`;
                }
                else if (['Storyteller', 'StoryTeller'].includes(chosenAction)) {
                    // Untargetable
                    newMyTeam[attackerIndex] = { ...newMyTeam[attackerIndex], activeEffects: [...attacker.activeEffects, { type: 'untargetable', duration: 1 } as ActiveEffect] };
                    logMsg = `${attacker.name} fades into the story...`;
                }
                else if (['Flow Switcher'].includes(chosenAction)) {
                    // Extra Turn
                    shouldSwitchTurn = false;
                    logMsg = `${attacker.name} switches flow! Extra Action!`;
                }
                else {
                    // Targeted Attacks (Standard, Punchline, Rhymes Crafter, Career Killer, Freestyler)
                    if (!target) throw "Target required";
                    const targetIndex = newEnemyTeam.findIndex(c => c.instanceId === target.instanceId);
                    if (targetIndex === -1) throw "Target not found";
                    let targetCard = newEnemyTeam[targetIndex];

                    let multiplier = 1.0;
                    isCrit = Math.random() < 0.15;

                    if (chosenAction === 'Freestyler') {
                        if (Math.random() < 0.5) { multiplier = 3.0; isCrit = true; } else { multiplier = 0; }
                    } else if (chosenAction === 'Career Killer') {
                        if (targetCard.currentHp < targetCard.maxHp * 0.3) { damageDealt = targetCard.currentHp; isCrit = true; multiplier = 0; } // Instant kill logic handled manually
                    } else if (isCrit) {
                        multiplier = 1.5;
                    }

                    if (chosenAction !== 'Career Killer' || damageDealt === 0) {
                        damageDealt = Math.floor(attacker.atk * multiplier);
                    }

                    targetCard = { ...targetCard, currentHp: Math.max(0, targetCard.currentHp - damageDealt) };

                    // Apply Status Effects
                    if (['Punchline Machine', 'Punchline'].includes(chosenAction)) {
                        targetCard.activeEffects = [...targetCard.activeEffects, { type: 'stun', duration: 1 } as ActiveEffect];
                        logMsg = `${attacker.name} stuns ${target.name}!`;
                    }
                    else if (['Rhymes Crafter', 'Rhyme Crafter'].includes(chosenAction)) {
                        targetCard.activeEffects = [...targetCard.activeEffects, { type: 'poison', duration: 3, val: 50, sourceId: attacker.instanceId } as ActiveEffect];
                        logMsg = `${attacker.name} poisons ${target.name}!`;
                    }
                    else if (chosenAction === 'Battler') {
                        targetCard.activeEffects = [...targetCard.activeEffects, { type: 'silence', duration: 3 } as ActiveEffect];
                        logMsg = `${attacker.name} silences ${target.name}!`;
                    }
                    else {
                        logMsg = `${attacker.name} hits ${target.name} for ${damageDealt}!`;
                    }

                    newEnemyTeam[targetIndex] = targetCard;
                }

                // Check Win
                const enemyAlive = newEnemyTeam.some(c => c.currentHp > 0);
                const winner = !enemyAlive ? currentUserUid : null;

                // Timer Math using Server Timestamp Delta
                // FIX: Clamp time spent to avoid negative values (exploitation)
                // Use Date.now() for client-side move time, against last SERVER committed time.
                const timeSpent = Math.max(0, Date.now() - lastServerTime); 
                
                let newP1Time = currentData.player1TimeRemaining || 120000;
                let newP2Time = currentData.player2TimeRemaining || 120000;
                if (blitzMode) {
                    if (isP1) newP1Time = Math.max(0, newP1Time - timeSpent);
                    else newP2Time = Math.max(0, newP2Time - timeSpent);
                }

                // Next Turn Logic
                let nextTurn = shouldSwitchTurn ? (isP1 ? currentData.player2.uid : currentData.player1.uid) : currentData.turn;

                // Action Data for Visuals
                const actionData: BattleAction = {
                    attackerId: attacker.instanceId,
                    targetId: target ? target.instanceId : null,
                    actionType: chosenAction,
                    damage: damageDealt,
                    isCrit,
                    timestamp: Date.now(),
                    rarity: attacker.rarity
                };

                transaction.update(battleRef, {
                    [`${myKey}.team`]: newMyTeam,
                    [`${enemyKey}.team`]: newEnemyTeam,
                    turn: nextTurn,
                    lastAction: actionData,
                    lastMoveTimestamp: serverTimestamp(), // Sync with Server Time
                    logs: [logMsg, ...currentData.logs.slice(0, 4)],
                    winner: winner,
                    status: winner ? 'finished' : 'active',
                    player1TimeRemaining: newP1Time,
                    player2TimeRemaining: newP2Time
                });
            });

        } catch (e) {
            console.error("Move failed:", e);
        }
    };

    const handleForfeit = async () => {
        if (!battleId || !battleState || !currentUserUid) return;
        try {
            const opponentId = battleState.player1.uid === currentUserUid ? battleState.player2.uid : battleState.player1.uid;
            await updateDoc(doc(db, 'battles', battleId), {
                winner: opponentId,
                status: 'finished',
                logs: [`${currentUserUid === battleState.player1.uid ? battleState.player1.username : battleState.player2.username} forfeited!`, ...battleState.logs]
            });
        } catch (e) { console.error(e); }
    };

    if (status === 'lobby') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-fadeIn">
                <h2 className="font-header text-4xl text-white">{blitzMode ? 'Street Fight Lobby' : 'Online Lobby'}</h2>
                <div className="bg-black/40 p-6 rounded-xl border border-gold-dark/30 text-center max-w-md">
                    <p className="text-gray-300 mb-4">{blitzMode ? '2 Minute Blitz. High Stakes. No Mercy.' : 'Find a worthy opponent and battle for glory!'}</p>
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

    if (status === 'faceoff' && battleState) {
        const p1 = battleState.player1;
        const p2 = battleState.player2;
        const isP1Me = p1.uid === currentUserUid;
        const myData = isP1Me ? p1 : p2;
        const oppData = isP1Me ? p2 : p1;

        return (
            <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-fadeIn overflow-hidden">
                {/* VS Background */}
                <div className="absolute inset-0 flex">
                    <div className="w-1/2 bg-blue-900/30 border-r-2 border-white/10 relative">
                        <div className="absolute inset-0 bg-cover bg-center opacity-20 grayscale" style={{ backgroundImage: `url(${myData.avatar || ''})` }}></div>
                    </div>
                    <div className="w-1/2 bg-red-900/30 border-l-2 border-white/10 relative">
                        <div className="absolute inset-0 bg-cover bg-center opacity-20 grayscale" style={{ backgroundImage: `url(${oppData.avatar || ''})` }}></div>
                    </div>
                </div>

                {/* VS Badge */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
                    <div className="text-8xl font-header text-white drop-shadow-[0_0_20px_#FFD700] animate-pulse">VS</div>
                </div>

                {/* Content Grid */}
                <div className="relative z-10 w-full max-w-6xl grid grid-cols-2 gap-8 px-4 h-full py-10">
                    {/* Player (Left) */}
                    <div className="flex flex-col items-center justify-center animate-slideRight">
                        <img src={myData.avatar || 'https://api.dicebear.com/8.x/bottts/svg?seed=me'} className="w-32 h-32 rounded-full border-4 border-blue-500 shadow-[0_0_30px_#3b82f6] mb-4 bg-gray-800" />
                        <h2 className="font-header text-4xl text-blue-400 mb-2">{myData.username}</h2>
                        <div className="flex gap-4 mb-8">
                            {/* Cards Preview */}
                            {myData.team.slice(0, 5).map((card, i) => (
                                <div key={i} className="transform scale-75 -ml-4 first:ml-0 shadow-lg">
                                    <Card card={card} className="!w-[80px] !h-[120px]" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Opponent (Right) */}
                    <div className="flex flex-col items-center justify-center animate-slideLeft">
                        <img src={oppData.avatar || 'https://api.dicebear.com/8.x/bottts/svg?seed=opp'} className="w-32 h-32 rounded-full border-4 border-red-500 shadow-[0_0_30px_#ef4444] mb-4 bg-gray-800" />
                        <h2 className="font-header text-4xl text-red-400 mb-2">{oppData.username}</h2>
                        <div className="flex gap-4 mb-8">
                            {/* Cards Preview */}
                            {oppData.team.slice(0, 5).map((card, i) => (
                                <div key={i} className="transform scale-75 -ml-4 first:ml-0 shadow-lg">
                                    <Card card={card} className="!w-[80px] !h-[120px]" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Ready Button / Timer */}
                <div className="absolute bottom-10 z-30 flex flex-col items-center gap-2">
                    <p className="text-gray-400 uppercase tracking-widest text-sm">Battle starts in</p>
                    <div className="text-6xl font-header text-white">{faceOffTimer}</div>
                    
                    {!imReady && (
                        <Button variant="cta" onClick={() => setImReady(true)} className="w-48 mt-4 animate-bounce">
                            I'M READY
                        </Button>
                    )}
                    {imReady && <p className="text-green-400 font-bold mt-4">Waiting for opponent...</p>}
                </div>
            </div>
        );
    }

    if (status === 'active' || status === 'finished') {
        if (!battleState || !currentUserUid) return <div className="text-center text-white">Loading Battle State...</div>;

        const isP1 = battleState.player1.uid === currentUserUid;
        const myData = isP1 ? battleState.player1 : battleState.player2;
        const oppData = isP1 ? battleState.player2 : battleState.player1;
        const isMyTurn = battleState.turn === currentUserUid;
        const myTime = isP1 ? p1Timer : p2Timer;
        const oppTime = isP1 ? p2Timer : p1Timer;

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
                {/* Visual Projectiles */}
                {projectiles.map(p => {
                    const angle = Math.atan2(p.endY - p.startY, p.endX - p.startX);
                    const colors: Record<string, string> = {
                        bronze: '#cd7f32', silver: '#c0c0c0', gold: '#ffd700',
                        rotm: '#e364a7', icon: '#00c7e2', legend: '#ffffff', event: '#33ffdd'
                    };
                    const color = colors[p.rarity] || '#ffffff';
                    
                    const style = {
                        '--sx': `${p.startX}px`,
                        '--sy': `${p.startY}px`,
                        '--ex': `${p.endX}px`,
                        '--ey': `${p.endY}px`,
                        '--angle': `${angle}rad`,
                        '--p-color': color
                    } as React.CSSProperties;

                    return (
                        <div key={p.id} className="projectile-container" style={style}>
                            <div className="proj-head" />
                            <div className="proj-trail" />
                        </div>
                    );
                })}
                {/* Special Effects Rendering */}
                {specialEffects.map(eff => {
                    if (eff.type === 'impact-burst') return <div key={eff.id} className="impact-burst" style={{ left: eff.x, top: eff.y, '--p-color': '#fff' } as React.CSSProperties} />;
                    if (eff.type === 'shockwave') return <div key={eff.id} className="effect-shockwave" />;
                    if (eff.type === 'spotlight') return <div key={eff.id} className="effect-spotlight" />;
                    if (eff.type === 'lightning') return <div key={eff.id} className="effect-lightning" style={{ left: eff.x }} />;
                    if (eff.type === 'slash') return <div key={eff.id} className="effect-slash" style={{ left: (eff.x || 0), top: eff.y }} />;
                    if (eff.type === 'notes') return <div key={eff.id} className="effect-notes" style={{ left: eff.x, top: eff.y }}>🎵</div>;
                    if (eff.type === 'poison-cloud') return <div key={eff.id} className="effect-poison-cloud" style={{ left: (eff.x || 0) - 60, top: (eff.y || 0) - 60 }} />;
                    if (eff.type === 'heal-aura') return <div key={eff.id} className="effect-heal-aura" style={{ left: (eff.x || 0) - 20, top: (eff.y || 0) - 50 }}>💚</div>;
                    return null;
                })}

                {/* Opponent Team (Top) */}
                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-4 mb-2">
                        {/* Opponent Timer - BLITZ ONLY */}
                        {blitzMode && (
                            <div className={`bg-black/80 px-3 py-1 rounded border ${oppTime < 30000 ? 'border-red-500 text-red-500 animate-pulse' : 'border-gray-600 text-gray-300'}`}>
                                <span className="font-mono font-bold text-lg">{formatTime(oppTime)}</span>
                            </div>
                        )}
                        
                        <div className="flex items-center gap-3 bg-black/50 px-4 py-1 rounded-full border border-red-900/50">
                            <img src={oppData.avatar || 'https://api.dicebear.com/8.x/bottts/svg?seed=opp'} className="w-8 h-8 rounded-full bg-gray-700" />
                            <span className="text-red-400 font-bold">{oppData.username}</span>
                        </div>
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
                        {battleState.winner ? (battleState.winner === currentUserUid ? "VICTORY!" : "DEFEAT") : (isMyTurn ? "YOUR TURN" : "OPPONENT'S TURN")}
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
                    
                    {/* Controls & Timer */}
                    <div className="flex items-center gap-4">
                        {isMyTurn && selectedAttackerId && (
                            <div className="flex flex-col items-center gap-2 bg-black/80 p-2 rounded-lg border border-gold-dark/50 animate-slideUp">
                                {/* Action Description */}
                                {selectedAction !== 'standard' && (
                                    <div className="text-gold-light text-xs md:text-sm text-center w-full border-b border-white/10 pb-1">
                                        {SUPERPOWER_DESC[selectedAction] || "Special Ability"}
                                    </div>
                                )}
                                
                                <div className="flex gap-2 flex-wrap justify-center">
                                    <button onClick={() => setSelectedAction('standard')} className={`px-4 py-1 rounded border font-bold text-sm ${selectedAction === 'standard' ? 'bg-white text-black' : 'bg-transparent text-gray-300'}`}>Attack</button>
                                    {myData.team.find(c => c.instanceId === selectedAttackerId)?.availableSuperpowers.map(sp => {
                                        const isImmediate = ['Show Maker', 'ShowMaker', 'Chopper', 'Notes Master', 'Note Master', 'The Artist', 'Storyteller', 'StoryTeller', 'Flow Switcher'].includes(sp);
                                        return (
                                            <button 
                                                key={sp} 
                                                onClick={() => { 
                                                    setSelectedAction(sp); 
                                                    if (isImmediate) executeAction(null); 
                                                }} 
                                                className={`px-4 py-1 rounded border font-bold text-sm ${selectedAction === sp ? 'bg-blue-500 text-white' : 'bg-transparent text-blue-300 border-blue-900'}`}
                                            >
                                                {sp}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* My Timer - BLITZ ONLY */}
                        {blitzMode && (
                            <div className={`bg-black/80 px-4 py-2 rounded-lg border-2 shadow-lg ${myTime < 30000 ? 'border-red-500 text-red-500 animate-pulse bg-red-900/20' : 'border-blue-400 text-white'}`}>
                                <span className="font-mono font-bold text-2xl">{formatTime(myTime)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default PvPBattle;
