
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc, setDoc, onSnapshot, increment, collection, query, where, getDocs, arrayUnion, arrayRemove, writeBatch, deleteField, addDoc } from 'firebase/firestore';
import Button from '../Button';
import { GlobalSettings, GameState, Card, Rarity, Stats, RarityDefinition, PackData, PlayerPickConfig, InboxMessage } from '../../types';
import { TranslationKey } from '../../utils/translations';
import { packs as defaultPacks, playerPickConfigs as defaultPicks } from '../../data/gameData';
import CardComponent from '../Card';
import { useRarity } from '../../contexts/RarityContext';

interface ControlRoomProps {
    globalSettings: GlobalSettings;
    onClose: () => void;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
    allCards: Card[];
}

const DEFAULT_PACK_META: Record<string, { name: string, image: string }> = {
    free: { name: 'Free Pack', image: 'https://i.postimg.cc/R0sYyFhL/Free.png' },
    bronze: { name: 'Bronze Pack', image: 'https://i.imghippo.com/files/KCG5562T.png' },
    builder: { name: 'Builder Pack', image: 'https://i.postimg.cc/1z5Tv6mz/Builder.png' },
    special: { name: 'Special Pack', image: 'https://i.postimg.cc/sxS0M4cT/Special.png' },
    legendary: { name: 'Legendary Pack', image: 'https://i.postimg.cc/63Fm6md7/Legendary.png' }
};

