
import React, { useState, useEffect, useRef } from 'react';
import { GameState, Card as CardType, Rarity, PackType, Rank, BattleCard, ActiveEffect, BattleMode, BattleInvite, User } from '../../types';
import Card from '../Card';
import Button from '../Button';
import Modal from '../modals/Modal';
import { superpowerIcons, rankSystem, playerPickConfigs, blitzRankSystem, SUPERPOWER_DESC } from '../../data/gameData';
import { TranslationKey } from '../../utils/translations';
import { sfx } from '../../data/sounds';
import { playBattleTheme, stopBattleTheme } from '../../utils/sound';
import BattleCardRender from '../battle/BattleCardRender';
import PvPBattle from './PvPBattle';

interface BattleProps {
    gameState: GameState;
    onBattleWin: (amount: number, isWin: boolean, mode: 'ranked' | 'challenge' | 'blitz', squad: CardType[]) => void;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
    playSfx: (key: keyof typeof sfx) => void;
    musicVolume: number;
    musicOn: boolean;
    setIsBattleActive: (isActive: boolean) => void;
    setupInvite?: BattleInvite | null; 
    onStartInviteBattle?: (team: BattleCard[]) => void; 
    currentUser?: User | null;
    allCards: CardType[];
}

// Visual Types for PvE
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

const HP_MULTIPLIERS: Record<Rarity, number> = {
    bronze: 10,
    silver: 15,
    gold: 25,
    rotm: 35,
    icon: 45,
    legend: 60,
    event: 40,
};

const packImages: Record<PackType, string> = {
    free: 'https://i.postimg.cc/R0sYyFhL/Free.png',
    bronze: 'https://i.imghippo.com/files/KCG5562T.png',
    builder: 'https://i.postimg.cc/1z5Tv6mz/Builder.png',
    special: 'https://i.postimg.cc/sxS0M4cT/Special.png',
    legendary: 'https://i.postimg.cc/63Fm6md7/Legendary.png',
};

