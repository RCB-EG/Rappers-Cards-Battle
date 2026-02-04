
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import Button from '../Button';
import { GlobalSettings, Card, Rarity, Stats, RarityDefinition, PackData, Objective, FBCChallenge, Evolution, TaskActionType } from '../../types';
import { TranslationKey } from '../../utils/translations';
import { PROMO_RARITIES, SUPERPOWER_DESC, packs as defaultPacks, fbcData as defaultFBCs, evoData as defaultEvos } from '../../data/gameData';
import { useRarity } from '../../contexts/RarityContext';

interface ControlRoomProps {
    globalSettings: GlobalSettings;
    onClose: () => void;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
    allCards: Card[];
}

const ControlRoom: React.FC<ControlRoomProps> = ({ globalSettings, onClose, t, allCards }) => {
    const [settings, setSettings] = useState<GlobalSettings>(globalSettings);
    const { sortedRarities } = useRarity();
    const [activeTab, setActiveTab] = useState<'main' | 'content' | 'database'>('main');
    const [dbTab, setDbTab] = useState<'cards' | 'packs' | 'rarities'>('cards');
    
    // --- CONTENT MANAGER STATE ---
    const [contentTab, setContentTab] = useState<'obj' | 'fbc' | 'evo'>('obj');
    
    // Objectives
    const [dynamicObjectives, setDynamicObjectives] = useState<Objective[]>([]);
    const defaultObj: Partial<Objective> = {
        id: '', titleKey: 'New Objective', type: 'daily', tasks: [{id: 't1', descriptionKey: 'Task Desc', target: 1, actionType: 'PLAY_BATTLE'}], reward: { type: 'coins', amount: 1000 }
    };
    const [newObjective, setNewObjective] = useState<Partial<Objective>>(defaultObj);

    // FBCs
    const [dbFBCs, setDbFBCs] = useState<FBCChallenge[]>([]);
    const defaultFBC: Partial<FBCChallenge> = {
        id: '', title: 'New Challenge', description: '', requirements: { cardCount: 11 }, reward: { type: 'pack', details: 'gold' }
    };
    const [newFBC, setNewFBC] = useState<Partial<FBCChallenge>>(defaultFBC);
    const [fbcRarityReq, setFbcRarityReq] = useState({ rarity: 'gold', count: 1 });

    // Evos
    const [dbEvos, setDbEvos] = useState<Evolution[]>([]);
    const defaultEvo: Partial<Evolution> = {
        id: '', title: 'New Evolution', description: '', eligibility: { rarity: 'gold' }, tasks: [], resultCardId: ''
    };
    const [newEvo, setNewEvo] = useState<Partial<Evolution>>(defaultEvo);
    const [newTask, setNewTask] = useState({ description: '', target: 1, actionType: 'PLAY_BATTLE' as TaskActionType });

    // --- DATABASE MANAGER STATE ---
    // Cards
    const defaultCardState: Partial<Card> = { name: '', rarity: 'gold', ovr: 80, image: '', value: 10000, superpowers: [], stats: { lyrc: 80, flow: 80, sing: 80, live: 80, diss: 80, char: 80 } };
    const [newCard, setNewCard] = useState<Partial<Card>>(defaultCardState);
    const [cardSearch, setCardSearch] = useState('');
    const [filteredCards, setFilteredCards] = useState<Card[]>([]);
    const [selectedSuperpower, setSelectedSuperpower] = useState<string>('');

    // Packs
    const [dbPacks, setDbPacks] = useState<Record<string, PackData>>({});
    const defaultPackState: Partial<PackData> = { 
        id: 'new_pack', name: 'New Pack', cost: 1000, bpCost: 0, rarityChances: { gold: 100 }, image: '', active: true, minOvr: 0, maxOvr: 99 
    };
    const [newPack, setNewPack] = useState<Partial<PackData>>(defaultPackState);

    // Rarities
    const [dbRarities, setDbRarities] = useState<RarityDefinition[]>([]);
    const defaultRarityState: Partial<RarityDefinition> = { id: 'ruby', name: 'Ruby', color: '#ff0000', rank: 10, animationTier: 1, baseImage: '', active: true };
    const [newRarity, setNewRarity] = useState<Partial<RarityDefinition>>(defaultRarityState);

    // Initial Fetch
    useEffect(() => {
        const unsubObj = onSnapshot(doc(db, 'settings', 'objectives'), (s) => s.exists() && setDynamicObjectives(s.data().list || []));
        const unsubFbc = onSnapshot(doc(db, 'settings', 'fbc'), (s) => s.exists() && setDbFBCs(s.data().list || []));
        const unsubEvo = onSnapshot(doc(db, 'settings', 'evolutions'), (s) => s.exists() && setDbEvos(s.data().list || []));
        
        const unsubPacks = onSnapshot(doc(db, 'settings', 'packs'), (s) => s.exists() && setDbPacks(s.data() as any));
        const unsubRarities = onSnapshot(doc(db, 'settings', 'rarities'), (s) => s.exists() && setDbRarities(s.data().list || []));
        
        return () => { unsubObj(); unsubFbc(); unsubEvo(); unsubPacks(); unsubRarities(); };
    }, []);

    // Merge Data
    const displayPacks = useMemo(() => ({ ...defaultPacks, ...dbPacks }), [dbPacks]);
    
    const displayFBCs = useMemo(() => {
        const map = new Map<string, FBCChallenge>();
        defaultFBCs.forEach(f => map.set(f.id, f));
        dbFBCs.forEach(f => map.set(f.id, f));
        return Array.from(map.values());
    }, [dbFBCs]);

    const displayEvos = useMemo(() => {
        const map = new Map<string, Evolution>();
        defaultEvos.forEach(e => map.set(e.id, e));
        dbEvos.forEach(e => map.set(e.id, e));
        return Array.from(map.values());
    }, [dbEvos]);

    const uniqueCardNames = useMemo(() => {
        return Array.from(new Set(allCards.map(c => c.name))).sort();
    }, [allCards]);

    // Filter cards
    useEffect(() => {
        if (!cardSearch.trim()) { setFilteredCards(allCards.slice(0, 10)); return; } 
        const lowerSearch = cardSearch.toLowerCase();
        setFilteredCards(allCards.filter(c => c.name.toLowerCase().includes(lowerSearch) || c.id.toLowerCase().includes(lowerSearch)));
    }, [cardSearch, allCards]);

    // --- GENERIC SAVE HELPERS ---
    const saveList = async (type: 'objectives' | 'fbc' | 'evolutions', list: any[]) => {
        try {
            await setDoc(doc(db, 'settings', type), { list }, { merge: true });
            alert(`${type.toUpperCase()} Saved!`);
        } catch (e) { console.error(e); alert("Error saving"); }
    };

    // --- DISCARD HELPERS ---
    const discardCard = () => setNewCard(defaultCardState);
    const discardPack = () => setNewPack(defaultPackState);
    const discardRarity = () => setNewRarity(defaultRarityState);
    const discardObj = () => setNewObjective(defaultObj);
    const discardFBC = () => setNewFBC(defaultFBC);
    const discardEvo = () => setNewEvo(defaultEvo);

    // --- OBJECTIVE LOGIC ---
    const handleAddObjective = () => {
        if (!newObjective.id) return alert("ID required");
        const updatedList = [...dynamicObjectives.filter(o => o.id !== newObjective.id), newObjective as Objective];
        saveList('objectives', updatedList);
    };

    // --- FBC LOGIC ---
    const handleSaveFBC = () => {
        if (!newFBC.id) return alert("ID required");
        const existingIndex = dbFBCs.findIndex(f => f.id === newFBC.id);
        const newList = [...dbFBCs];
        if (existingIndex > -1) newList[existingIndex] = newFBC as FBCChallenge;
        else newList.push(newFBC as FBCChallenge);
        saveList('fbc', newList);
    };

    const addFbcRarityReq = () => {
        const currentReqs = newFBC.requirements?.exactRarityCount || {};
        setNewFBC({
            ...newFBC,
            requirements: {
                ...newFBC.requirements!,
                exactRarityCount: { ...currentReqs, [fbcRarityReq.rarity]: fbcRarityReq.count }
            }
        });
    };

    // --- EVO LOGIC ---
    const handleSaveEvo = () => {
        if (!newEvo.id) return alert("ID required");
        const existingIndex = dbEvos.findIndex(e => e.id === newEvo.id);
        const newList = [...dbEvos];
        if (existingIndex > -1) newList[existingIndex] = newEvo as Evolution;
        else newList.push(newEvo as Evolution);
        saveList('evolutions', newList);
    };

    const addEvoTask = () => {
        const tasks = newEvo.tasks || [];
        const taskWithId = { ...newTask, id: `task_${Date.now()}` };
        setNewEvo({ ...newEvo, tasks: [...tasks, taskWithId] });
    };

    // --- PACK/CARD/RARITY LOGIC ---
    const handleSaveCard = async () => {
        if (!newCard.id || !newCard.name) return alert("ID and Name required");
        try { await setDoc(doc(db, 'game_cards', newCard.id), newCard, { merge: true }); alert("Card Saved!"); } catch(e) { alert(e); }
    };
    
    // Toggle Card "Enabled/Disabled" state via Global Settings
    const isCardDisabled = (id: string) => (settings.disabledCardIds || []).includes(id);
    
    const toggleCardDisabled = async () => {
        if (!newCard.id) return;
        const currentDisabled = settings.disabledCardIds || [];
        let newDisabled: string[];
        
        if (currentDisabled.includes(newCard.id)) {
            newDisabled = currentDisabled.filter(id => id !== newCard.id);
        } else {
            newDisabled = [...currentDisabled, newCard.id];
        }
        
        setSettings(prev => ({ ...prev, disabledCardIds: newDisabled }));
        try {
            await setDoc(doc(db, 'settings', 'global'), { disabledCardIds: newDisabled }, { merge: true });
        } catch(e) { console.error("Error saving disabled state", e); }
    };

    const handleAddSuperpower = () => { if (!selectedSuperpower) return; const current = newCard.superpowers || []; if (!current.includes(selectedSuperpower)) setNewCard({ ...newCard, superpowers: [...current, selectedSuperpower] }); };
    const handleRemoveSuperpower = (sp: string) => setNewCard({ ...newCard, superpowers: (newCard.superpowers || []).filter(s => s !== sp) });
    
    const handleSavePack = async () => { 
        if (!newPack.id) return alert("ID required"); 
        try { 
            await setDoc(doc(db, 'settings', 'packs'), { [newPack.id]: { 
                ...newPack, 
                cost: Number(newPack.cost), 
                bpCost: Number(newPack.bpCost),
                minOvr: Number(newPack.minOvr || 0),
                maxOvr: Number(newPack.maxOvr || 99)
            } }, { merge: true }); 
            alert("Pack Saved!"); 
        } catch(e) { alert("Error"); } 
    };
    
    const handleChanceChange = (rid: string, val: string) => { const n = parseFloat(val); const c = { ...(newPack.rarityChances || {}) }; if (isNaN(n) || n <= 0) delete c[rid]; else c[rid] = n; setNewPack({ ...newPack, rarityChances: c }); };
    
    const handleSaveRarity = async () => { if (!newRarity.id) return alert("ID required"); const idx = dbRarities.findIndex(r => r.id === newRarity.id); let list = [...dbRarities]; const safe = { ...newRarity, rank: Number(newRarity.rank), animationTier: Number(newRarity.animationTier), active: newRarity.active !== false } as RarityDefinition; if (idx > -1) list[idx] = safe; else list.push(safe); try { await setDoc(doc(db, 'settings', 'rarities'), { list }, { merge: true }); alert("Rarity Saved!"); } catch(e) { alert("Error"); } };
    
    const toggleSetting = async (key: keyof GlobalSettings) => { const nv = !settings[key]; setSettings(p => ({ ...p, [key]: nv })); try { await setDoc(doc(db, 'settings', 'global'), { [key]: nv }, { merge: true }); } catch (e) {} };

    return (
        <div className="animate-fadeIn w-full max-w-6xl mx-auto pb-12">
            <div className="flex justify-between items-center mb-8 bg-gray-900 p-4 rounded-lg border border-red-900/50">
                <h2 className="font-header text-4xl text-red-500">CONTROL ROOM</h2>
                <div className="flex gap-2">
                    <Button variant={activeTab === 'main' ? 'cta' : 'default'} onClick={() => setActiveTab('main')} className="px-4 py-2 text-xs">Settings</Button>
                    <Button variant={activeTab === 'database' ? 'cta' : 'default'} onClick={() => setActiveTab('database')} className="px-4 py-2 text-xs">Database</Button>
                    <Button variant={activeTab === 'content' ? 'cta' : 'default'} onClick={() => setActiveTab('content')} className="px-4 py-2 text-xs">Content</Button>
                    <Button variant="default" onClick={onClose} className="px-4 py-2 text-xs">{t('close')}</Button>
                </div>
            </div>

            {/* --- MAIN SETTINGS --- */}
            {activeTab === 'main' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-black/40 p-6 rounded-xl border border-gray-700 h-fit">
                        <h3 className="text-2xl font-header text-gold-light mb-6 border-b border-gray-700 pb-2">Switches</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-white font-bold">Maintenance Mode</span>
                                <button onClick={() => toggleSetting('maintenanceMode')} className={`w-12 h-6 rounded-full relative ${settings.maintenanceMode ? 'bg-red-600' : 'bg-gray-600'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${settings.maintenanceMode ? 'left-7' : 'left-1'}`}></div>
                                </button>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-white font-bold">Market Enabled</span>
                                <button onClick={() => toggleSetting('marketEnabled')} className={`w-12 h-6 rounded-full relative ${settings.marketEnabled ? 'bg-green-600' : 'bg-gray-600'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${settings.marketEnabled ? 'left-7' : 'left-1'}`}></div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DATABASE MANAGER --- */}
            {activeTab === 'database' && (
                <div className="bg-black/40 p-6 rounded-xl border border-blue-500/30">
                    <div className="flex gap-4 border-b border-gray-700 pb-4 mb-4">
                        <button onClick={() => setDbTab('cards')} className={`text-xl font-header ${dbTab === 'cards' ? 'text-blue-400 underline' : 'text-gray-500'}`}>Cards</button>
                        <button onClick={() => setDbTab('packs')} className={`text-xl font-header ${dbTab === 'packs' ? 'text-blue-400 underline' : 'text-gray-500'}`}>Packs</button>
                        <button onClick={() => setDbTab('rarities')} className={`text-xl font-header ${dbTab === 'rarities' ? 'text-blue-400 underline' : 'text-gray-500'}`}>Rarities</button>
                    </div>

                    {dbTab === 'cards' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3 bg-gray-900/50 p-4 rounded-lg h-fit">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-white font-bold">Add/Edit Card</h4>
                                    <Button variant="default" onClick={discardCard} className="!py-1 !px-2 text-xs bg-red-900 border-red-700">Discard Changes</Button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" placeholder="ID" className="bg-black border border-gray-600 rounded p-2 text-white text-xs" value={newCard.id || ''} onChange={e => setNewCard({...newCard, id: e.target.value})} />
                                    <input type="text" placeholder="Name" className="bg-black border border-gray-600 rounded p-2 text-white text-xs" value={newCard.name || ''} onChange={e => setNewCard({...newCard, name: e.target.value})} />
                                    <input type="number" placeholder="OVR" className="bg-black border border-gray-600 rounded p-2 text-white text-xs" value={newCard.ovr || ''} onChange={e => setNewCard({...newCard, ovr: parseInt(e.target.value)})} />
                                    <select className="bg-black border border-gray-600 rounded p-2 text-white text-xs capitalize" value={newCard.rarity} onChange={e => setNewCard({...newCard, rarity: e.target.value})}>
                                        {sortedRarities.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                                <input type="text" placeholder="Image URL" className="w-full bg-black border border-gray-600 rounded p-2 text-white text-xs" value={newCard.image || ''} onChange={e => setNewCard({...newCard, image: e.target.value})} />
                                
                                {newCard.id && (
                                    <div className="flex items-center gap-2 bg-black/50 p-2 rounded border border-gray-600">
                                        <label className="text-white text-xs font-bold">Packable (Active)</label>
                                        <button onClick={toggleCardDisabled} className={`w-10 h-5 rounded-full relative transition-colors ${!isCardDisabled(newCard.id) ? 'bg-green-600' : 'bg-red-600'}`}>
                                            <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${!isCardDisabled(newCard.id) ? 'left-6' : 'left-1'}`}></div>
                                        </button>
                                        <span className="text-gray-400 text-xs ml-2">{isCardDisabled(newCard.id) ? "Excluded from packs" : "Included in packs"}</span>
                                    </div>
                                )}

                                <div className="bg-black/30 p-2 rounded border border-gray-700">
                                    <p className="text-xs text-gray-400 mb-1">Superpowers</p>
                                    <div className="flex gap-2 mb-2">
                                        <select className="bg-black border border-gray-600 rounded p-1 text-xs text-white flex-grow" value={selectedSuperpower} onChange={e => setSelectedSuperpower(e.target.value)}>
                                            <option value="">Select...</option>
                                            {Object.keys(SUPERPOWER_DESC).map(sp => <option key={sp} value={sp}>{sp}</option>)}
                                        </select>
                                        <Button variant="keep" onClick={handleAddSuperpower} className="!py-1 !px-3 text-xs">Add</Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {newCard.superpowers?.map(sp => (
                                            <span key={sp} className="bg-blue-900/50 border border-blue-500 text-blue-200 text-xs px-2 py-1 rounded flex items-center gap-1">
                                                {sp} <button onClick={() => handleRemoveSuperpower(sp)} className="text-red-400 ml-1">×</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    {['lyrc', 'flow', 'sing', 'live', 'diss', 'char'].map(stat => (
                                        <input key={stat} type="number" placeholder={stat.toUpperCase()} className="bg-black border border-gray-600 rounded p-1 text-white text-xs text-center" 
                                            value={newCard.stats?.[stat as keyof Stats] || ''} 
                                            onChange={e => setNewCard({...newCard, stats: {...newCard.stats!, [stat]: parseInt(e.target.value)}})} 
                                        />
                                    ))}
                                </div>
                                <Button variant="cta" onClick={handleSaveCard} className="w-full">Save Card</Button>
                            </div>
                            
                            <div>
                                <input type="text" value={cardSearch} onChange={e => setCardSearch(e.target.value)} placeholder="Search..." className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white mb-2" />
                                <div className="max-h-[500px] overflow-y-auto space-y-1">
                                    {filteredCards.map(c => (
                                        <div key={c.id} onClick={() => setNewCard(c)} className="flex items-center gap-2 bg-gray-800 p-2 rounded cursor-pointer hover:bg-gray-700">
                                            <img src={c.image} className="w-8 h-8 rounded object-cover" />
                                            <span className={`text-xs ${isCardDisabled(c.id) ? 'text-red-400 line-through' : 'text-white'}`}>{c.name} ({c.ovr})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {dbTab === 'packs' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3 bg-gray-900/50 p-4 rounded-lg h-fit">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-white font-bold">Edit Pack</h4>
                                    <Button variant="default" onClick={discardPack} className="!py-1 !px-2 text-xs bg-red-900 border-red-700">Discard</Button>
                                </div>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="ID" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newPack.id || ''} onChange={e => setNewPack({...newPack, id: e.target.value})} />
                                    <div className="flex items-center bg-black px-2 rounded border border-gray-600">
                                        <label className="text-xs text-gray-400 mr-2">Active</label>
                                        <input type="checkbox" checked={newPack.active !== false} onChange={e => setNewPack({...newPack, active: e.target.checked})} />
                                    </div>
                                </div>
                                <input type="text" placeholder="Name" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newPack.name || ''} onChange={e => setNewPack({...newPack, name: e.target.value})} />
                                <input type="text" placeholder="Image URL" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newPack.image || ''} onChange={e => setNewPack({...newPack, image: e.target.value})} />
                                
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex flex-col">
                                        <label className="text-[10px] text-gray-400">Coins Cost</label>
                                        <input type="number" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newPack.cost} onChange={e => setNewPack({...newPack, cost: parseInt(e.target.value)})} />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-[10px] text-gray-400">BP Cost</label>
                                        <input type="number" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newPack.bpCost} onChange={e => setNewPack({...newPack, bpCost: parseInt(e.target.value)})} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 bg-black/20 p-2 rounded">
                                    <div className="flex flex-col">
                                        <label className="text-[10px] text-gray-400">Min OVR</label>
                                        <input type="number" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newPack.minOvr} onChange={e => setNewPack({...newPack, minOvr: parseInt(e.target.value)})} placeholder="0" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-[10px] text-gray-400">Max OVR</label>
                                        <input type="number" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newPack.maxOvr} onChange={e => setNewPack({...newPack, maxOvr: parseInt(e.target.value)})} placeholder="99" />
                                    </div>
                                </div>

                                <div className="bg-black/30 p-2 rounded border border-gray-700">
                                    <p className="text-xs text-gray-400 mb-2">Rarity Chances (%)</p>
                                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                                        {sortedRarities.map(r => (
                                            <div key={r.id} className="flex items-center gap-2 bg-black/50 p-1 rounded">
                                                <span className="text-xs text-white capitalize w-16">{r.name}</span>
                                                <input type="number" placeholder="%" className="w-full bg-gray-900 border border-gray-600 rounded p-1 text-white text-xs text-right" value={newPack.rarityChances?.[r.id] || ''} onChange={(e) => handleChanceChange(r.id, e.target.value)} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <Button variant="cta" onClick={handleSavePack} className="w-full">Save Pack</Button>
                            </div>
                            <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                {Object.entries(displayPacks).map(([id, rawP]) => {
                                    const p = rawP as PackData;
                                    return (
                                        <div key={id} onClick={() => setNewPack({ ...p, id })} className={`p-2 rounded cursor-pointer border flex justify-between items-center ${newPack.id === id ? 'bg-gray-700 border-white' : 'bg-gray-800 border-gray-700'}`}>
                                            <div className="text-white text-sm font-bold">{p.name || id}</div>
                                            <div className={`w-2 h-2 rounded-full ${p.active !== false ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {dbTab === 'rarities' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3 bg-gray-900/50 p-4 rounded-lg h-fit">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-white font-bold">Edit Rarity</h4>
                                    <Button variant="default" onClick={discardRarity} className="!py-1 !px-2 text-xs bg-red-900 border-red-700">Discard</Button>
                                </div>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="ID" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newRarity.id || ''} onChange={e => setNewRarity({...newRarity, id: e.target.value})} />
                                    <div className="flex items-center bg-black px-2 rounded border border-gray-600"><label className="text-xs text-gray-400 mr-2">Active</label><input type="checkbox" checked={newRarity.active !== false} onChange={e => setNewRarity({...newRarity, active: e.target.checked})} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" placeholder="Name" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newRarity.name || ''} onChange={e => setNewRarity({...newRarity, name: e.target.value})} />
                                    <input type="number" placeholder="Rank" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newRarity.rank || ''} onChange={e => setNewRarity({...newRarity, rank: parseInt(e.target.value)})} />
                                </div>
                                <div className="flex gap-2 items-center bg-black/30 p-2 rounded">
                                    <label className="text-gray-400 text-xs">Color:</label>
                                    <input type="color" className="h-8 w-8 bg-transparent border-none cursor-pointer" value={newRarity.color || '#ffffff'} onChange={e => setNewRarity({...newRarity, color: e.target.value})} />
                                </div>
                                <select className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newRarity.animationTier || 1} onChange={e => setNewRarity({...newRarity, animationTier: parseInt(e.target.value)})}>
                                    {[1,2,3,4,5].map(t => <option key={t} value={t}>Tier {t}</option>)}
                                </select>
                                <input type="text" placeholder="Base Image URL" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newRarity.baseImage || ''} onChange={e => setNewRarity({...newRarity, baseImage: e.target.value})} />
                                <Button variant="cta" onClick={handleSaveRarity} className="w-full">Save Rarity</Button>
                            </div>
                            <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                {sortedRarities.map(r => (
                                    <div key={r.id} onClick={() => setNewRarity(r)} className={`p-2 rounded cursor-pointer border flex justify-between items-center ${newRarity.id === r.id ? 'bg-gray-700 border-white' : 'bg-gray-800 border-gray-700'}`}>
                                        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={{ backgroundColor: r.color }}></div><span className="text-white text-sm">{r.name}</span></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* --- CONTENT MANAGER --- */}
            {activeTab === 'content' && (
                <div className="bg-black/40 p-6 rounded-xl border border-purple-500/30">
                    <div className="flex gap-4 border-b border-gray-700 pb-4 mb-4">
                        <button onClick={() => setContentTab('obj')} className={`text-xl font-header ${contentTab === 'obj' ? 'text-purple-400 underline' : 'text-gray-500'}`}>Objectives</button>
                        <button onClick={() => setContentTab('fbc')} className={`text-xl font-header ${contentTab === 'fbc' ? 'text-purple-400 underline' : 'text-gray-500'}`}>FBCs</button>
                        <button onClick={() => setContentTab('evo')} className={`text-xl font-header ${contentTab === 'evo' ? 'text-purple-400 underline' : 'text-gray-500'}`}>Evolutions</button>
                    </div>

                    {contentTab === 'obj' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4 bg-gray-900/50 p-4 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-white font-bold">Add Objective</h4>
                                    <Button variant="default" onClick={discardObj} className="!py-1 !px-2 text-xs bg-red-900 border-red-700">Discard</Button>
                                </div>
                                <input type="text" placeholder="ID" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newObjective.id} onChange={e => setNewObjective({...newObjective, id: e.target.value})} />
                                <input type="text" placeholder="Title" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newObjective.titleKey} onChange={e => setNewObjective({...newObjective, titleKey: e.target.value})} />
                                <select className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newObjective.type} onChange={e => setNewObjective({...newObjective, type: e.target.value as any})}>
                                    <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="milestone">Milestone</option>
                                </select>
                                <div className="border-t border-gray-700 pt-2">
                                    <select className="w-full bg-black border border-purple-900 rounded p-2 text-white mb-2" value={newObjective.tasks?.[0].actionType} onChange={e => setNewObjective({...newObjective, tasks: [{...newObjective.tasks![0], actionType: e.target.value as TaskActionType}]})}>
                                        <option value="PLAY_BATTLE">Play Battle</option><option value="WIN_BATTLE">Win Battle</option><option value="OPEN_PACK">Open Pack</option><option value="LIST_MARKET">List Market</option><option value="LOGIN">Login</option>
                                    </select>
                                    <input type="number" placeholder="Target" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newObjective.tasks?.[0].target} onChange={e => setNewObjective({...newObjective, tasks: [{...newObjective.tasks![0], target: parseInt(e.target.value)}]})} />
                                </div>
                                {/* Simplified Reward Selection */}
                                <div className="border-t border-gray-700 pt-2">
                                    <p className="text-gray-400 text-xs mb-1">Reward</p>
                                    <div className="flex gap-2 mb-2">
                                        <select className="bg-black border border-gray-600 rounded p-1 text-white text-xs w-1/3" value={newObjective.reward?.type} onChange={e => setNewObjective({...newObjective, reward: {...newObjective.reward!, type: e.target.value as any}})}>
                                            <option value="coins">Coins</option>
                                            <option value="pack">Pack</option>
                                            <option value="card">Card</option>
                                        </select>
                                        
                                        {newObjective.reward?.type === 'coins' && (
                                            <input type="number" placeholder="Amount" className="bg-black border border-gray-600 rounded p-1 text-white text-xs flex-grow" 
                                                value={newObjective.reward.amount || ''}
                                                onChange={e => setNewObjective({...newObjective, reward: {...newObjective.reward!, amount: parseInt(e.target.value)}})} 
                                            />
                                        )}
                                        {newObjective.reward?.type === 'pack' && (
                                            <select className="bg-black border border-gray-600 rounded p-1 text-white text-xs flex-grow" 
                                                value={newObjective.reward.packType || ''}
                                                onChange={e => setNewObjective({...newObjective, reward: {...newObjective.reward!, packType: e.target.value}})}
                                            >
                                                <option value="">Select Pack...</option>
                                                {Object.keys(displayPacks).map(p => <option key={p} value={p}>{displayPacks[p].name || p}</option>)}
                                            </select>
                                        )}
                                        {newObjective.reward?.type === 'card' && (
                                            <select className="bg-black border border-gray-600 rounded p-1 text-white text-xs flex-grow" 
                                                value={newObjective.reward.cardId || ''}
                                                onChange={e => setNewObjective({...newObjective, reward: {...newObjective.reward!, cardId: e.target.value}})}
                                            >
                                                <option value="">Select Card...</option>
                                                {allCards.sort((a,b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name} ({c.rarity})</option>)}
                                            </select>
                                        )}
                                    </div>
                                </div>
                                <Button variant="cta" onClick={handleAddObjective} className="w-full">Save Objective</Button>
                            </div>
                            <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                {dynamicObjectives.map(o => (
                                    <div key={o.id} onClick={() => setNewObjective(o)} className="flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-600 cursor-pointer hover:border-gold-light">
                                        <div><p className="text-white font-bold text-sm">{o.titleKey}</p><p className="text-xs text-purple-400">{o.type}</p></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {contentTab === 'fbc' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3 bg-gray-900/50 p-4 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-white font-bold">FBC Editor</h4>
                                    <Button variant="default" onClick={discardFBC} className="!py-1 !px-2 text-xs bg-red-900 border-red-700">Discard</Button>
                                </div>
                                <input type="text" placeholder="ID" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newFBC.id} onChange={e => setNewFBC({...newFBC, id: e.target.value})} />
                                <input type="text" placeholder="Title" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newFBC.title} onChange={e => setNewFBC({...newFBC, title: e.target.value})} />
                                <input type="text" placeholder="Description" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newFBC.description} onChange={e => setNewFBC({...newFBC, description: e.target.value})} />
                                
                                <div className="bg-black/30 p-2 rounded">
                                    <p className="text-xs text-gold-light mb-1">Requirements</p>
                                    <div className="grid grid-cols-3 gap-2 mb-2">
                                        <input type="number" placeholder="Count" className="bg-black border border-gray-600 rounded p-1 text-white text-xs" value={newFBC.requirements?.cardCount} onChange={e => setNewFBC({...newFBC, requirements: {...newFBC.requirements!, cardCount: parseInt(e.target.value)}})} />
                                        <input type="number" placeholder="Min OVR" className="bg-black border border-gray-600 rounded p-1 text-white text-xs" value={newFBC.requirements?.minAvgOvr || ''} onChange={e => setNewFBC({...newFBC, requirements: {...newFBC.requirements!, minAvgOvr: parseInt(e.target.value)}})} />
                                    </div>
                                    
                                    <div className="flex gap-2 mb-2">
                                        <select className="bg-black border border-gray-600 rounded p-1 text-xs text-white capitalize" value={fbcRarityReq.rarity} onChange={e => setFbcRarityReq({...fbcRarityReq, rarity: e.target.value})}>
                                            {sortedRarities.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                        <input type="number" className="w-12 bg-black border border-gray-600 rounded p-1 text-xs text-white" value={fbcRarityReq.count} onChange={e => setFbcRarityReq({...fbcRarityReq, count: parseInt(e.target.value)})} />
                                        <Button variant="keep" onClick={addFbcRarityReq} className="!py-1 !px-2 text-xs">+</Button>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {Object.entries(newFBC.requirements?.exactRarityCount || {}).map(([r, c]) => (
                                            <span key={r} className="text-xs bg-gray-700 px-2 rounded text-white">{c}x {r}</span>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-black/30 p-2 rounded">
                                    <p className="text-xs text-green-400 mb-1">Reward</p>
                                    <div className="flex gap-2">
                                        <select className="bg-black border border-gray-600 rounded p-1 text-xs text-white w-1/3" value={newFBC.reward?.type} onChange={e => setNewFBC({...newFBC, reward: {...newFBC.reward!, type: e.target.value as any}})}>
                                            <option value="pack">Pack</option><option value="card">Card</option><option value="coins">Coins</option>
                                        </select>
                                        
                                        {newFBC.reward?.type === 'coins' && (
                                            <input type="number" placeholder="Amount" className="bg-black border border-gray-600 rounded p-1 text-xs text-white flex-grow" 
                                                value={newFBC.reward.amount || ''}
                                                onChange={e => setNewFBC({...newFBC, reward: {...newFBC.reward!, amount: parseInt(e.target.value)}})} 
                                            />
                                        )}
                                        {newFBC.reward?.type === 'pack' && (
                                            <select className="bg-black border border-gray-600 rounded p-1 text-xs text-white flex-grow" 
                                                value={newFBC.reward.details || ''}
                                                onChange={e => setNewFBC({...newFBC, reward: {...newFBC.reward!, details: e.target.value}})}
                                            >
                                                <option value="">Select Pack...</option>
                                                {Object.keys(displayPacks).map(p => <option key={p} value={p}>{displayPacks[p].name || p}</option>)}
                                            </select>
                                        )}
                                        {newFBC.reward?.type === 'card' && (
                                            <select className="bg-black border border-gray-600 rounded p-1 text-xs text-white flex-grow" 
                                                value={newFBC.reward.cardId || ''}
                                                onChange={e => setNewFBC({...newFBC, reward: {...newFBC.reward!, cardId: e.target.value}})}
                                            >
                                                <option value="">Select Card...</option>
                                                {allCards.sort((a,b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name} ({c.rarity})</option>)}
                                            </select>
                                        )}
                                    </div>
                                </div>
                                <Button variant="cta" onClick={handleSaveFBC} className="w-full">Save Challenge</Button>
                            </div>
                            <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                {displayFBCs.map(f => (
                                    <div key={f.id} onClick={() => setNewFBC(f)} className="p-2 bg-gray-800 rounded border border-gray-600 cursor-pointer hover:border-white">
                                        <p className="text-white text-sm font-bold">{f.title}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {contentTab === 'evo' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3 bg-gray-900/50 p-4 rounded-lg">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-white font-bold">Evo Editor</h4>
                                    <Button variant="default" onClick={discardEvo} className="!py-1 !px-2 text-xs bg-red-900 border-red-700">Discard</Button>
                                </div>
                                <input type="text" placeholder="ID" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newEvo.id} onChange={e => setNewEvo({...newEvo, id: e.target.value})} />
                                <input type="text" placeholder="Title" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={newEvo.title} onChange={e => setNewEvo({...newEvo, title: e.target.value})} />
                                
                                <div className="bg-black/30 p-2 rounded">
                                    <p className="text-xs text-blue-300 mb-1">Result Card</p>
                                    <select className="w-full bg-black border border-gray-600 rounded p-1 text-xs text-white" value={newEvo.resultCardId} onChange={e => setNewEvo({...newEvo, resultCardId: e.target.value})}>
                                        <option value="">Select Result Card...</option>
                                        {allCards.sort((a,b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{c.name} ({c.rarity}) - {c.ovr}</option>)}
                                    </select>
                                </div>
                                
                                <div className="bg-black/30 p-2 rounded">
                                    <p className="text-xs text-blue-300 mb-1">Eligibility</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select className="bg-black border border-gray-600 rounded p-1 text-white text-xs" value={newEvo.eligibility?.cardName || ''} onChange={e => setNewEvo({...newEvo, eligibility: {...newEvo.eligibility!, cardName: e.target.value}})}>
                                            <option value="">Select Name...</option>
                                            {uniqueCardNames.map(name => <option key={name} value={name}>{name}</option>)}
                                        </select>
                                        <select className="bg-black border border-gray-600 rounded p-1 text-xs text-white capitalize" value={newEvo.eligibility?.rarity} onChange={e => setNewEvo({...newEvo, eligibility: {...newEvo.eligibility!, rarity: e.target.value}})}>
                                            {sortedRarities.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-black/30 p-2 rounded">
                                    <p className="text-xs text-purple-300 mb-1">Add Task</p>
                                    <select className="w-full bg-black border border-gray-600 rounded p-1 text-white text-xs mb-1" value={newTask.actionType} onChange={e => setNewTask({...newTask, actionType: e.target.value as TaskActionType})}>
                                        <option value="PLAY_BATTLE">Play Battle</option><option value="WIN_BATTLE">Win Battle</option><option value="OPEN_PACK">Open Pack</option><option value="LIST_MARKET">List Market</option>
                                    </select>
                                    <input type="text" placeholder="Desc" className="w-full bg-black border border-gray-600 rounded p-1 text-white text-xs mb-1" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
                                    <div className="flex gap-2">
                                        <input type="number" placeholder="Target" className="w-20 bg-black border border-gray-600 rounded p-1 text-white text-xs" value={newTask.target} onChange={e => setNewTask({...newTask, target: parseInt(e.target.value)})} />
                                        <Button variant="keep" onClick={addEvoTask} className="!py-1 !px-2 text-xs">Add Task</Button>
                                    </div>
                                    <ul className="mt-2 space-y-1">
                                        {newEvo.tasks?.map((t, i) => (
                                            <li key={i} className="text-xs text-gray-400">{t.description} ({t.target})</li>
                                        ))}
                                    </ul>
                                </div>
                                <Button variant="cta" onClick={handleSaveEvo} className="w-full">Save Evo</Button>
                            </div>
                            <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                {displayEvos.map(e => (
                                    <div key={e.id} onClick={() => setNewEvo(e)} className="p-2 bg-gray-800 rounded border border-gray-600 cursor-pointer hover:border-white">
                                        <p className="text-white text-sm font-bold">{e.title}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ControlRoom;
