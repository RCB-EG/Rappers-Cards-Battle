
import React, { useState, useEffect, useRef } from 'react';
import { GameState, BattleCard, OnlineBattleState, Rarity, BattleMode } from '../../types';
import Button from '../Button';
import BattleCardRender from '../battle/BattleCardRender';
import { db, auth } from '../../firebaseConfig';
import { doc, onSnapshot, updateDoc, setDoc, deleteDoc, collection, query, where, getDocs, runTransaction, limit, orderBy } from 'firebase/firestore';
import { sfx } from '../../data/sounds';
import { playBattleTheme, stopBattleTheme } from '../../utils/sound';

interface PvPBattleProps {
    gameState: GameState;
    onBattleEnd: (reward: number, isWin: boolean) => void;
    onExit: () => void;
    playSfx: (key: keyof typeof sfx) => void;
    musicVolume: number;
    musicOn: boolean;
}

const HP_MULTIPLIERS: Record<Rarity, number> = {
    bronze: 10, silver: 15, gold: 25, rotm: 35, icon: 45, legend: 60, event: 40,
};

const PvPBattle: React.FC<PvPBattleProps> = ({ gameState, onBattleEnd, onExit, playSfx, musicVolume, musicOn }) => {
    const [battleId, setBattleId] = useState<string | null>(null);
    const [battleState, setBattleState] = useState<OnlineBattleState | null>(null);
    const [status, setStatus] = useState<'lobby' | 'searching' | 'active' | 'finished'>('lobby');
    const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
    const [searchTime, setSearchTime] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    
    // Convert current formation to battle cards
    const myTeam = React.useMemo(() => {
        const cards = Object.values(gameState.formation).filter(Boolean);
        // Only take first 5 for now for consistency, or all if we support varying sizes
        // Let's take up to 7 cards for PvP
        return cards.slice(0, 7).map((card, i) => {
            const hpBase = HP_MULTIPLIERS[card!.rarity] || 10;
            const hpTotal = Math.floor(card!.ovr * (hpBase / 10));
            const atkTotal = Math.floor(card!.ovr * 1.1); // Slightly higher base attack for PvP pace
            return {
                ...card!,
                instanceId: `${auth.currentUser?.uid}-${i}-${card!.id}`,
                maxHp: hpTotal,
                currentHp: hpTotal,
                atk: atkTotal,
                mode: 'attack' as BattleMode, // All start in attack for simplicity in MVP
                owner: 'player',
                specialSlots: 1,
                availableSuperpowers: [...card!.superpowers],
                activeEffects: [],
                attacksRemaining: 1
            } as BattleCard;
        });
    }, [gameState.formation]);

    // Timer for search
    useEffect(() => {
        let interval: any;
        if (status === 'searching') {
            interval = setInterval(() => setSearchTime(t => t + 1), 1000);
        } else {
            setSearchTime(0);
        }
        return () => clearInterval(interval);
    }, [status]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (status === 'searching' && auth.currentUser) {
                // Remove from queue if leaving
                const qRef = doc(db, 'matchmaking_queue', auth.currentUser.uid);
                deleteDoc(qRef).catch(console.error);
            }
            stopBattleTheme(musicVolume, musicOn);
        };
    }, [status, musicVolume, musicOn]);

    // Find Match Logic
    const findMatch = async () => {
        if (!auth.currentUser || myTeam.length < 5) {
            alert("You need at least 5 cards in your formation and be logged in.");
            return;
        }
        
        setStatus('searching');
        playSfx('buttonClick');

        try {
            await runTransaction(db, async (transaction) => {
                // 1. Look for someone else waiting
                const q = query(collection(db, 'matchmaking_queue'), orderBy('timestamp', 'asc'), limit(1));
                const snapshot = await getDocs(q);
                
                let opponentDoc = null;
                snapshot.forEach(doc => {
                    if (doc.id !== auth.currentUser?.uid) opponentDoc = doc;
                });

                if (opponentDoc) {
                    // FOUND MATCH! I am Player 2
                    const opponentData = (opponentDoc as any).data();
                    const newBattleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    const battleRef = doc(db, 'battles', newBattleId);
                    
                    const initialState: OnlineBattleState = {
                        id: newBattleId,
                        player1: { uid: opponentData.userId, username: opponentData.username, team: opponentData.team },
                        player2: { uid: auth.currentUser!.uid, username: gameState.userProfile?.username || 'Player 2', team: myTeam },
                        turn: opponentData.userId, // Player 1 starts
                        winner: null,
                        lastMoveTimestamp: Date.now(),
                        logs: ['Battle Started!'],
                        status: 'active'
                    };

                    transaction.set(battleRef, initialState);
                    transaction.delete((opponentDoc as any).ref); // Remove opponent from queue
                    setBattleId(newBattleId);
                } else {
                    // NO MATCH, Add myself to queue
                    const myRef = doc(db, 'matchmaking_queue', auth.currentUser!.uid);
                    transaction.set(myRef, {
                        userId: auth.currentUser!.uid,
                        username: gameState.userProfile?.username || 'Player 1',
                        team: myTeam,
                        timestamp: Date.now()
                    });
                }
            });
        } catch (e) {
            console.error("Matchmaking error:", e);
            setStatus('lobby');
        }
    };

    // Listen for Battle
    useEffect(() => {
        let unsubscribe: () => void;

        // If we are searching, we need to listen if someone picked us up (created a battle with us as player 1)
        if (status === 'searching' && auth.currentUser) {
            const q = query(collection(db, 'battles'), where('player1.uid', '==', auth.currentUser.uid), where('status', '==', 'active'));
            unsubscribe = onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    const docData = snapshot.docs[0].data() as OnlineBattleState;
                    setBattleId(docData.id);
                    // Switch to active handled in next effect
                }
            });
        }

        return () => { if (unsubscribe) unsubscribe(); }
    }, [status]);

    // Main Battle Loop
    useEffect(() => {
        if (!battleId) return;

        const battleRef = doc(db, 'battles', battleId);
        const unsubscribe = onSnapshot(battleRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as OnlineBattleState;
                setBattleState(data);
                setStatus('active');
                
                // Audio
                if (data.status === 'active') {
                    playBattleTheme(musicVolume, musicOn);
                }

                // Game Over Check
                if (data.winner) {
                    setStatus('finished');
                    stopBattleTheme(musicVolume, musicOn);
                    const amIWinner = data.winner === auth.currentUser?.uid;
                    if (amIWinner) playSfx('success');
                    
                    // Calculate Rewards
                    // Base Pot + Performance
                    let reward = 0;
                    if (amIWinner) {
                        reward = Math.floor(500 + (data.player1.team.length + data.player2.team.length) * 10); // Simple approx
                    } else {
                        reward = 100; // Consolation
                    }
                    onBattleEnd(reward, amIWinner);
                }
            }
        });

        return () => unsubscribe();
    }, [battleId]);

    const handleAttack = async (targetId: string) => {
        if (!battleState || !auth.currentUser || isAnimating) return;
        if (battleState.turn !== auth.currentUser.uid) return;
        if (!selectedAttackerId) return;

        setIsAnimating(true);
        playSfx('battleAttackMedium'); // Local feedback immediately

        // 1. Calculate Damage Locally to prepare update
        const imPlayer1 = battleState.player1.uid === auth.currentUser.uid;
        const mySquad = imPlayer1 ? battleState.player1.team : battleState.player2.team;
        const enemySquad = imPlayer1 ? battleState.player2.team : battleState.player1.team;

        const attacker = mySquad.find(c => c.instanceId === selectedAttackerId);
        const targetIndex = enemySquad.findIndex(c => c.instanceId === targetId);
        
        if (!attacker || targetIndex === -1) {
            setIsAnimating(false);
            return;
        }

        const damage = Math.floor(attacker.atk * (0.9 + Math.random() * 0.2));
        const newEnemySquad = [...enemySquad];
        newEnemySquad[targetIndex] = {
            ...newEnemySquad[targetIndex],
            currentHp: Math.max(0, newEnemySquad[targetIndex].currentHp - damage)
        };

        const logMsg = `${attacker.name} hit ${newEnemySquad[targetIndex].name} for ${damage} damage!`;
        const newLogs = [logMsg, ...battleState.logs].slice(0, 5);

        // Check Death/Win
        const enemyAlive = newEnemySquad.some(c => c.currentHp > 0);
        const nextTurn = enemyAlive ? (imPlayer1 ? battleState.player2.uid : battleState.player1.uid) : battleState.turn;
        const winner = enemyAlive ? null : auth.currentUser.uid;

        // 2. Push to Firestore
        const battleRef = doc(db, 'battles', battleState.id);
        const updateData: Partial<OnlineBattleState> = {
            turn: nextTurn,
            logs: newLogs,
            lastMoveTimestamp: Date.now(),
            winner: winner
        };

        if (imPlayer1) {
            updateData.player2 = { ...battleState.player2, team: newEnemySquad };
        } else {
            updateData.player1 = { ...battleState.player1, team: newEnemySquad };
        }

        await updateDoc(battleRef, updateData);
        
        setSelectedAttackerId(null);
        setIsAnimating(false);
    };

    // RENDER HELPERS
    if (status === 'lobby') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 animate-fadeIn">
                <h2 className="font-header text-5xl text-blue-glow mb-4 drop-shadow-[0_0_10px_#00c7e2]">Casual Online Battle</h2>
                <div className="bg-black/40 p-8 rounded-xl border-2 border-blue-900/50 max-w-md w-full text-center">
                    <p className="text-gray-300 mb-6">Battle real players in real-time. Win BP based on performance.</p>
                    <p className="text-green-400 font-bold mb-2">Winner: ~25% Squad Value in BP</p>
                    <p className="text-gray-500 font-bold mb-8">Loser: 10% Consolation</p>
                    
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

        return (
            <div className="relative w-full max-w-6xl mx-auto min-h-[80vh] flex flex-col justify-between py-4 animate-fadeIn">
                
                {/* Enemy Team (Top) */}
                <div className="flex flex-col items-center">
                    <div className="text-red-400 font-header text-xl mb-2">{enemyName}</div>
                    <div className="flex justify-center gap-2 flex-wrap">
                        {enemySquad.map(card => (
                            <BattleCardRender 
                                key={card.instanceId} 
                                card={{...card, owner: 'opponent'}} 
                                isInteractable={isMyTurn && !!selectedAttackerId} 
                                shakeIntensity={0}
                                onRef={() => {}}
                                onClick={() => handleAttack(card.instanceId)}
                                smallScale={true}
                            />
                        ))}
                    </div>
                </div>

                {/* Center / Logs */}
                <div className="flex flex-col items-center justify-center my-4 gap-2">
                    <div className={`px-6 py-2 rounded-full font-header text-2xl border-2 transition-colors ${isMyTurn ? 'bg-blue-600/50 border-blue-400 text-white' : 'bg-red-600/50 border-red-400 text-white'}`}>
                        {isMyTurn ? "YOUR TURN" : "ENEMY TURN"}
                    </div>
                    <div className="text-center text-gray-300 text-sm font-mono bg-black/40 p-2 rounded min-w-[300px]">
                        {battleState.logs[0] || "Match Started"}
                    </div>
                </div>

                {/* My Team (Bottom) */}
                <div className="flex flex-col items-center">
                    <div className="flex justify-center gap-2 flex-wrap">
                        {mySquad.map(card => (
                            <BattleCardRender 
                                key={card.instanceId} 
                                card={{...card, owner: 'player'}} 
                                isInteractable={isMyTurn && card.currentHp > 0} 
                                isSelected={selectedAttackerId === card.instanceId}
                                shakeIntensity={0}
                                onRef={() => {}}
                                onClick={() => isMyTurn && card.currentHp > 0 && setSelectedAttackerId(card.instanceId)}
                                smallScale={true}
                            />
                        ))}
                    </div>
                    <div className="text-blue-300 font-header text-xl mt-2">You</div>
                </div>
            </div>
        );
    }

    return null;
};

export default PvPBattle;