const Battle: React.FC<BattleProps> = ({ gameState, onBattleWin, t, playSfx, musicVolume, musicOn, setIsBattleActive, setupInvite, onStartInviteBattle, currentUser, allCards }) => {
    const [phase, setPhase] = useState<'mode_select' | 'selection' | 'tactics' | 'battle' | 'result' | 'pvp'>('mode_select');
    const [subMode, setSubMode] = useState<'ranked' | 'challenge' | 'online' | 'invite' | 'blitz'>('ranked');
    const [playerTeam, setPlayerTeam] = useState<BattleCard[]>([]);
    const [cpuTeam, setCpuTeam] = useState<BattleCard[]>([]);
    const [turn, setTurn] = useState<'player' | 'cpu'>('player');
    const [skipNextTurn, setSkipNextTurn] = useState<'player' | 'cpu' | null>(null);
    const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
    const [selectedAction, setSelectedAction] = useState<string>('standard');
    const [battleLog, setBattleLog] = useState<string[]>([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const [reward, setReward] = useState(0);
    const [isBattleReady, setIsBattleReady] = useState(false);
    
    // UI Modals
    const [showRankRewards, setShowRankRewards] = useState(false);
    const [showBlitzRewards, setShowBlitzRewards] = useState(false);
    const [showForfeitModal, setShowForfeitModal] = useState(false);
    
    // Configuration
    const [teamSize, setTeamSize] = useState(5);
    const [forcedCpuAttackerId, setForcedCpuAttackerId] = useState<string | null>(null); 
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const animationFrameRef = useRef<number | null>(null);
    
    // Visual State
    const [projectiles, setProjectiles] = useState<Projectile[]>([]);
    const [specialEffects, setSpecialEffects] = useState<SpecialEffect[]>([]);
    const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
    const [hitParticles, setHitParticles] = useState<HitParticle[]>([]);
    const [shakeCardId, setShakeCardId] = useState<string | null>(null);
    const [shakeIntensity, setShakeIntensity] = useState<number>(0);

    // Setup Timers (BLITZ ONLY)
    const [setupTimer, setSetupTimer] = useState(15); 

    // Dedup cards for selection
    const availableCards = React.useMemo(() => {
        const cards = Object.values(gameState.formation).filter((c): c is CardType => !!c);
        const uniqueCards: CardType[] = [];
        const seenNames = new Set<string>();
        
        cards.forEach(card => {
            if (!seenNames.has(card.name)) {
                uniqueCards.push(card);
                seenNames.add(card.name);
            }
        });
        return uniqueCards;
    }, [gameState.formation]);

    const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

    // Handle timer countdown - ONLY for Blitz Mode
    useEffect(() => {
        if ((phase === 'selection' || phase === 'tactics') && subMode === 'blitz') {
            const timer = setInterval(() => {
                setSetupTimer(prev => {
                    if (prev <= 1) return 0;
                    return prev - 1;
                });
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [phase, subMode]);

    // Handle Auto-Advance when timer hits 0 in Blitz
    useEffect(() => {
        if (setupTimer === 0 && subMode === 'blitz') {
            if (phase === 'selection') {
                // Auto-fill remaining slots
                if (selectedCardIds.length < teamSize) {
                    const remainingNeeded = teamSize - selectedCardIds.length;
                    const unusedCards = availableCards.filter(c => !selectedCardIds.includes(c.id));
                    const autoPicks = unusedCards.slice(0, remainingNeeded).map(c => c.id);
                    const newSelection = [...selectedCardIds, ...autoPicks];
                    
                    const initialBattleTeam = availableCards.filter(c => newSelection.includes(c.id)).map((c, i) => calculateStats(c, 'attack', 'player', i));
                    setPlayerTeam(initialBattleTeam);
                    setSelectedCardIds(newSelection);
                    setPhase('tactics');
                    setSetupTimer(15); 
                } else {
                    goToTactics();
                }
            } else if (phase === 'tactics') {
                handleBattleStart();
            }
        }
    }, [setupTimer, phase, subMode]);

    // Reset timer when entering a new setup phase in Blitz
    useEffect(() => {
        if (subMode === 'blitz' && phase === 'selection') setSetupTimer(15);
    }, [phase, subMode]);

    // Handle incoming invite setup
    useEffect(() => {
        if (setupInvite) {
            setSubMode('invite');
            setPhase('selection');
            setTeamSize(5); 
            setSelectedCardIds([]); 
        }
    }, [setupInvite]);

    // Lock navigation when in battle
    useEffect(() => {
        const active = phase === 'battle' || phase === 'pvp';
        setIsBattleActive(active);
        return () => setIsBattleActive(false);
    }, [phase, setIsBattleActive]);

    // Cleanup music on unmount
    useEffect(() => {
        return () => {
            stopBattleTheme(musicVolume, musicOn);
        };
    }, [musicVolume, musicOn]);

    // Set Team Size based on Mode/Rank
    useEffect(() => {
        if (subMode === 'ranked') {
            const config = rankSystem[gameState.rank];
            setTeamSize(config.teamSize);
        } else if (subMode === 'online' || subMode === 'invite' || subMode === 'blitz') {
            setTeamSize(5);
        } else {
            if (teamSize < 5) setTeamSize(5); 
        }
    }, [subMode, gameState.rank]);

    const calculateStats = (card: CardType, mode: BattleMode, owner: 'player' | 'cpu', index: number): BattleCard => {
        const hpBase = HP_MULTIPLIERS[card.rarity] || 10;
        const hpTotal = Math.floor(card.ovr * (hpBase / 10) * (mode === 'defense' ? 2 : 1));
        const atkTotal = mode === 'defense' ? 0 : Math.floor(card.ovr * (1 + (card.superpowers?.length || 0) * 0.1));
        const slots = card.value > 100000 ? 3 : card.value > 10000 ? 2 : 1;
        return {
            ...card,
            instanceId: `${owner}-${index}-${card.id}`,
            maxHp: hpTotal,
            currentHp: hpTotal,
            atk: atkTotal,
            mode,
            owner,
            specialSlots: slots,
            availableSuperpowers: [...card.superpowers],
            activeEffects: [],
            attacksRemaining: 1
        };
    };

    const resetPlayerTeam = (team: BattleCard[]) => {
        return team.map(c => {
            const hpBase = HP_MULTIPLIERS[c.rarity] || 10;
            const hpTotal = Math.floor(c.ovr * (hpBase / 10) * (c.mode === 'defense' ? 2 : 1));
            return {
                ...c,
                maxHp: hpTotal,
                currentHp: hpTotal,
                activeEffects: [],
                attacksRemaining: 1,
                availableSuperpowers: [...c.superpowers]
            };
        });
    };

    const addToLog = (msg: string) => setBattleLog(prev => [msg, ...prev].slice(0, 5));

    // Particle System Loop
    useEffect(() => {
        let lastTime = performance.now();
        const loop = (time: number) => {
            const dt = (time - lastTime) / 1000;
            lastTime = time;
            setHitParticles(prev => prev.map(p => ({
                ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.3, vx: p.vx * 0.95, life: p.life - dt * 2, size: p.size * 0.95
            })).filter(p => p.life > 0));
            setFloatingTexts(prev => prev.map(ft => ({ ...ft, y: ft.y - 1, life: ft.life - dt })).filter(ft => ft.life > 0));
            animationFrameRef.current = window.requestAnimationFrame(loop);
        };
        animationFrameRef.current = window.requestAnimationFrame(loop);
        return () => { if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current); };
    }, []);

    const isTargetable = (target: BattleCard, targetTeam: BattleCard[]) => {
        if (target.currentHp <= 0) return false;
        const activeTeammates = targetTeam.filter(c => c.currentHp > 0);
        if (activeTeammates.length > 1 && target.activeEffects.some(e => e.type === 'untargetable')) return false;
        const taunters = activeTeammates.filter(c => c.activeEffects.some(e => e.type === 'taunt'));
        if (taunters.length > 0 && !taunters.find(c => c.instanceId === target.instanceId)) return false;
        const defenders = activeTeammates.filter(c => c.mode === 'defense');
        if (defenders.length > 0 && target.mode !== 'defense') return false;
        return true;
    };

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
        setTimeout(() => {
            setSpecialEffects(prev => prev.filter(e => e.id !== id));
        }, 1500); 
    };

    // PvE Action Logic
    const executeAction = async (attacker: BattleCard, target: BattleCard | null, actionOverride?: string) => {
        if (isAnimating) return;
        try {
            setIsAnimating(true);
            const actionName = actionOverride || selectedAction;
            
            const isSuperpower = actionName !== 'standard';
            const isRhymesCrafter = ['Rhymes Crafter', 'Rhyme Crafter'].includes(actionName);
            const isWordsBender = ['Words Bender', 'Word Bender'].includes(actionName);
            const isNotesMaster = ['Notes Master', 'Note Master'].includes(actionName);
            const isStoryteller = ['Storyteller', 'StoryTeller'].includes(actionName);
            const isShowMaker = ['Show Maker', 'ShowMaker'].includes(actionName);
            const isChopper = actionName === 'Chopper';
            const isArtist = actionName === 'The Artist';
            const isFlowSwitcher = actionName === 'Flow Switcher';
            const isPunchline = actionName === 'Punchline Machine';
            const isCareerKiller = actionName === 'Career Killer';
            const isFreestyler = actionName === 'Freestyler';

            if (isSuperpower) {
                const teamSetter = attacker.owner === 'player' ? setPlayerTeam : setCpuTeam;
                teamSetter(prev => prev.map(c => c.instanceId === attacker.instanceId ? {
                    ...c, availableSuperpowers: c.availableSuperpowers.filter(s => s !== actionName)
                } : c));
            }

            const startNode = cardRefs.current[attacker.instanceId];
            const startRect = startNode?.getBoundingClientRect();
            let dealtDamage = 0;
            let isCrit = false;
            const baseDmg = attacker.atk;

            const applyDamageToCard = (card: BattleCard, dmg: number, crit: boolean) => {
                const node = cardRefs.current[card.instanceId];
                if (node) {
                    const rect = node.getBoundingClientRect();
                    const x = rect.left + rect.width / 2;
                    const y = rect.top + rect.height / 2;
                    triggerSpecialEffect('impact-burst', x, y, crit ? 1.5 : 1);
                    spawnParticles(x, y, crit ? '#ff0000' : '#ffffff', crit ? 30 : 15, crit ? 'debris' : 'spark');
                    showFloatText(x, y - 50, `-${dmg}`, crit ? '#ff4444' : '#ffffff', crit ? 2 : 1.2);
                    setShakeCardId(card.instanceId);
                    setShakeIntensity(crit ? 3 : dmg > 50 ? 2 : 1);
                }
                return { ...card, currentHp: Math.max(0, card.currentHp - dmg) };
            };

            // Effect Logic
            if (isChopper) {
                playSfx('spChopper');
                triggerSpecialEffect('shockwave'); 
                const dmg = Math.floor(baseDmg * 0.6);
                addToLog(`${attacker.name} uses Chopper! AoE ${dmg} damage!`);
                await new Promise(r => setTimeout(r, 400)); 
                const hitAll = (team: BattleCard[]) => team.map(c => { if (c.currentHp > 0) return applyDamageToCard(c, dmg, true); return c; });
                if (attacker.owner === 'player') setCpuTeam(prev => hitAll(prev)); else setPlayerTeam(prev => hitAll(prev));
            } 
            else if (isShowMaker) {
                playSfx('spShowMaker');
                triggerSpecialEffect('spotlight');
                const buffAmt = Math.floor(attacker.atk * 0.3);
                const buffTeam = (team: BattleCard[]) => team.map(c => c.currentHp > 0 && c.instanceId !== attacker.instanceId ? { ...c, atk: c.atk + buffAmt, activeEffects: [...c.activeEffects, { type: 'buff', duration: 99 } as ActiveEffect] } : c);
                if (attacker.owner === 'player') setPlayerTeam(prev => buffTeam(prev)); else setCpuTeam(prev => buffTeam(prev));
                addToLog(`${attacker.name} hypes up the crew! (+${buffAmt} ATK)`);
            } 
            else if (isNotesMaster) {
                playSfx('battleBuff'); 
                if (startRect) triggerSpecialEffect('notes', startRect.left + startRect.width/2, startRect.top);
                const addTaunt = (team: BattleCard[]) => team.map(c => c.instanceId === attacker.instanceId ? { ...c, activeEffects: [...c.activeEffects, { type: 'taunt', duration: 2 } as ActiveEffect] } : c);
                if (attacker.owner === 'player') setPlayerTeam(prev => addTaunt(prev)); else setCpuTeam(prev => addTaunt(prev));
                addToLog(`${attacker.name} demands attention! (2 turns)`);
            } 
            else if (isStoryteller) {
                playSfx('battleBuff'); 
                const addUntarget = (team: BattleCard[]) => team.map(c => c.instanceId === attacker.instanceId ? { ...c, activeEffects: [...c.activeEffects, { type: 'untargetable', duration: 1 } as ActiveEffect] } : c);
                if (attacker.owner === 'player') setPlayerTeam(prev => addUntarget(prev)); else setCpuTeam(prev => addUntarget(prev));
                addToLog(`${attacker.name} fades...`);
            } 
            else if (isArtist) {
                const enemyTeam = attacker.owner === 'player' ? cpuTeam : playerTeam;
                const aliveEnemies = enemyTeam.filter(c => c.currentHp > 0);
                const targetPool = aliveEnemies.length > 0 ? aliveEnemies : enemyTeam;
                if (targetPool.length > 0) {
                    playSfx('spTheArtist');
                    const strongest = targetPool.reduce((prev, curr) => (curr.atk > prev.atk ? curr : prev), targetPool[0]);
                    const transform = (team: BattleCard[]) => team.map(c => c.instanceId === attacker.instanceId ? { ...c, atk: strongest.atk, maxHp: Math.max(c.maxHp, strongest.maxHp), currentHp: Math.max(c.currentHp, strongest.currentHp) } : c);
                    if (attacker.owner === 'player') setPlayerTeam(prev => transform(prev)); else setCpuTeam(prev => transform(prev));
                    addToLog(`${attacker.name} becomes ${strongest.name}! (${strongest.atk} ATK)`);
                } else { addToLog(`${attacker.name} has no one to copy!`); }
            }
            // Targeted
            else {
                if (!target) { setIsAnimating(false); return; }
                let multiplier = (0.9 + Math.random() * 0.2);
                isCrit = Math.random() < 0.15;
                
                if (isFreestyler) {
                    if (Math.random() < 0.5) { multiplier = 3.0; isCrit = true; addToLog(`${attacker.name} Freestyles... IT'S FIRE!`); playSfx('spFreestyler'); } 
                    else { multiplier = 0; addToLog(`${attacker.name} Freestyles... and chokes.`); playSfx('battleDebuff'); }
                } else if (isCrit) multiplier = 1.5;
                
                dealtDamage = Math.max(1, Math.floor(baseDmg * multiplier));
                if (multiplier === 0) dealtDamage = 0;
                
                if (isCareerKiller && target.currentHp < target.maxHp * 0.3) { 
                    dealtDamage = target.currentHp; isCrit = true; addToLog(`${attacker.name} ends ${target.name}'s career!`); playSfx('spCareerKiller');
                    const tr = cardRefs.current[target.instanceId]?.getBoundingClientRect();
                    if (tr) triggerSpecialEffect('slash', tr.left + tr.width/2, tr.top + tr.height/2, 2);
                }

                if (startRect && target) {
                    const endNode = cardRefs.current[target.instanceId];
                    if (endNode) {
                        const endRect = endNode.getBoundingClientRect();
                        const pid = Date.now();
                        if (isPunchline) {
                             triggerSpecialEffect('lightning', endRect.left + endRect.width/2, endRect.top + endRect.height/2); playSfx('spPunchline');
                             await new Promise(r => setTimeout(r, 300));
                        } else if (isCareerKiller) {
                             await new Promise(r => setTimeout(r, 200));
                        } else { 
                             let projType: Projectile['type'] = 'orb';
                             if (attacker.rarity === 'rotm' || attacker.rarity === 'icon') projType = 'beam';
                             setProjectiles(prev => [...prev, { id: pid, startX: startRect.left + startRect.width/2, startY: startRect.top + startRect.height/2, endX: endRect.left + endRect.width/2, endY: endRect.top + endRect.height/2, rarity: attacker.rarity, isCrit, type: projType }]);
                             
                             if (!isFreestyler && dealtDamage > 0) {
                                 switch(attacker.rarity) {
                                     case 'bronze': case 'silver': playSfx('attackBronzeSilver'); break;
                                     case 'gold': playSfx('attackGold'); break;
                                     case 'rotm': playSfx('attackRotm'); break;
                                     case 'icon': playSfx('attackIcon'); break;
                                     case 'legend': playSfx('attackIcon'); break;
                                     default: playSfx('attackGold');
                                 }
                             }
                             await new Promise<void>(r => setTimeout(r, 450)); 
                             setProjectiles(prev => prev.filter(p => p.id !== pid));
                        }
                    }
                }

                const updateTeam = (team: BattleCard[]) => team.map(c => c.instanceId === target.instanceId ? applyDamageToCard(c, dealtDamage, isCrit) : c);
                if (target.owner === 'player') setPlayerTeam(prev => updateTeam(prev)); else setCpuTeam(prev => updateTeam(prev));

                const addEffect = (c: BattleCard, effect: ActiveEffect) => ({...c, activeEffects: [...c.activeEffects, effect]});
                const applyEffectToTarget = (effect: ActiveEffect) => {
                    const updater = (team: BattleCard[]) => team.map(c => c.instanceId === target.instanceId ? addEffect(c, effect) : c);
                    if (target.owner === 'player') setPlayerTeam(prev => updater(prev)); else setCpuTeam(prev => updater(prev));
                };

                const targetNode = cardRefs.current[target.instanceId];
                const tr = targetNode?.getBoundingClientRect();

                if (isRhymesCrafter) { 
                    playSfx('spRhymesCrafter'); 
                    if (tr) triggerSpecialEffect('poison-cloud', tr.left + tr.width/2, tr.top + tr.height/2);
                    applyEffectToTarget({ type: 'poison', duration: 3, val: 50, sourceId: attacker.instanceId }); 
                    addToLog(`${target.name} is poisoned!`); 
                }
                else if (isPunchline) { 
                    setSkipNextTurn(target.owner as 'player' | 'cpu'); applyEffectToTarget({ type: 'stun', duration: 2 }); addToLog(`${target.name} is stunned!`); 
                }
                else if (actionName === 'Battler') { 
                    playSfx('battleDebuff'); applyEffectToTarget({ type: 'silence', duration: 999 }); addToLog(`${target.name} is silenced!`); 
                }
                else if (isWordsBender) {
                    playSfx('spWordsBender');
                    if (startRect) triggerSpecialEffect('heal-aura', startRect.left + startRect.width/2, startRect.top + startRect.height/2);
                    const healAmt = dealtDamage;
                    const healSelf = (team: BattleCard[]) => team.map(c => c.instanceId === attacker.instanceId ? { ...c, currentHp: Math.min(c.maxHp, c.currentHp + healAmt) } : c);
                    if (attacker.owner === 'player') setPlayerTeam(prev => healSelf(prev)); else setCpuTeam(prev => healSelf(prev));
                    if (startRect) showFloatText(startRect.left, startRect.top, `+${healAmt}`, '#00ff00');
                }
            }

            setSelectedAttackerId(null); 
            setSelectedAction('standard');

            if (isFlowSwitcher) {
                 playSfx('spFlowSwitcher');
                 addToLog(`${attacker.name} strikes again!`);
                 if (attacker.owner === 'player') {
                     setSelectedAttackerId(attacker.instanceId); 
                     setSelectedAction('standard');
                 } else {
                     setForcedCpuAttackerId(attacker.instanceId);
                 }
                 setIsAnimating(false);
                 return;
            }

            await new Promise<void>(r => setTimeout(r, 800));
            setShakeCardId(null); 
            setShakeIntensity(0);
            setTurn(prev => prev === 'player' ? 'cpu' : 'player');
            
        } catch (error) { 
            console.error("Battle Error:", error); 
            setTurn(prev => prev === 'player' ? 'cpu' : 'player'); 
        } finally { 
            setIsAnimating(false); 
        }
    };

    // PvE Turn Start
    useEffect(() => {
        if (phase !== 'battle') return;
        const currentTeamSetter = turn === 'player' ? setPlayerTeam : setCpuTeam;
        const currentTeam = turn === 'player' ? playerTeam : cpuTeam;
        
        const processedTeam = currentTeam.map(card => {
            let newHp = card.currentHp;
            const newEffects: ActiveEffect[] = [];
            card.activeEffects.forEach(effect => {
                if (effect.type === 'poison' && effect.val) {
                    newHp -= effect.val;
                    if (turn === 'player') showFloatText(window.innerWidth / 4, window.innerHeight / 2, `-${effect.val}`, '#00ff00');
                }
                if (effect.duration > 1) newEffects.push({ ...effect, duration: effect.duration - 1 });
            });
            return { ...card, currentHp: Math.max(0, newHp), activeEffects: newEffects, attacksRemaining: 1 };
        });

        if (JSON.stringify(processedTeam) !== JSON.stringify(currentTeam)) {
            currentTeamSetter(processedTeam);
        }

        if (skipNextTurn === turn) {
            addToLog(`${turn === 'player' ? 'Player' : 'CPU'} turn skipped due to Stun!`);
            const timer = setTimeout(() => {
                setSkipNextTurn(null);
                setTurn(prev => prev === 'player' ? 'cpu' : 'player');
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [turn, phase]);

    // PvE Game Over
    useEffect(() => {
        if (phase !== 'battle' || !isBattleReady) return;
        
        const playerAlive = playerTeam.some(c => c.currentHp > 0);
        const cpuAlive = cpuTeam.some(c => c.currentHp > 0);

        if (!playerAlive) {
            setPhase('result');
            setIsBattleReady(false);
            stopBattleTheme(musicVolume, musicOn); 
            onBattleWin(0, false, subMode === 'online' || subMode === 'invite' || subMode === 'blitz' ? 'challenge' : subMode, playerTeam); 
        } else if (!cpuAlive) {
            // Safety check: ensure CPU team was actually populated and is now dead, not just empty
            if (cpuTeam.length === 0) return;

            const cpuStrength = cpuTeam.reduce((sum, c) => sum + c.ovr, 0);
            const basePoints = Math.floor(cpuStrength * 0.6);
            const survivorBonus = playerTeam.filter(c => c.currentHp > 0).length * 25;
            let calculatedReward = Math.min(420, Math.max(80, basePoints + survivorBonus));
            if (subMode === 'ranked') calculatedReward = Math.floor(calculatedReward * 0.5);

            setReward(calculatedReward);
            setPhase('result');
            setIsBattleReady(false);
            stopBattleTheme(musicVolume, musicOn); 
            playSfx('success');
            const resultMode = subMode === 'online' || subMode === 'invite' ? 'challenge' : subMode;
            onBattleWin(calculatedReward, true, resultMode as 'ranked' | 'challenge' | 'blitz', playerTeam); 
        }
    }, [playerTeam, cpuTeam, phase, subMode, isBattleReady]);

    // PvE AI Logic
    useEffect(() => {
        if (phase !== 'battle' || turn !== 'cpu' || isAnimating || skipNextTurn === 'cpu' || subMode === 'online' || subMode === 'invite' || subMode === 'blitz' || !isBattleReady) return;

        let difficulty = 'normal';
        if (subMode === 'ranked') difficulty = rankSystem[gameState.rank].aiDifficulty;

        const timer = setTimeout(() => {
            let attacker: BattleCard | undefined;
            if (forcedCpuAttackerId) {
                attacker = cpuTeam.find(c => c.instanceId === forcedCpuAttackerId && c.currentHp > 0);
                if (!attacker) setForcedCpuAttackerId(null);
            } 
            if (!attacker) {
                const aiAttackers = cpuTeam.filter(c => c.currentHp > 0 && c.mode === 'attack');
                const capableAttackers = aiAttackers.filter(c => !c.activeEffects.some(e => e.type === 'stun'));
                if (capableAttackers.length === 0) { setTurn('player'); return; }
                attacker = difficulty === 'expert' 
                    ? capableAttackers.reduce((prev, curr) => (curr.atk > prev.atk ? curr : prev))
                    : capableAttackers[Math.floor(Math.random() * capableAttackers.length)];
            }
            if (attacker) {
                if (forcedCpuAttackerId) setForcedCpuAttackerId(null);
                let action = 'standard';
                const availableSupers = attacker.availableSuperpowers;
                const isSilenced = attacker.activeEffects.some(e => e.type === 'silence');
                if (availableSupers.length > 0 && !isSilenced && Math.random() < (difficulty === 'expert' ? 0.6 : 0.3)) {
                    action = availableSupers[0];
                }
                const validTargets = playerTeam.filter(c => isTargetable(c, playerTeam));
                const isNonTargeted = ['Chopper', 'Show Maker', 'ShowMaker', 'Notes Master', 'Note Master', 'Storyteller', 'StoryTeller', 'The Artist'].includes(action);
                if (validTargets.length > 0 || isNonTargeted) {
                    let target = null;
                    if (validTargets.length > 0) {
                        target = (difficulty === 'expert' || difficulty === 'smart')
                            ? (validTargets.find(t => t.currentHp < attacker!.atk) || validTargets.sort((a,b) => a.currentHp - b.currentHp)[0])
                            : validTargets[Math.floor(Math.random() * validTargets.length)];
                    }
                    executeAction(attacker, target, action);
                } else { setTurn('player'); }
            } else { setTurn('player'); }
        }, 1200);
        return () => clearTimeout(timer);
    }, [turn, isAnimating, phase, subMode, skipNextTurn, forcedCpuAttackerId, isBattleReady]);

    const goToTactics = () => {
        const selected = availableCards.filter(c => selectedCardIds.includes(c.id));
        const initialBattleTeam = selected.map((c, i) => calculateStats(c, 'attack', 'player', i));
        setPlayerTeam(initialBattleTeam);
        setPhase('tactics');
        if (subMode === 'blitz') setSetupTimer(15);
        playSfx('buttonClick');
    };

    const toggleCardMode = (instanceId: string) => {
        setPlayerTeam(prev => prev.map(c => {
            if (c.instanceId !== instanceId) return c;
            const newMode = c.mode === 'attack' ? 'defense' : 'attack';
            const hpBase = HP_MULTIPLIERS[c.rarity] || 10;
            const newMaxHp = Math.floor(c.ovr * (hpBase / 10) * (newMode === 'defense' ? 2 : 1));
            const newAtk = newMode === 'defense' ? 0 : Math.floor(c.ovr * (1 + (c.superpowers?.length || 0) * 0.1));
            return { ...c, mode: newMode, maxHp: newMaxHp, currentHp: newMaxHp, atk: newAtk };
        }));
        playSfx('buttonClick');
    };

    const startBattle = () => {
        if (subMode === 'invite' && onStartInviteBattle) {
            onStartInviteBattle(playerTeam);
            return;
        }
        
        // Reset readiness to prevent premature game over checks
        setIsBattleReady(false);

        let ovrRange: [number, number] = [60, 70];
        if (subMode === 'ranked') ovrRange = rankSystem[gameState.rank].cpuOvrRange;
        else if (subMode === 'challenge') {
            const playerAvg = playerTeam.length > 0 ? playerTeam.reduce((sum, c) => sum + c.ovr, 0) / playerTeam.length : 70;
            ovrRange = [Math.floor(playerAvg - 5), Math.ceil(playerAvg + 5)];
        }

        const newCpuTeam: BattleCard[] = [];
        for (let i = 0; i < teamSize; i++) {
            // FIX: Use allCards prop instead of hardcoded
            let pool = allCards.filter(c => c.ovr >= ovrRange[0] && c.ovr <= ovrRange[1]);
            if (pool.length === 0) pool = allCards;
            const randomCard = pool[Math.floor(Math.random() * pool.length)];
            newCpuTeam.push(calculateStats(randomCard, Math.random() < 0.2 ? 'defense' : 'attack', 'cpu', i));
        }

        setCpuTeam(newCpuTeam);
        setBattleLog(["Battle Started! Player's Turn."]);
        setTurn('player');
        setSkipNextTurn(null);
        setReward(0);
        
        // Use timeout to ensure state has settled before enabling game logic
        setTimeout(() => {
            setPhase('battle');
            setIsBattleReady(true);
            playBattleTheme(musicVolume, musicOn);
        }, 100);
    };

    const handleBattleStart = () => {
        if (subMode === 'online' || subMode === 'blitz') setPhase('pvp');
        else startBattle();
    };

    const restartSameTactics = () => {
        setPlayerTeam(prev => resetPlayerTeam(prev));
        startBattle();
    };
    
    const handleReturnToTactics = () => {
        setPlayerTeam(prev => resetPlayerTeam(prev));
        setPhase('tactics');
        if (subMode === 'blitz') setSetupTimer(15);
    };

    const handleCardSelect = (id: string) => {
        if (selectedCardIds.includes(id)) setSelectedCardIds(prev => prev.filter(c => c !== id));
        else if (selectedCardIds.length < teamSize) setSelectedCardIds(prev => [...prev, id]);
    };

    const handleForfeit = () => {
        setPlayerTeam(prev => prev.map(c => ({...c, currentHp: 0})));
        setShowForfeitModal(false);
    }

    // --- RENDER ---

    if (phase === 'pvp') {
        return (
            <PvPBattle 
                gameState={gameState}
                preparedTeam={playerTeam}
                onBattleEnd={(reward, isWin) => onBattleWin(reward, isWin, subMode === 'blitz' ? 'blitz' : 'challenge', [])} 
                onExit={() => { setPhase('mode_select'); stopBattleTheme(musicVolume, musicOn); }}
                playSfx={playSfx}
                musicVolume={musicVolume}
                musicOn={musicOn}
                blitzMode={subMode === 'blitz'} 
            />
        );
    }

    if (phase === 'mode_select') {
        // Prepare rank arrays for rewards
        const rankList = ['Bronze', 'Silver', 'Gold', 'Legend'] as Rank[];
        const blitzRankList = [5, 4, 3, 2, 1] as const;

        return (
            <div className="animate-fadeIn flex flex-col items-center justify-center min-h-[60vh] gap-8 pb-10">
                <h2 className="font-header text-5xl text-white mb-6 drop-shadow-[0_0_10px_#00c7e2]">Choose Your Path</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl justify-center px-4">
                    {/* Ranked */}
                    <div className="flex flex-col items-center gap-4">
                        <div onClick={() => { setSubMode('ranked'); setPhase('selection'); playSfx('buttonClick'); }} className="w-full bg-gradient-to-b from-gray-800 to-black border-2 border-gold-dark/50 hover:border-gold-light rounded-xl p-6 cursor-pointer transform hover:scale-105 transition-all duration-300 flex flex-col items-center text-center shadow-[0_0_20px_rgba(255,215,0,0.1)] hover:shadow-[0_0_30px_rgba(255,215,0,0.3)] h-full justify-between min-h-[280px]">
                            <div>
                                <div className="text-5xl mb-3">🏆</div>
                                <h3 className="font-header text-2xl text-gold-light mb-2">Ranked</h3>
                                <p className="text-gray-400 text-sm mb-3">Climb the ladder from Bronze to Legend.</p>
                            </div>
                            <div className="bg-black/40 w-full p-2 rounded-lg border border-gray-700 space-y-1">
                                <p className="text-green-400 font-bold text-xs">✅ Rank Progress</p>
                                <p className="text-gold-light font-bold text-xs">🎁 Big Rewards</p>
                            </div>
                            <div className="mt-2 text-xs text-gray-500">Current: <span className="text-white font-bold">{gameState.rank}</span></div>
                        </div>
                        <Button variant="default" onClick={() => setShowRankRewards(true)} className="py-2 text-xs w-full">Rewards</Button>
                    </div>

                    {/* Street Fight */}
                    <div className="flex flex-col items-center gap-4">
                        <div onClick={() => { setSubMode('blitz'); setPhase('selection'); playSfx('buttonClick'); }} className="w-full bg-gradient-to-b from-gray-900 to-black border-2 border-red-600/50 hover:border-red-500 rounded-xl p-6 cursor-pointer transform hover:scale-105 transition-all duration-300 flex flex-col items-center text-center shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_30px_rgba(220,38,38,0.4)] h-full justify-between min-h-[280px]">
                            <div>
                                <div className="text-5xl mb-3">🥊</div>
                                <h3 className="font-header text-2xl text-red-500 mb-2">Street Fight</h3>
                                <p className="text-gray-400 text-sm mb-3">Online Ranked Blitz Battles.<br/>2-Min Clock.</p>
                            </div>
                            <div className="bg-black/40 w-full p-2 rounded-lg border border-gray-700 space-y-1">
                                <p className="text-red-400 font-bold text-xs">⏱️ 2 Min Timer</p>
                                <p className="text-green-400 font-bold text-xs">✅ Street Rank</p>
                            </div>
                            <div className="mt-2 text-xs text-gray-500">Street Rank: <span className="text-white font-bold">{gameState.blitzRank || 5}</span></div>
                        </div>
                        <Button variant="default" onClick={() => setShowBlitzRewards(true)} className="py-2 text-xs w-full">Rewards</Button>
                    </div>

                    {/* Casual */}
                    <div className="flex flex-col items-center gap-4">
                        <div onClick={() => { setSubMode('online'); setPhase('selection'); playSfx('buttonClick'); }} className="w-full bg-gradient-to-b from-gray-800 to-black border-2 border-green-900/50 hover:border-green-400 rounded-xl p-6 cursor-pointer transform hover:scale-105 transition-all duration-300 flex flex-col items-center text-center shadow-[0_0_20px_rgba(34,197,94,0.1)] hover:shadow-[0_0_30px_rgba(34,197,94,0.3)] h-full justify-between min-h-[280px]">
                            <div>
                                <div className="text-5xl mb-3">🌍</div>
                                <h3 className="font-header text-2xl text-green-400 mb-2">Casual</h3>
                                <p className="text-gray-400 text-sm mb-3">Battle real players. No pressure.</p>
                            </div>
                            <div className="bg-black/40 w-full p-2 rounded-lg border border-gray-700 space-y-1">
                                <p className="text-green-400 font-bold text-xs">✅ PvP Action</p>
                                <p className="text-gray-500 font-bold text-xs">❌ No Rank</p>
                            </div>
                            <div className="mt-2 text-xs text-gray-500">Online Mode</div>
                        </div>
                    </div>

                    {/* Challenge */}
                    <div className="flex flex-col items-center gap-4">
                        <div onClick={() => { setSubMode('challenge'); setPhase('selection'); playSfx('buttonClick'); }} className="w-full bg-gradient-to-b from-gray-800 to-black border-2 border-blue-900/50 hover:border-blue-400 rounded-xl p-6 cursor-pointer transform hover:scale-105 transition-all duration-300 flex flex-col items-center text-center shadow-[0_0_20px_rgba(0,199,226,0.1)] hover:shadow-[0_0_30px_rgba(0,199,226,0.3)] h-full justify-between min-h-[280px]">
                            <div>
                                <div className="text-5xl mb-3">⚔️</div>
                                <h3 className="font-header text-2xl text-blue-glow mb-2">Practice</h3>
                                <p className="text-gray-400 text-sm mb-3">Casual matches against AI.</p>
                            </div>
                            <div className="bg-black/40 w-full p-2 rounded-lg border border-gray-700 space-y-1">
                                <p className="text-green-400 font-bold text-xs">✅ 100% BP</p>
                                <p className="text-gray-500 font-bold text-xs">❌ No Rank</p>
                            </div>
                            <div className="mt-2 text-xs text-gray-500">PvE Mode</div>
                        </div>
                    </div>
                </div>

                {/* Rank Rewards Modal */}
                <Modal isOpen={showRankRewards} onClose={() => setShowRankRewards(false)} title={t('rank_rewards_title')} size="lg">
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {rankList.map((rankName) => {
                            const config = rankSystem[rankName];
                            const packCounts = config.promotionReward.packs.reduce((acc, p) => { acc[p] = (acc[p] || 0) + 1; return acc; }, {} as Record<PackType, number>);
                            const pickCounts = config.promotionReward.picks.reduce((acc, p) => { acc[p] = (acc[p] || 0) + 1; return acc; }, {} as Record<string, number>);
                            
                            return (
                                <div key={rankName} className="bg-darker-gray/80 p-4 rounded-xl border border-gray-700 relative overflow-hidden">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-header text-2xl text-gold-light">{rankName}</h4>
                                        <span className="text-xs text-gray-400 bg-black/50 px-2 py-1 rounded">{t('reward_wins_required', { wins: config.winsToPromote })}</span>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-3">
                                        {/* Coins */}
                                        <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-lg border border-gold-dark/20">
                                            <span className="text-xl">💰</span>
                                            <span className="font-bold text-white">{config.promotionReward.coins.toLocaleString()}</span>
                                        </div>

                                        {/* Packs */}
                                        {Object.entries(packCounts).map(([type, count]) => (
                                            <div key={type} className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-lg border border-gray-600">
                                                <img src={packImages[type as PackType]} className="w-6 h-auto" alt={type} />
                                                <span className="font-bold text-white">x{count}</span>
                                                <span className="text-xs text-gray-400 capitalize hidden sm:inline">{type}</span>
                                            </div>
                                        ))}

                                        {/* Picks */}
                                        {Object.entries(pickCounts).map(([pickId, count]) => {
                                            const config = playerPickConfigs[pickId];
                                            return (
                                                <div key={pickId} className="flex items-center gap-3 bg-black/40 px-3 py-2 rounded-lg border border-gray-600 min-w-[140px]">
                                                    <div 
                                                        className="w-10 h-14 bg-cover bg-center rounded shadow-sm relative flex items-center justify-center shrink-0"
                                                        style={{ backgroundImage: 'url("https://i.imghippo.com/files/cGUh9927EWc.png")' }}
                                                    >
                                                        <div className="absolute inset-0 bg-black/30 rounded" />
                                                        <span className="text-white text-lg drop-shadow-md font-bold z-10">?</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-white text-sm">x{count}</span>
                                                        <span className="text-[10px] text-gray-300 leading-tight max-w-[120px]">
                                                            {config ? t(config.nameKey as TranslationKey) : 'Player Pick'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 flex justify-center">
                        <Button variant="default" onClick={() => setShowRankRewards(false)}>{t('close')}</Button>
                    </div>
                </Modal>

                {/* Blitz Rewards Modal */}
                <Modal isOpen={showBlitzRewards} onClose={() => setShowBlitzRewards(false)} title="Street Fight Rewards" size="lg">
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {blitzRankList.map((rankNum) => {
                            const config = blitzRankSystem[rankNum];
                            const packCounts = config.promotionReward.packs.reduce((acc, p) => { acc[p] = (acc[p] || 0) + 1; return acc; }, {} as Record<PackType, number>);
                            const pickCounts = config.promotionReward.picks.reduce((acc, p) => { acc[p] = (acc[p] || 0) + 1; return acc; }, {} as Record<string, number>);
                            
                            return (
                                <div key={rankNum} className="bg-darker-gray/80 p-4 rounded-xl border border-red-900/30 relative overflow-hidden">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-header text-2xl text-red-400">Street Rank {rankNum}</h4>
                                        <span className="text-xs text-gray-400 bg-black/50 px-2 py-1 rounded">Promote: {config.winsToPromote} Wins</span>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-3">
                                        {/* Coins */}
                                        <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-lg border border-gold-dark/20">
                                            <span className="text-xl">💰</span>
                                            <div className="flex flex-col leading-none">
                                                <span className="font-bold text-white">{config.promotionReward.coins.toLocaleString()}</span>
                                                <span className="text-[10px] text-gray-400">Coins</span>
                                            </div>
                                        </div>

                                        {/* BP */}
                                        <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-lg border border-blue-500/30">
                                            <span className="text-xl text-blue-400">BP</span>
                                            <div className="flex flex-col leading-none">
                                                <span className="font-bold text-white">{config.promotionReward.bp.toLocaleString()}</span>
                                                <span className="text-[10px] text-gray-400">Points</span>
                                            </div>
                                        </div>

                                        {/* Packs */}
                                        {Object.entries(packCounts).map(([type, count]) => (
                                            <div key={type} className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-lg border border-gray-600">
                                                <img src={packImages[type as PackType]} className="w-6 h-auto" alt={type} />
                                                <span className="font-bold text-white">x{count}</span>
                                                <span className="text-xs text-gray-400 capitalize hidden sm:inline">{type}</span>
                                            </div>
                                        ))}

                                        {/* Picks */}
                                        {Object.entries(pickCounts).map(([pickId, count]) => {
                                            const config = playerPickConfigs[pickId];
                                            return (
                                                <div key={pickId} className="flex items-center gap-3 bg-black/40 px-3 py-2 rounded-lg border border-gray-600 min-w-[140px]">
                                                    <div 
                                                        className="w-10 h-14 bg-cover bg-center rounded shadow-sm relative flex items-center justify-center shrink-0"
                                                        style={{ backgroundImage: 'url("https://i.imghippo.com/files/cGUh9927EWc.png")' }}
                                                    >
                                                        <div className="absolute inset-0 bg-black/30 rounded" />
                                                        <span className="text-white text-lg drop-shadow-md font-bold z-10">?</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-white text-sm">x{count}</span>
                                                        <span className="text-[10px] text-gray-300 leading-tight max-w-[120px]">
                                                            {config ? t(config.nameKey as TranslationKey) : 'Player Pick'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 flex justify-center">
                        <Button variant="default" onClick={() => setShowBlitzRewards(false)}>{t('close')}</Button>
                    </div>
                </Modal>
            </div>
        )
    }

    if (phase === 'selection') {
        const canStart = selectedCardIds.length === teamSize;
        return (
            <div className="animate-fadeIn flex flex-col items-center p-4">
                <div className="flex justify-between w-full max-w-5xl items-center mb-6">
                    <h2 className="font-header text-4xl text-white">Select Your Squad</h2>
                    {/* Setup Timer - BLITZ ONLY */}
                    {subMode === 'blitz' && (
                        <div className={`text-2xl font-header ${setupTimer <= 3 ? 'text-red-500 animate-pulse' : 'text-gold-light'}`}>
                            0:{setupTimer.toString().padStart(2, '0')}
                        </div>
                    )}
                </div>
                
                <div className="text-gray-400 mb-4 text-center">
                    Select <span className="text-gold-light font-bold">{teamSize}</span> cards for this battle.
                    {subMode === 'challenge' && (
                        <div className="mt-2 text-sm">
                            <span className="mr-2 text-gray-500">Mode:</span>
                            <select value={teamSize} onChange={(e) => { setTeamSize(Number(e.target.value)); setSelectedCardIds([]); }} className="bg-darker-gray text-white p-1 rounded border border-gray-600">
                                <option value={5}>5v5</option>
                                <option value={6}>6v6</option>
                                <option value={7}>7v7</option>
                                <option value={8}>8v8</option>
                            </select>
                        </div>
                    )}
                </div>
                
                <div className="flex flex-wrap justify-center gap-4 mb-20 max-w-5xl">
                    {availableCards.map(card => {
                        const isSelected = selectedCardIds.includes(card.id);
                        return (
                            <div key={card.id} onClick={() => { if (selectedCardIds.includes(card.id)) setSelectedCardIds(prev => prev.filter(c => c !== card.id)); else if (selectedCardIds.length < teamSize) setSelectedCardIds(prev => [...prev, card.id]); }} className={`relative cursor-pointer transition-all duration-200 ${isSelected ? 'scale-105 ring-4 ring-green-500 rounded-lg shadow-[0_0_15px_#22c55e]' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}>
                                <Card card={card} className="!w-[100px] !h-[150px]" />
                                {isSelected && <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs border border-white">✓</div>}
                            </div>
                        );
                    })}
                </div>

                <div className="fixed bottom-0 left-0 right-0 bg-black/80 p-4 border-t border-gold-dark/30 flex justify-center gap-4 backdrop-blur-md z-50">
                    <Button variant="default" onClick={() => { setPhase('mode_select'); setSelectedCardIds([]); }}>Back</Button>
                    <Button variant="cta" onClick={goToTactics} disabled={!canStart} className="w-48 shadow-lg">Next: Tactics</Button>
                </div>
            </div>
        );
    }

    if (phase === 'tactics') {
        const avgOvr = Math.round(playerTeam.reduce((sum, c) => sum + c.ovr, 0) / playerTeam.length);
        const totalAtk = playerTeam.reduce((sum, c) => sum + c.atk, 0);
        
        return (
            <div className="animate-fadeIn flex flex-col items-center p-4 min-h-screen pb-32">
                <div className="flex justify-between w-full max-w-6xl items-center mb-2">
                    <h2 className="font-header text-4xl text-white">Tactics Setup</h2>
                    {/* Setup Timer - BLITZ ONLY */}
                    {subMode === 'blitz' && (
                        <div className={`text-2xl font-header ${setupTimer <= 3 ? 'text-red-500 animate-pulse' : 'text-gold-light'}`}>
                            0:{setupTimer.toString().padStart(2, '0')}
                        </div>
                    )}
                </div>
                
                <p className="text-gray-400 mb-6 text-center text-sm md:text-base">Tap card to toggle <span className="text-red-400 font-bold">ATTACK</span> / <span className="text-blue-400 font-bold">DEFENSE</span> mode.</p>
                
                <div className="flex flex-wrap justify-center gap-6 mb-8 w-full max-w-6xl">
                    {playerTeam.map(card => (
                        <div key={card.instanceId} onClick={() => {
                            setPlayerTeam(prev => prev.map(c => c.instanceId === card.instanceId ? calculateStats(c, c.mode === 'attack' ? 'defense' : 'attack', 'player', 0) : c));
                            playSfx('buttonClick');
                        }} className="flex flex-col items-center cursor-pointer group">
                            <div className="relative">
                                <BattleCardRender card={card} isInteractable={false} shakeIntensity={0} onRef={() => {}} smallScale={false} />
                                <div className={`absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg`}>
                                    <span className="font-header text-white text-xl">Switch</span>
                                </div>
                            </div>
                            <div className={`mt-2 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${card.mode === 'attack' ? 'bg-red-900/50 text-red-300 border border-red-800' : 'bg-blue-900/50 text-blue-300 border border-blue-800'}`}>
                                {card.mode}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-black/40 p-4 rounded-xl border border-gray-700 flex gap-8 mb-4">
                    <div className="text-center"><p className="text-gray-400 text-xs">AVG OVR</p><p className="text-gold-light font-header text-2xl">{avgOvr}</p></div>
                    <div className="text-center"><p className="text-gray-400 text-xs">TOTAL ATK</p><p className="text-red-400 font-header text-2xl">{totalAtk}</p></div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 bg-black/80 p-4 border-t border-gold-dark/30 flex justify-center gap-4 backdrop-blur-md z-50">
                    <Button variant="default" onClick={() => setPhase('selection')}>Back</Button>
                    <Button variant="cta" onClick={handleBattleStart} className="w-48 shadow-blue-glow animate-pulse">Start Battle</Button>
                </div>
            </div>
        );
    }

    if (phase === 'result') {
        const isWin = reward > 0;
        return (
            <div className="animate-fadeIn flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
                <h2 className={`font-header text-6xl md:text-8xl drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] ${isWin ? 'text-green-400' : 'text-red-500'}`}>{isWin ? "VICTORY" : "DEFEAT"}</h2>
                {isWin && (
                    <div className="bg-black/40 p-6 rounded-xl border border-gold-dark/50 flex flex-col items-center gap-2 animate-bounce">
                        <span className="text-gray-300 uppercase tracking-widest text-sm">Reward</span>
                        <div className="flex items-center gap-2">
                            <span className="text-4xl">⚔️</span>
                            <span className="font-header text-5xl text-blue-glow">{reward} BP</span>
                        </div>
                    </div>
                )}
                <div className="flex flex-col gap-3 mt-8 w-full max-w-xs">
                    {(subMode === 'challenge' || subMode === 'ranked') && (
                        <Button variant="keep" onClick={() => { setPlayerTeam(resetPlayerTeam(playerTeam)); startBattle(); }} className="w-full">{t('battle_opt_same_tactics')}</Button>
                    )}
                    <Button variant="default" onClick={handleReturnToTactics} className="w-full">{t('battle_opt_change_tactics')}</Button>
                    <Button variant="default" onClick={() => { setPhase('selection'); setSelectedCardIds([]); }} className="w-full">{t('battle_opt_new_squad')}</Button>
                    <Button variant="sell" onClick={() => setPhase('mode_select')} className="w-full mt-4">{t('battle_opt_change_mode')}</Button>
                </div>
            </div>
        );
    }

    // PvE Battle Render
    const activeAttacker = selectedAttackerId ? playerTeam.find(c => c.instanceId === selectedAttackerId) : null;

    if (phase === 'battle') {
        return (
            <div className="animate-fadeIn relative w-full max-w-6xl mx-auto min-h-[80vh] flex flex-col justify-between py-4">
                {/* Forfeit Button for PvE */}
                <div className="absolute top-0 right-0 z-[60]">
                    <Button variant="sell" onClick={() => setShowForfeitModal(true)} className="py-1 px-3 text-xs bg-red-900/80 border-red-700 hover:bg-red-800">
                        Give Up
                    </Button>
                </div>

                <Modal isOpen={showForfeitModal} onClose={() => setShowForfeitModal(false)} title="Give Up?">
                    <p className="text-white mb-6">Are you sure you want to forfeit? This will count as a loss.</p>
                    <div className="flex justify-center gap-4">
                        <Button variant="sell" onClick={() => { setPlayerTeam(prev => prev.map(c => ({...c, currentHp: 0}))); setShowForfeitModal(false); }}>Yes, I Give Up</Button>
                        <Button variant="default" onClick={() => setShowForfeitModal(false)}>Cancel</Button>
                    </div>
                </Modal>

                {/* Particles & Effects Layers */}
                {hitParticles.map(p => (
                    <div key={p.id} className="fixed rounded-full pointer-events-none z-50" style={{ left: p.x, top: p.y, width: p.size, height: p.size, backgroundColor: p.color, opacity: Math.min(1, p.life) }} />
                ))}
                {floatingTexts.map(ft => (
                    <div key={ft.id} className="fixed text-4xl font-header font-bold z-50 pointer-events-none drop-shadow-md transition-transform" style={{ left: ft.x, top: ft.y, color: ft.color, transform: `scale(${ft.scale})` }}>{ft.text}</div>
                ))}
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

                {/* PvE Arena Layout */}
                <div className="flex justify-center gap-2 md:gap-6 perspective-[1000px] flex-wrap">
                    {cpuTeam.map(card => {
                        const targetable = turn === 'player' && !!selectedAttackerId && isTargetable(card, cpuTeam);
                        return (<BattleCardRender key={card.instanceId} card={card} isInteractable={targetable} shakeIntensity={shakeCardId === card.instanceId ? shakeIntensity : 0} onRef={(el) => cardRefs.current[card.instanceId] = el} onClick={() => { const attacker = playerTeam.find(c => c.instanceId === selectedAttackerId); if (attacker) executeAction(attacker, card); }} smallScale={teamSize > 5} />);
                    })}
                </div>

                <div className="flex flex-col items-center justify-center gap-4 my-4 relative">
                    <div className={`text-2xl md:text-3xl font-header px-6 md:px-8 py-2 rounded-full border-2 transition-colors ${turn === 'player' ? 'bg-blue-600/50 border-blue-400 text-white shadow-[0_0_20px_#2563eb]' : 'bg-red-600/50 border-red-400 text-white shadow-[0_0_20px_#dc2626]'}`}>{turn === 'player' ? "YOUR TURN" : "ENEMY TURN"}</div>
                    <div className="relative w-full max-w-2xl flex justify-center items-start h-20">
                        {activeAttacker && turn === 'player' ? (
                            <div className="flex flex-col items-center animate-fadeIn bg-black/80 p-2 rounded-lg border border-gold-dark/50 z-30 max-w-[95%] md:max-w-xl">
                                {selectedAction !== 'standard' && (
                                    <div className="text-gold-light text-xs md:text-sm mb-2 text-center w-full border-b border-white/10 pb-1">
                                        {SUPERPOWER_DESC[selectedAction] || "Special Ability"}
                                    </div>
                                )}
                                
                                <div className="flex gap-2 flex-wrap justify-center">
                                    <button onClick={() => setSelectedAction('standard')} className={`px-3 md:px-4 py-1 md:py-2 rounded border-2 font-bold transition-all ${selectedAction === 'standard' ? 'bg-white text-black border-gold-light scale-105' : 'bg-black/60 text-gray-300 border-gray-600'}`}>Attack</button>
                                    {activeAttacker.availableSuperpowers.map(sp => {
                                        const isSilenced = activeAttacker.activeEffects.some(e => e.type === 'silence');
                                        const isImmediate = ['Show Maker', 'ShowMaker', 'Chopper', 'Notes Master', 'Note Master', 'The Artist', 'Storyteller', 'StoryTeller'].includes(sp);
                                        return (
                                            <button key={sp} onClick={() => { if (isSilenced) return; setSelectedAction(sp); if (isImmediate) executeAction(activeAttacker, null, sp); }} disabled={isSilenced} className={`px-3 md:px-4 py-1 md:py-2 rounded border-2 font-bold flex items-center gap-2 transition-all relative ${selectedAction === sp ? 'bg-blue-600 text-white border-blue-300 scale-105 shadow-[0_0_10px_#2563eb]' : 'bg-black/60 text-blue-300 border-blue-800'} ${isSilenced ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
                                                <span className="text-xs uppercase">{sp}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (<div className="text-center text-gray-300 text-sm font-mono max-w-md bg-black/40 p-2 rounded">{battleLog[0]}</div>)}
                    </div>
                </div>

                <div className="flex justify-center gap-2 md:gap-6 flex-wrap">
                    {playerTeam.map(card => {
                        const isStunned = card.activeEffects.some(e => e.type === 'stun');
                        const canAttack = turn === 'player' && card.mode === 'attack' && card.currentHp > 0 && !isStunned;
                        return (<BattleCardRender key={card.instanceId} card={card} isInteractable={canAttack} isSelected={selectedAttackerId === card.instanceId} shakeIntensity={shakeCardId === card.instanceId ? shakeIntensity : 0} onRef={(el) => cardRefs.current[card.instanceId] = el} onClick={() => { if (canAttack) { setSelectedAttackerId(card.instanceId); setSelectedAction('standard'); } }} smallScale={teamSize > 5} />);
                    })}
                </div>
            </div>
        );
    }

    return null;
};

export default Battle;