const ControlRoom: React.FC<ControlRoomProps> = ({ globalSettings, onClose, t, allCards }) => {
    const [settings, setSettings] = useState<GlobalSettings>(globalSettings);
    const { rarities, sortedRarities } = useRarity();
    
    // User & Announcement State
    const [announcementMsg, setAnnouncementMsg] = useState(globalSettings.announcement?.message || '');
    const [announcementType, setAnnouncementType] = useState<'info' | 'warning' | 'success'>(globalSettings.announcement?.type || 'info');
    const [targetUserId, setTargetUserId] = useState('');
    const [targetUser, setTargetUser] = useState<GameState | null>(null);
    const [userMessage, setUserMessage] = useState('');
    const [isLoadingUser, setIsLoadingUser] = useState(false);

    // Gifting State
    const [giftType, setGiftType] = useState<'coins' | 'bp' | 'pack' | 'pick' | 'card'>('coins');
    const [giftAmount, setGiftAmount] = useState<number>(10000);
    const [giftId, setGiftId] = useState<string>(''); // For pack/pick/card ID
    const [giftMessage, setGiftMessage] = useState<string>('Here is a reward from the team!');
    const [giftSearch, setGiftSearch] = useState(''); // For card search

    // Card Management State
    const [cardSearch, setCardSearch] = useState('');
    const [filteredCards, setFilteredCards] = useState<Card[]>([]);

    // --- CARD CREATOR / EDITOR STATE ---
    const [editingCardId, setEditingCardId] = useState<string | null>(null);
    const [newCard, setNewCard] = useState<{
        name: string;
        rarity: Rarity;
        ovr: number;
        image: string;
        value: number;
        superpowers: string[];
        stats: Stats;
    }>({
        name: '',
        rarity: 'gold',
        ovr: 80,
        image: '',
        value: 10000,
        superpowers: [],
        stats: { lyrc: 80, flow: 80, sing: 80, live: 80, diss: 80, char: 80 }
    });
    const [createMessage, setCreateMessage] = useState('');
    const cardFormRef = useRef<HTMLDivElement>(null);

    // --- RARITY EDITOR STATE ---
    const [newRarity, setNewRarity] = useState<RarityDefinition>({
        id: '',
        name: '',
        rank: 8,
        color: '#ffffff',
        baseImage: '',
        animationTier: 3
    });
    const [rarityMessage, setRarityMessage] = useState('');

    // --- PACK MANAGER STATE ---
    const [customPacks, setCustomPacks] = useState<Record<string, PackData>>({});
    const [newPack, setNewPack] = useState<PackData & { id: string }>({
        id: '',
        name: '',
        cost: 1000,
        bpCost: 0,
        rarityChances: {},
        image: '',
        active: true
    });
    const [packMessage, setPackMessage] = useState('');
    const [editingPackId, setEditingPackId] = useState<string | null>(null);

    // --- PICK CREATOR STATE ---
    const [customPicks, setCustomPicks] = useState<Record<string, PlayerPickConfig>>({});
    const [newPick, setNewPick] = useState<PlayerPickConfig>({
        id: '',
        nameKey: '', // Auto-set
        name: '',
        pickCount: 1,
        totalOptions: 3,
        minOvr: 75,
        cost: 0,
        rarityGuarantee: undefined,
        active: true
    });
    const [pickMessage, setPickMessage] = useState('');
    const [editingPickId, setEditingPickId] = useState<string | null>(null);

    useEffect(() => {
        setSettings(globalSettings);
        if (globalSettings.announcement) {
            setAnnouncementMsg(globalSettings.announcement.message);
            setAnnouncementType(globalSettings.announcement.type);
        }
    }, [globalSettings]);

    // Fetch packs
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'packs'), (docSnap) => {
            if (docSnap.exists()) {
                setCustomPacks(docSnap.data() as Record<string, PackData>);
            }
        });
        return () => unsub();
    }, []);

    // Fetch picks
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'playerPicks'), (docSnap) => {
            if (docSnap.exists()) {
                setCustomPicks(docSnap.data() as Record<string, PlayerPickConfig>);
            }
        });
        return () => unsub();
    }, []);

    // Filter cards based on search
    useEffect(() => {
        if (!cardSearch.trim()) {
            setFilteredCards([]);
            return;
        }
        const lowerSearch = cardSearch.toLowerCase();
        setFilteredCards(allCards.filter(c => c.name.toLowerCase().includes(lowerSearch) || c.id.toLowerCase().includes(lowerSearch)));
    }, [cardSearch, allCards]);

    // --- Settings Logic ---
    const toggleSetting = async (key: keyof GlobalSettings) => {
        const newValue = !settings[key];
        setSettings(prev => ({ ...prev, [key]: newValue }));
        try { await setDoc(doc(db, 'settings', 'global'), { [key]: newValue }, { merge: true }); }
        catch (e) { setSettings(prev => ({ ...prev, [key]: !newValue })); }
    };

    const togglePromo = async (promo: Rarity) => {
        const currentPromos = settings.activePromos || [];
        const isActive = currentPromos.includes(promo);
        let newPromos = isActive ? currentPromos.filter(p => p !== promo) : [...currentPromos, promo];
        setSettings(prev => ({ ...prev, activePromos: newPromos }));
        try { await setDoc(doc(db, 'settings', 'global'), { activePromos: newPromos }, { merge: true }); }
        catch (e) { setSettings(prev => ({ ...prev, activePromos: currentPromos })); }
    };

    const updateAnnouncement = async (isActive: boolean) => {
        try { await setDoc(doc(db, 'settings', 'global'), { announcement: { active: isActive, message: announcementMsg, type: announcementType } }, { merge: true }); }
        catch (e) { console.error(e); }
    }

    // --- User & Gift Management Logic ---
    const fetchUser = async () => {
        if (!targetUserId.trim()) return;
        setIsLoadingUser(true); setUserMessage(''); setTargetUser(null);
        try {
            let docSnap = await getDoc(doc(db, 'users', targetUserId));
            if (!docSnap.exists()) {
                const q = query(collection(db, 'users'), where('userProfile.username', '==', targetUserId));
                const querySnap = await getDocs(q);
                if (!querySnap.empty) docSnap = querySnap.docs[0];
            }
            if (docSnap.exists()) {
                setTargetUser({ ...(docSnap.data() as GameState), userId: docSnap.id });
                setUserMessage('User found.');
            } else setUserMessage('User not found.');
        } catch (e) { console.error(e); setUserMessage('Error fetching user.'); } finally { setIsLoadingUser(false); }
    };

    const handleBanUser = async () => { if (targetUser) { const newBanStatus = !targetUser.banned; await updateDoc(doc(db, 'users', targetUser.userId), { banned: newBanStatus }); setTargetUser(prev => prev ? ({ ...prev, banned: newBanStatus }) : null); } };
    
    const handleSendGift = async () => {
        if (!targetUser) return;
        if (!giftMessage.trim()) { alert("Please enter a message."); return; }
        if ((giftType === 'pack' || giftType === 'pick' || giftType === 'card') && !giftId) { alert("Please select an item."); return; }

        try {
            const inboxRef = collection(db, 'users', targetUser.userId, 'inbox');
            
            const rewardsPayload: InboxMessage['rewards'] = {};
            if (giftType === 'coins') rewardsPayload.coins = giftAmount;
            if (giftType === 'bp') rewardsPayload.bp = giftAmount;
            if (giftType === 'pack') rewardsPayload.packs = Array(Math.max(1, giftAmount)).fill(giftId); // Reusing Amount for Quantity
            if (giftType === 'pick') rewardsPayload.picks = Array(Math.max(1, giftAmount)).fill(giftId);
            if (giftType === 'card') rewardsPayload.cards = Array(Math.max(1, giftAmount)).fill(giftId);

            const message: InboxMessage = {
                id: '', // Firestore generates
                type: 'admin_gift',
                title: 'Admin Reward',
                message: giftMessage,
                rewards: rewardsPayload,
                timestamp: Date.now()
            };

            await addDoc(inboxRef, message);
            setUserMessage(`Successfully sent ${giftType} to ${targetUser.userProfile?.username || targetUser.userId}.`);
        } catch (e: any) {
            console.error(e);
            setUserMessage(`Error sending gift: ${e.message}`);
        }
    };

    const toggleCardStatus = async (cardId: string) => {
        const isDisabled = settings.disabledCardIds?.includes(cardId);
        try {
            const settingsRef = doc(db, 'settings', 'global');
            await updateDoc(settingsRef, { disabledCardIds: isDisabled ? arrayRemove(cardId) : arrayUnion(cardId) });
        } catch (e) { console.error("Failed to toggle card status:", e); }
    };

    // --- Card Creator / Editor Logic ---
    const handleStatChange = (stat: keyof Stats, val: string) => setNewCard(prev => ({ ...prev, stats: { ...prev.stats, [stat]: parseInt(val) || 0 } }));
    const toggleNewSuperpower = (sp: string) => setNewCard(prev => { const exists = prev.superpowers.includes(sp); return { ...prev, superpowers: exists ? prev.superpowers.filter(s => s !== sp) : [...prev.superpowers, sp] }; });
    const autoCalcValue = () => { const base = newCard.ovr * 100; const rarityMult = { bronze: 1, silver: 3, gold: 10, rotm: 20, icon: 30, legend: 50, event: 25 }[newCard.rarity] || 1; setNewCard(prev => ({ ...prev, value: base * rarityMult })); };

    const handleCreateCard = async () => {
        if (!newCard.name || !newCard.image) { setCreateMessage("Name and Image URL required."); return; }
        
        // If editing, keep ID. If creating, generate ID.
        let id = editingCardId;
        if (!id) {
            id = `${newCard.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${newCard.rarity}_${newCard.ovr}`;
        }

        const cardData: Card = { id, ...newCard };
        try {
            await setDoc(doc(db, 'game_cards', id), cardData);
            setCreateMessage(`Card '${newCard.name}' ${editingCardId ? 'updated' : 'created'} successfully! ID: ${id}`);
            // Reset logic
            setNewCard(prev => ({ ...prev, name: '', image: '', superpowers: [] }));
            setEditingCardId(null);
        } catch (e: any) { setCreateMessage(`Error: ${e.message}`); }
    };

    const loadCardForEdit = (card: Card) => {
        setNewCard({
            name: card.name,
            rarity: card.rarity,
            ovr: card.ovr,
            image: card.image,
            value: card.value,
            superpowers: card.superpowers || [],
            stats: card.stats || { lyrc: 80, flow: 80, sing: 80, live: 80, diss: 80, char: 80 }
        });
        setEditingCardId(card.id);
        cardFormRef.current?.scrollIntoView({ behavior: 'smooth' });
        setCreateMessage(`Editing mode: ${card.name}`);
    };

    const cancelCardEdit = () => {
        setNewCard({ name: '', rarity: 'gold', ovr: 80, image: '', value: 10000, superpowers: [], stats: { lyrc: 80, flow: 80, sing: 80, live: 80, diss: 80, char: 80 } });
        setEditingCardId(null);
        setCreateMessage('');
    }

    // --- Rarity Manager Logic ---
    const handleCreateRarity = async () => {
        if (!newRarity.name || !newRarity.baseImage || !newRarity.id) { setRarityMessage("ID, Name, and Base Image required."); return; }
        try {
            const raritiesRef = doc(db, 'settings', 'rarities');
            const docSnap = await getDoc(raritiesRef);
            let list: RarityDefinition[] = [];
            if(docSnap.exists()) list = docSnap.data().list || [];
            list = list.filter(r => r.id !== newRarity.id);
            list.push(newRarity);
            await setDoc(raritiesRef, { list });
            setRarityMessage(`Rarity '${newRarity.name}' saved!`);
            setNewRarity({ id: '', name: '', rank: 8, color: '#ffffff', baseImage: '', animationTier: 3 });
        } catch (e: any) { setRarityMessage(`Error: ${e.message}`); }
    };

    const handleEditRarity = (rarity: RarityDefinition) => {
        setNewRarity(rarity);
        setRarityMessage(`Editing rarity: ${rarity.name}`);
    };

    const handleDeleteRarity = async (rarityId: string) => {
        if (!window.confirm(`Delete rarity ${rarityId}?`)) return;
        try {
            const raritiesRef = doc(db, 'settings', 'rarities');
            const docSnap = await getDoc(raritiesRef);
            let list: RarityDefinition[] = [];
            if(docSnap.exists()) list = docSnap.data().list || [];
            list = list.filter(r => r.id !== rarityId);
            await setDoc(raritiesRef, { list });
            setRarityMessage(`Rarity ${rarityId} deleted.`);
        } catch(e: any) { setRarityMessage(`Error: ${e.message}`); }
    }

    // --- Pack Manager Logic ---
    const handlePackRarityChange = (rarity: string, val: string) => {
        const chance = parseFloat(val) || 0;
        setNewPack(prev => ({ ...prev, rarityChances: { ...prev.rarityChances, [rarity]: chance } }));
    };

    const handleCreatePack = async () => {
        if (!newPack.id || !newPack.name) { setPackMessage("Pack ID and Name required."); return; }
        const totalChance = (Object.values(newPack.rarityChances) as number[]).reduce((sum, c) => sum + c, 0);
        if (Math.abs(totalChance - 100) > 0.1) { setPackMessage(`Error: Chances sum to ${totalChance}%, must be 100%.`); return; }

        try {
            const packsRef = doc(db, 'settings', 'packs');
            const packDataToSave = { ...newPack, active: newPack.active !== false };
            await setDoc(packsRef, { [newPack.id]: packDataToSave }, { merge: true });
            setPackMessage(`Pack '${newPack.name}' saved!`);
            setNewPack({ id: '', name: '', cost: 1000, bpCost: 0, rarityChances: {}, image: '', active: true });
            setEditingPackId(null);
        } catch (e: any) { setPackMessage(`Error: ${e.message}`); }
    };

    const handleEditPack = (packId: string, data: PackData) => {
        const defaults = DEFAULT_PACK_META[packId] || { name: '', image: '' };
        setNewPack({
            id: packId,
            name: data.name || defaults.name || packId,
            cost: data.cost,
            bpCost: data.bpCost || 0,
            rarityChances: data.rarityChances || {},
            image: data.image || defaults.image || '',
            active: data.active !== false
        });
        setEditingPackId(packId);
        setPackMessage(`Editing pack: ${data.name || defaults.name || packId}`);
    };

    const handleTogglePackStatus = async (packId: string, currentActive: boolean) => {
        const newStatus = !currentActive;
        try {
            const packsRef = doc(db, 'settings', 'packs');
            await setDoc(packsRef, { [packId]: { active: newStatus } }, { merge: true });
            setPackMessage(`Pack ${packId} is now ${newStatus ? 'ACTIVE' : 'INACTIVE'}.`);
        } catch(e: any) { setPackMessage(`Error: ${e.message}`); }
    };

    // --- PICK CREATOR LOGIC ---
    const handleCreatePick = async () => {
        if (!newPick.id || !newPick.name) { setPickMessage("Pick ID and Name required."); return; }
        
        const configToSave: any = {
            ...newPick,
            nameKey: newPick.nameKey || newPick.id,
            active: newPick.active !== false
        };
        
        if (!configToSave.rarityGuarantee) delete configToSave.rarityGuarantee;

        try {
            const picksRef = doc(db, 'settings', 'playerPicks');
            await setDoc(picksRef, { [newPick.id]: configToSave }, { merge: true });
            setPickMessage(`Pick '${newPick.name}' saved!`);
            setNewPick({ id: '', nameKey: '', name: '', pickCount: 1, totalOptions: 3, minOvr: 75, cost: 0, rarityGuarantee: undefined, active: true });
            setEditingPickId(null);
        } catch (e: any) { setPickMessage(`Error: ${e.message}`); }
    };

    const handleEditPick = (pickId: string, config: PlayerPickConfig) => {
        setNewPick({
            id: pickId,
            nameKey: config.nameKey || pickId,
            name: config.name || t(config.nameKey as TranslationKey) || pickId,
            pickCount: config.pickCount,
            totalOptions: config.totalOptions,
            minOvr: config.minOvr,
            cost: config.cost || 0,
            rarityGuarantee: config.rarityGuarantee,
            active: config.active !== false
        });
        setEditingPickId(pickId);
        setPickMessage(`Editing Pick: ${pickId}`);
    };

    const handleTogglePickStatus = async (pickId: string, currentActive: boolean) => {
        const newStatus = !currentActive;
        try {
            const picksRef = doc(db, 'settings', 'playerPicks');
            await setDoc(picksRef, { [pickId]: { active: newStatus } }, { merge: true });
            setPickMessage(`Pick ${pickId} is now ${newStatus ? 'ACTIVE' : 'INACTIVE'}.`);
        } catch (e: any) { setPickMessage(`Error: ${e.message}`); }
    };

    // Helper for Card Search in Gift
    const filteredGiftCards = allCards.filter(c => c.name.toLowerCase().includes(giftSearch.toLowerCase()));

    return (
        <div className="animate-fadeIn w-full max-w-6xl mx-auto pb-12">
            <div className="flex justify-between items-center mb-8 bg-gray-900 p-4 rounded-lg border border-red-900/50">
                <h2 className="font-header text-4xl text-red-500">CONTROL ROOM</h2>
                <Button variant="default" onClick={onClose} className="px-4 py-2 text-sm">{t('close')}</Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* User Management & Gifting */}
                <div className="bg-black/40 p-6 rounded-xl border border-gray-700 h-fit">
                    <h3 className="text-2xl font-header text-white mb-4 border-b border-gray-700 pb-2">User Management</h3>
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            placeholder="Username or UID" 
                            value={targetUserId} 
                            onChange={e => setTargetUserId(e.target.value)} 
                            className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white flex-grow"
                        />
                        <Button variant="default" onClick={fetchUser} disabled={isLoadingUser}>{isLoadingUser ? '...' : 'Find'}</Button>
                    </div>
                    {userMessage && <p className="text-sm text-yellow-400 mb-2">{userMessage}</p>}
                    
                    {targetUser && (
                        <div className="bg-gray-800/50 p-4 rounded border border-gray-600 space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-white font-bold">{targetUser.userProfile?.username || 'Unknown'}</p>
                                    <p className="text-xs text-gray-400">{targetUser.userId}</p>
                                    <p className="text-xs text-gold-light">{targetUser.coins.toLocaleString()} Coins | {targetUser.battlePoints || 0} BP</p>
                                </div>
                                <Button variant={targetUser.banned ? 'keep' : 'sell'} onClick={handleBanUser} className="text-xs py-1 px-3">
                                    {targetUser.banned ? 'Unban' : 'Ban'}
                                </Button>
                            </div>

                            {/* Enhanced Gifting Section */}
                            <div className="border-t border-gray-700 pt-4 mt-2">
                                <h4 className="text-gold-light font-bold mb-2">Send Reward / Gift</h4>
                                
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <select value={giftType} onChange={e => setGiftType(e.target.value as any)} className="bg-black border border-gray-600 rounded p-2 text-white text-sm">
                                            <option value="coins">Coins</option>
                                            <option value="bp">Battle Points</option>
                                            <option value="pack">Pack</option>
                                            <option value="pick">Player Pick</option>
                                            <option value="card">Specific Card</option>
                                        </select>
                                        {(giftType === 'coins' || giftType === 'bp') ? (
                                            <input type="number" placeholder="Amount" value={giftAmount} onChange={e => setGiftAmount(parseInt(e.target.value) || 0)} className="bg-black border border-gray-600 rounded p-2 text-white text-sm w-full" />
                                        ) : (
                                            <input type="number" placeholder="Quantity" value={giftAmount} onChange={e => setGiftAmount(parseInt(e.target.value) || 1)} className="bg-black border border-gray-600 rounded p-2 text-white text-sm w-20" />
                                        )}
                                    </div>

                                    {/* Item Selectors */}
                                    {giftType === 'pack' && (
                                        <select value={giftId} onChange={e => setGiftId(e.target.value)} className="w-full bg-black border border-gray-600 rounded p-2 text-white text-sm">
                                            <option value="">Select Pack...</option>
                                            {Object.entries({...defaultPacks, ...customPacks}).map(([id, data]) => {
                                                const p = data as PackData;
                                                return (
                                                    <option key={id} value={id}>{p.name || id}</option>
                                                );
                                            })}
                                        </select>
                                    )}
                                    {giftType === 'pick' && (
                                        <select value={giftId} onChange={e => setGiftId(e.target.value)} className="w-full bg-black border border-gray-600 rounded p-2 text-white text-sm">
                                            <option value="">Select Pick...</option>
                                            {Object.entries({...defaultPicks, ...customPicks}).map(([id, data]) => {
                                                const p = data as PlayerPickConfig;
                                                return (
                                                    <option key={id} value={id}>{p.name || t(p.nameKey as TranslationKey) || id}</option>
                                                );
                                            })}
                                        </select>
                                    )}
                                    {giftType === 'card' && (
                                        <div className="relative">
                                            <input type="text" placeholder="Search Card..." value={giftSearch} onChange={e => setGiftSearch(e.target.value)} className="w-full bg-black border border-gray-600 rounded p-2 text-white text-sm" />
                                            {giftSearch && (
                                                <div className="absolute z-10 w-full bg-gray-900 border border-gray-600 max-h-40 overflow-y-auto mt-1">
                                                    {filteredGiftCards.slice(0, 10).map(c => (
                                                        <div key={c.id} onClick={() => { setGiftId(c.id); setGiftSearch(c.name); }} className="p-2 hover:bg-gray-700 cursor-pointer text-xs text-white">
                                                            {c.name} ({c.rarity})
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {giftId && <p className="text-xs text-green-400 mt-1">Selected ID: {giftId}</p>}
                                        </div>
                                    )}

                                    <textarea 
                                        placeholder="Message to user..." 
                                        value={giftMessage} 
                                        onChange={e => setGiftMessage(e.target.value)}
                                        className="w-full bg-black border border-gray-600 rounded p-2 text-white text-sm h-16"
                                    />

                                    <Button variant="cta" onClick={handleSendGift} className="w-full py-2 text-sm">Send Gift</Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Promo Toggles (Dynamic) */}
                <div className="bg-black/40 p-6 rounded-xl border border-purple-500/30 h-fit">
                    <h3 className="text-2xl font-header text-purple-400 mb-6 border-b border-gray-700 pb-2">Live Content</h3>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                        {sortedRarities.map(rarity => {
                            // Filter out basic base rarities if desired, or keep all. Let's keep all for control.
                            const isActive = settings.activePromos?.includes(rarity.id);
                            return (
                                <div key={rarity.id} className="flex justify-between items-center p-2 hover:bg-white/5 rounded">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: rarity.color }}></div>
                                        <span className="text-white font-bold capitalize text-sm">{rarity.name}</span>
                                    </div>
                                    <button onClick={() => togglePromo(rarity.id)} className={`px-3 py-1 rounded font-bold text-xs transition-colors border ${isActive ? 'bg-green-600 border-green-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-400'}`}>
                                        {isActive ? 'ACTIVE' : 'DISABLED'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ... (Pick Factory, Card Creator, Rarity Forge, Pack Manager code preserved below) ... */}
                {/* --- PICK FACTORY --- */}
                <div className="bg-black/40 p-6 rounded-xl border border-indigo-500/30 md:col-span-2">
                    <h3 className="text-2xl font-header text-indigo-400 mb-6 border-b border-gray-700 pb-2">Player Pick Factory</h3>
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className={`flex-1 space-y-4 ${editingPickId ? 'p-2 border border-indigo-500/50 rounded bg-indigo-900/10' : ''}`}>
                            {editingPickId && <p className="text-indigo-400 text-sm font-bold uppercase tracking-wider mb-2">EDITING PICK: {editingPickId}</p>}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">ID</label>
                                    <input type="text" value={newPick.id} onChange={e => setNewPick({...newPick, id: e.target.value.replace(/[^a-z0-9_-]/g, '').toLowerCase()})} disabled={!!editingPickId} className="bg-gray-900 border border-gray-600 rounded p-2 text-white disabled:opacity-50" placeholder="super_pick" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">Display Name</label>
                                    <input type="text" value={newPick.name} onChange={e => setNewPick({...newPick, name: e.target.value})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" placeholder="Super Pick" />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">Total Cards Shown</label>
                                    <input type="number" value={newPick.totalOptions} onChange={e => setNewPick({...newPick, totalOptions: parseInt(e.target.value) || 2})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" min="1" max="10" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">Picks Allowed</label>
                                    <input type="number" value={newPick.pickCount} onChange={e => setNewPick({...newPick, pickCount: parseInt(e.target.value) || 1})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" min="1" />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">Min OVR</label>
                                    <input type="number" value={newPick.minOvr} onChange={e => setNewPick({...newPick, minOvr: parseInt(e.target.value) || 75})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">Value (Coins)</label>
                                    <input type="number" value={newPick.cost} onChange={e => setNewPick({...newPick, cost: parseInt(e.target.value) || 0})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">Guarantee</label>
                                    <select value={newPick.rarityGuarantee || ''} onChange={e => setNewPick({...newPick, rarityGuarantee: e.target.value ? e.target.value : undefined})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white capitalize">
                                        <option value="">None</option>
                                        {sortedRarities.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <Button variant={editingPickId ? 'ok' : 'cta'} onClick={handleCreatePick} className="w-full mt-2">{editingPickId ? 'Update Pick' : 'Create Pick'}</Button>
                            {pickMessage && <p className={`text-sm mt-2 ${pickMessage.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>{pickMessage}</p>}
                        </div>

                        {/* Pick List */}
                        <div className="w-full md:w-64 bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex flex-col h-full max-h-[350px]">
                            <h4 className="text-white font-bold text-sm mb-2">Manage Picks</h4>
                            <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2">
                                {Object.entries({ ...defaultPicks, ...customPicks } as Record<string, PlayerPickConfig>).map(([id, config]) => {
                                    const isActive = config.active !== false;
                                    return (
                                        <div key={id} className={`bg-black/40 p-2 rounded flex justify-between items-center text-xs ${!isActive ? 'opacity-60 border border-red-900' : ''}`}>
                                            <div className="flex flex-col">
                                                <span className="text-gray-200 font-bold">{config.name || t(config.nameKey as TranslationKey) || id}</span>
                                                <span className="text-gray-500 text-[10px]">{config.pickCount} of {config.totalOptions} | {config.minOvr}+</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => handleEditPick(id, config)} className="px-2 py-1 bg-blue-900 text-blue-200 rounded border border-blue-500">Edit</button>
                                                <button onClick={() => handleTogglePickStatus(id, isActive)} className={`px-2 py-1 rounded border ${isActive ? 'bg-green-900 text-green-200 border-green-500' : 'bg-red-900 text-red-200 border-red-500'}`}>
                                                    {isActive ? 'ON' : 'OFF'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- CARD CREATOR / EDITOR --- */}
                <div className="bg-black/40 p-6 rounded-xl border border-green-500/30 md:col-span-2" ref={cardFormRef}>
                    <div className="flex justify-between items-center border-b border-gray-700 pb-2 mb-6">
                        <h3 className="text-2xl font-header text-green-400">Card Manager</h3>
                        {editingCardId && (
                            <Button variant="sell" onClick={cancelCardEdit} className="px-3 py-1 text-xs">Cancel Edit</Button>
                        )}
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Form Side */}
                        <div className={`flex-1 space-y-4 ${editingCardId ? 'p-2 border border-yellow-500/50 rounded bg-yellow-900/10' : ''}`}>
                            {editingCardId && <p className="text-yellow-400 text-sm font-bold uppercase tracking-wider mb-2">EDITING CARD: {editingCardId}</p>}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">Name</label>
                                    <input type="text" value={newCard.name} onChange={e => setNewCard({...newCard, name: e.target.value})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" placeholder="Rapper Name" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">Rarity</label>
                                    <select value={newCard.rarity} onChange={e => setNewCard({...newCard, rarity: e.target.value as Rarity})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white capitalize">
                                        {sortedRarities.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            {/* ... Stats & Inputs ... */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">OVR</label>
                                    <input type="number" value={newCard.ovr} onChange={e => setNewCard({...newCard, ovr: parseInt(e.target.value) || 50})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">Value</label>
                                    <input type="number" value={newCard.value} onChange={e => setNewCard({...newCard, value: parseInt(e.target.value) || 0})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400">Image URL</label>
                                <input type="text" value={newCard.image} onChange={e => setNewCard({...newCard, image: e.target.value})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" placeholder="https://..." />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Stats</label>
                                <div className="grid grid-cols-6 gap-2">
                                    {Object.keys(newCard.stats).map((key) => (
                                        <div key={key} className="flex flex-col text-center">
                                            <span className="text-[10px] text-gray-500 uppercase">{key.substring(0,3)}</span>
                                            <input type="number" value={newCard.stats[key as keyof Stats]} onChange={e => handleStatChange(key as keyof Stats, e.target.value)} className="bg-gray-900 border border-gray-600 rounded p-1 text-white text-center text-xs" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <Button variant="default" onClick={autoCalcValue} className="flex-1 py-2 text-xs">Auto Calc Value</Button>
                                <Button variant={editingCardId ? 'ok' : 'keep'} onClick={handleCreateCard} className="flex-1 py-2 text-sm shadow-gold-glow">
                                    {editingCardId ? 'Update Card' : 'Create Card'}
                                </Button>
                            </div>
                            {createMessage && <p className={`text-sm mt-2 ${createMessage.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>{createMessage}</p>}
                        </div>
                        {/* Preview */}
                        <div className="flex flex-col items-center justify-center p-4 bg-gray-900/50 rounded-lg border border-gray-700 flex-shrink-0 w-full md:w-64">
                            <p className="text-gray-400 text-xs mb-4 uppercase tracking-widest">Preview</p>
                            <div className="transform scale-110">
                                <CardComponent key={newCard.name + newCard.rarity} card={{...newCard, id: 'preview'}} />
                            </div>
                        </div>
                    </div>

                    {/* Card List with Edit/Disable */}
                    <div className="mt-8 border-t border-gray-700 pt-6">
                        <div className="mb-4 flex justify-between items-center">
                            <h4 className="text-xl text-white font-header">Existing Cards</h4>
                            <input type="text" value={cardSearch} onChange={e => setCardSearch(e.target.value)} placeholder="Search..." className="bg-black border border-gray-600 rounded px-3 py-1 text-white text-sm" />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {filteredCards.map(card => {
                                const isDisabled = settings.disabledCardIds?.includes(card.id);
                                return (
                                    <div key={card.id} className="flex items-center gap-4 bg-gray-900/50 p-2 rounded-lg border border-gray-700 hover:border-green-500/50 transition-colors">
                                        <div className="scale-75 origin-left"><CardComponent card={card} className="!w-[60px] !h-[90px]" /></div>
                                        <div className="flex-grow">
                                            <p className="text-white font-bold">{card.name}</p>
                                            <p className="text-xs text-gray-400 capitalize">{card.rarity} | OVR {card.ovr}</p>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button onClick={() => loadCardForEdit(card)} className="px-3 py-1 rounded text-xs font-bold border bg-blue-900/50 border-blue-500 text-blue-200 hover:bg-blue-800">EDIT</button>
                                            <button onClick={() => toggleCardStatus(card.id)} className={`px-3 py-1 rounded text-xs font-bold border ${isDisabled ? 'bg-red-900/50 border-red-500 text-red-200' : 'bg-green-900/50 border-green-500 text-green-200'}`}>{isDisabled ? 'DISABLED' : 'ENABLED'}</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* --- RARITY FORGE --- */}
                <div className="bg-black/40 p-6 rounded-xl border border-blue-500/30 md:col-span-2">
                    <h3 className="text-2xl font-header text-blue-400 mb-6 border-b border-gray-700 pb-2">Rarity Forge</h3>
                    
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400">ID</label>
                                <input type="text" value={newRarity.id} onChange={e => setNewRarity({...newRarity, id: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" placeholder="platinum" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400">Name</label>
                                <input type="text" value={newRarity.name} onChange={e => setNewRarity({...newRarity, name: e.target.value})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" placeholder="Platinum" />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400">Rank</label>
                                <input type="number" value={newRarity.rank} onChange={e => setNewRarity({...newRarity, rank: parseInt(e.target.value) || 1})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400">Color</label>
                                <div className="flex gap-2">
                                    <input type="color" value={newRarity.color} onChange={e => setNewRarity({...newRarity, color: e.target.value})} className="h-10 w-10 p-0 border-0 rounded cursor-pointer" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400">Anim Tier</label>
                                <select value={newRarity.animationTier} onChange={e => setNewRarity({...newRarity, animationTier: parseInt(e.target.value)})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white">
                                    <option value={1}>1 - Basic</option><option value={2}>2 - Rare</option><option value={3}>3 - Epic</option><option value={4}>4 - Legendary</option><option value={5}>5 - ULTIMATE</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-400">Base Image URL</label>
                            <input type="text" value={newRarity.baseImage} onChange={e => setNewRarity({...newRarity, baseImage: e.target.value})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" placeholder="https://..." />
                        </div>
                        
                        <Button variant="cta" onClick={handleCreateRarity} className="mt-2">Save / Update Rarity</Button>
                        {rarityMessage && <p className={`text-sm mt-2 ${rarityMessage.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>{rarityMessage}</p>}
                    
                        {/* Rarity List */}
                        <div className="mt-6 border-t border-gray-700 pt-4">
                            <h4 className="text-lg text-white font-header mb-2">Manage Existing Rarities</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                {sortedRarities.map(r => (
                                    <div key={r.id} className="flex items-center justify-between bg-gray-900/50 p-2 rounded border border-gray-700">
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full" style={{backgroundColor: r.color}}></div>
                                            <div>
                                                <span className="text-white text-sm font-bold">{r.name}</span>
                                                <span className="text-gray-500 text-xs block">Rank: {r.rank} | Tier: {r.animationTier}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => handleEditRarity(r)} className="px-2 py-1 bg-blue-900/50 text-blue-200 text-xs rounded border border-blue-500">Edit</button>
                                            <button onClick={() => handleDeleteRarity(r.id)} className="px-2 py-1 bg-red-900/50 text-red-200 text-xs rounded border border-red-500">Del</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- PACK MANAGER --- */}
                <div className="bg-black/40 p-6 rounded-xl border border-yellow-500/30 md:col-span-2">
                    <h3 className="text-2xl font-header text-yellow-400 mb-6 border-b border-gray-700 pb-2">Pack Manager</h3>
                    
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className={`flex-1 space-y-4 ${editingPackId ? 'p-2 border border-yellow-500/50 rounded bg-yellow-900/10' : ''}`}>
                            {editingPackId && <p className="text-yellow-400 text-sm font-bold uppercase tracking-wider mb-2">EDITING PACK: {editingPackId}</p>}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">ID</label>
                                    <input type="text" value={newPack.id} onChange={e => setNewPack({...newPack, id: e.target.value.replace(/[^a-z0-9_-]/g, '').toLowerCase()})} disabled={!!editingPackId} className="bg-gray-900 border border-gray-600 rounded p-2 text-white disabled:opacity-50" placeholder="ultra_pack" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">Name</label>
                                    <input type="text" value={newPack.name} onChange={e => setNewPack({...newPack, name: e.target.value})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" placeholder="Ultra Pack" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">Cost (Coins)</label>
                                    <input type="number" value={newPack.cost} onChange={e => setNewPack({...newPack, cost: parseInt(e.target.value) || 0})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400">Cost (BP)</label>
                                    <input type="number" value={newPack.bpCost} onChange={e => setNewPack({...newPack, bpCost: parseInt(e.target.value) || 0})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white" />
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-gray-400">Image URL</label>
                                <input type="text" value={newPack.image} onChange={e => setNewPack({...newPack, image: e.target.value})} className="bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm" placeholder="https://..." />
                            </div>
                            
                            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                <label className="text-xs text-gray-400 mb-2 block">Probabilities (%)</label>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                    {sortedRarities.map(r => (
                                        <div key={r.id} className="flex items-center justify-between">
                                            <span className="text-xs text-gray-300 capitalize">{r.name}</span>
                                            <input type="number" step="0.1" value={newPack.rarityChances[r.id] || ''} onChange={e => handlePackRarityChange(r.id, e.target.value)} className="w-16 bg-black border border-gray-600 rounded p-1 text-white text-right text-xs" placeholder="0" />
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-2 text-right">
                                    <span className={`text-sm font-bold ${Math.abs((Object.values(newPack.rarityChances) as number[]).reduce((a, b) => a + b, 0) - 100) < 0.1 ? 'text-green-400' : 'text-red-400'}`}>Total: {(Object.values(newPack.rarityChances) as number[]).reduce((a, b) => a + b, 0).toFixed(1)}%</span>
                                </div>
                            </div>
                            <Button variant={editingPackId ? 'ok' : 'cta'} onClick={handleCreatePack} className="w-full">{editingPackId ? 'Update Pack' : 'Save Pack'}</Button>
                            {packMessage && <p className={`text-sm mt-2 ${packMessage.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>{packMessage}</p>}
                        </div>

                        {/* Pack List */}
                        <div className="w-full md:w-64 flex flex-col gap-4">
                            <div className="flex flex-col items-center justify-center p-6 bg-gray-900/50 rounded-lg border border-gray-700">
                                <p className="text-gray-400 text-xs mb-4 uppercase tracking-widest">Preview</p>
                                <div className="flex flex-col items-center">
                                    <div className="w-32 h-40 bg-gray-800 rounded-lg mb-2 overflow-hidden flex items-center justify-center border border-gray-600">
                                        {newPack.image ? <img src={newPack.image} className="w-full h-full object-cover" /> : <span className="text-gray-500 text-xs">No Image</span>}
                                    </div>
                                    <span className="text-gold-light font-header text-xl">{newPack.name || 'Pack Name'}</span>
                                    <span className="text-white text-sm">{newPack.cost} Coins</span>
                                </div>
                            </div>
                            
                            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex-1 overflow-hidden flex flex-col">
                                <h4 className="text-white font-bold text-sm mb-2">Manage Existing Packs</h4>
                                <div className="overflow-y-auto custom-scrollbar flex-1 space-y-2">
                                    {Object.entries({ ...defaultPacks, ...customPacks }).map(([pid, pdata]) => {
                                        const pack = pdata as PackData;
                                        const isActive = pack.active !== false;
                                        return (
                                        <div key={pid} className={`bg-black/40 p-2 rounded flex justify-between items-center text-xs ${!isActive ? 'opacity-60 border border-red-900' : ''}`}>
                                            <span className="text-gray-300 truncate max-w-[80px]" title={pack.name}>{pack.name || pid}</span>
                                            <div className="flex gap-1">
                                                <button onClick={() => handleEditPack(pid, pack)} className="px-2 py-1 bg-blue-900 text-blue-200 rounded border border-blue-500">Edit</button>
                                                <button onClick={() => handleTogglePackStatus(pid, isActive)} className={`px-2 py-1 rounded border ${isActive ? 'bg-green-900 text-green-200 border-green-500' : 'bg-red-900 text-red-200 border-red-500'}`}>
                                                    {isActive ? 'ON' : 'OFF'}
                                                </button>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ControlRoom;
