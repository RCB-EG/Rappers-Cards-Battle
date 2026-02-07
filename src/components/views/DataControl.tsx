
import React, { useState, useMemo, useEffect } from 'react';
import { db, auth } from '../../firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, addDoc, onSnapshot } from 'firebase/firestore';
import Button from '../Button';
import { GameState, Card, Rank, BlitzRank, PackType, PackData } from '../../types';
import { packs as defaultPacks } from '../../data/gameData';
import { initialState } from '../../data/initialState';

interface DataControlProps {
    onClose: () => void;
    allCards: Card[];
}

const DataControl: React.FC<DataControlProps> = ({ onClose, allCards }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchType, setSearchType] = useState<'username' | 'uid'>('username');
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<{ id: string; data: GameState }[]>([]);
    const [selectedUser, setSelectedUser] = useState<{ id: string; data: GameState } | null>(null);
    const [messageText, setMessageText] = useState('');
    const [dynamicPacks, setDynamicPacks] = useState<Record<string, PackData>>({});

    // Editing States
    const [editCoins, setEditCoins] = useState<number>(0);
    const [editBp, setEditBp] = useState<number>(0);
    const [editRank, setEditRank] = useState<Rank>('Bronze');
    const [editStreet, setEditStreet] = useState<BlitzRank>(5);
    
    // Inventory States
    const [selectedCardId, setSelectedCardId] = useState<string>('');
    const [selectedPackId, setSelectedPackId] = useState<string>('');

    // Fetch Dynamic Packs
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'packs'), (docSnap) => {
            if (docSnap.exists()) {
                setDynamicPacks(docSnap.data() as Record<string, PackData>);
            }
        });
        return () => unsub();
    }, []);

    const packOptions = useMemo(() => {
        const defaults = Object.keys(defaultPacks);
        const dynamics = Object.keys(dynamicPacks);
        return Array.from(new Set([...defaults, ...dynamics])) as PackType[];
    }, [dynamicPacks]);

    const handleSearch = async () => {
        if (!searchTerm.trim()) return;
        setLoading(true);
        setUsers([]);
        setSelectedUser(null);

        try {
            let q;
            if (searchType === 'uid') {
                q = query(collection(db, 'users'), where('userId', '==', searchTerm.trim()));
            } else {
                q = query(collection(db, 'users'), where('userProfile.username', '==', searchTerm.trim()));
            }

            const snapshot = await getDocs(q);
            const results: { id: string; data: GameState }[] = [];
            snapshot.forEach(doc => {
                results.push({ id: doc.id, data: doc.data() as GameState });
            });
            setUsers(results);
        } catch (e) {
            console.error(e);
            alert("Search failed. Check console.");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectUser = (user: { id: string; data: GameState }) => {
        setSelectedUser(user);
        setEditCoins(user.data.coins);
        setEditBp(user.data.battlePoints || 0);
        setEditRank(user.data.rank || 'Bronze');
        setEditStreet(user.data.blitzRank || 5);
    };

    const refreshSelectedUser = async () => {
        if (!selectedUser) return;
        const q = query(collection(db, 'users'), where('userId', '==', selectedUser.id));
        const snap = await getDocs(q);
        if (!snap.empty) {
            handleSelectUser({ id: snap.docs[0].id, data: snap.docs[0].data() as GameState });
        }
    };

    // --- ACTIONS ---

    const handleUpdateStats = async () => {
        if (!selectedUser) return;
        try {
            const userRef = doc(db, 'users', selectedUser.id);
            await updateDoc(userRef, {
                coins: Number(editCoins),
                battlePoints: Number(editBp),
                rank: editRank,
                blitzRank: Number(editStreet)
            });
            alert("Stats updated!");
            refreshSelectedUser();
        } catch (e) {
            console.error(e);
            alert("Update failed.");
        }
    };

    const handleGiveCard = async () => {
        if (!selectedUser || !selectedCardId) return;
        const cardDef = allCards.find(c => c.id === selectedCardId);
        if (!cardDef) return;

        try {
            const userRef = doc(db, 'users', selectedUser.id);
            const newCard = { ...cardDef, id: `${cardDef.id}-${Date.now()}-ADMIN` };
            await updateDoc(userRef, {
                storage: arrayUnion(newCard)
            });
            alert(`Added ${cardDef.name} to user storage.`);
            refreshSelectedUser();
        } catch (e) {
            console.error(e);
            alert("Failed to add card.");
        }
    };

    const handleGivePack = async () => {
        if (!selectedUser || !selectedPackId) return;
        try {
            const userRef = doc(db, 'users', selectedUser.id);
            await updateDoc(userRef, {
                ownedPacks: arrayUnion(selectedPackId)
            });
            alert(`Added ${selectedPackId} pack.`);
            refreshSelectedUser();
        } catch (e) {
            console.error(e);
            alert("Failed to add pack.");
        }
    };

    const handleBanUser = async () => {
        if (!selectedUser) return;
        const isBanned = selectedUser.data.banned;
        if (!window.confirm(`Are you sure you want to ${isBanned ? 'UNBAN' : 'BAN'} this user?`)) return;

        try {
            const userRef = doc(db, 'users', selectedUser.id);
            await updateDoc(userRef, {
                banned: !isBanned
            });
            alert(`User ${!isBanned ? 'BANNED' : 'UNBANNED'}.`);
            refreshSelectedUser();
        } catch (e) {
            console.error(e);
            alert("Action failed.");
        }
    };

    const handleResetAccount = async () => {
        if (!selectedUser) return;
        if (!window.confirm("DANGER: This will wipe all user progress, cards, and coins. This cannot be undone. Continue?")) return;

        try {
            const userRef = doc(db, 'users', selectedUser.id);
            const dataToSave = {
                coins: 10000,
                battlePoints: 0,
                xp: 0,
                rank: 'Bronze',
                blitzRank: 5,
                formation: initialState.formation,
                storage: [],
                completedFbcIds: [],
                completedEvoIds: [],
                activeEvolution: null,
                ownedPacks: [],
                ownedPlayerPicks: [],
                rankWins: 0,
                blitzWins: 0
            };

            await updateDoc(userRef, dataToSave);
            alert("User account reset.");
            refreshSelectedUser();
        } catch (e) {
            console.error(e);
            alert("Reset failed.");
        }
    };

    const handleSendMessage = async () => {
        if (!selectedUser || !messageText.trim() || !auth.currentUser) return;
        
        try {
            const chatId = `ADMIN_MSG_${selectedUser.id}`;
            const chatRef = doc(db, 'chats', chatId);
            
            // Overwrite readStatus to just the admin, effectively marking it unread for the user
            const chatData = {
                participants: [auth.currentUser.uid, selectedUser.id],
                lastMessage: messageText,
                lastMessageTime: Date.now(),
                lastSenderId: auth.currentUser.uid,
                readStatus: {
                    [auth.currentUser.uid]: Date.now()
                }
            };

            await updateDoc(chatRef, chatData).catch(async () => {
                const { setDoc } = await import('firebase/firestore');
                await setDoc(chatRef, chatData);
            });

            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                text: `[SYSTEM ADMIN]: ${messageText}`,
                senderId: auth.currentUser.uid,
                timestamp: Date.now()
            });

            alert("Message sent.");
            setMessageText('');
        } catch (e) {
            console.error(e);
            alert("Failed to send message.");
        }
    };

    return (
        <div className="animate-fadeIn w-full max-w-7xl mx-auto pb-12">
            <div className="flex justify-between items-center mb-8 bg-blue-900/40 p-4 rounded-lg border border-blue-500/50 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="text-4xl">💾</div>
                    <div>
                        <h2 className="font-header text-4xl text-blue-400">DATA CONTROL</h2>
                        <p className="text-gray-400 text-sm">User Management & Database Manipulation</p>
                    </div>
                </div>
                <Button variant="default" onClick={onClose} className="px-6">Close</Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* LEFT COLUMN: SEARCH & LIST */}
                <div className="lg:col-span-1 bg-black/40 p-6 rounded-xl border border-blue-900/30 flex flex-col gap-6 h-fit">
                    <div>
                        <h3 className="text-xl font-header text-white mb-4">Find User</h3>
                        <div className="flex gap-2 mb-2">
                            <select 
                                value={searchType} 
                                onChange={(e) => setSearchType(e.target.value as 'username' | 'uid')}
                                className="bg-gray-900 border border-gray-700 text-white rounded p-2 text-sm"
                            >
                                <option value="username">Username</option>
                                <option value="uid">User ID</option>
                            </select>
                            <input 
                                type="text" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search..."
                                className="flex-grow bg-gray-900 border border-gray-700 text-white rounded p-2"
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <Button variant="keep" onClick={handleSearch} className="w-full" disabled={loading}>
                            {loading ? 'Searching...' : 'Search'}
                        </Button>
                    </div>

                    <div className="flex-grow overflow-y-auto max-h-[500px]">
                        {users.length > 0 ? (
                            <div className="space-y-2">
                                {users.map(u => (
                                    <div 
                                        key={u.id} 
                                        onClick={() => handleSelectUser(u)}
                                        className={`p-3 rounded border cursor-pointer transition-all ${selectedUser?.id === u.id ? 'bg-blue-900/50 border-blue-400' : 'bg-gray-800/50 border-gray-700 hover:bg-gray-700'}`}
                                    >
                                        <p className="font-bold text-white">{u.data.userProfile?.username || 'Unknown'}</p>
                                        <p className="text-xs text-gray-400 font-mono truncate">{u.id}</p>
                                        {u.data.banned && <span className="text-red-500 font-bold text-xs">BANNED</span>}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center italic">No users found.</p>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: USER DETAILS & ACTIONS */}
                <div className="lg:col-span-2">
                    {selectedUser ? (
                        <div className="space-y-6">
                            {/* USER HEADER */}
                            <div className="bg-black/60 p-6 rounded-xl border border-gold-dark/30 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <img src={selectedUser.data.userProfile?.avatar || 'https://api.dicebear.com/8.x/bottts/svg?seed=u'} className="w-16 h-16 rounded-full bg-gray-700" />
                                    <div>
                                        <h3 className="text-3xl font-header text-white">{selectedUser.data.userProfile?.username}</h3>
                                        <p className="text-gray-400 text-sm font-mono">{selectedUser.id}</p>
                                        <p className="text-gray-400 text-sm">{selectedUser.data.userProfile?.email}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {selectedUser.data.banned ? (
                                        <span className="bg-red-600 text-white px-4 py-2 rounded font-bold animate-pulse">BANNED</span>
                                    ) : (
                                        <span className="bg-green-600/20 text-green-400 px-4 py-2 rounded font-bold border border-green-600">ACTIVE</span>
                                    )}
                                </div>
                            </div>

                            {/* STATS CONTROL */}
                            <div className="bg-black/40 p-6 rounded-xl border border-gray-700">
                                <h4 className="text-gold-light font-header text-2xl mb-4 border-b border-gray-700 pb-2">Stats Management</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                    <div>
                                        <label className="text-gray-400 text-xs uppercase block mb-1">Coins</label>
                                        <input type="number" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={editCoins} onChange={e => setEditCoins(parseInt(e.target.value))} />
                                    </div>
                                    <div>
                                        <label className="text-gray-400 text-xs uppercase block mb-1">Battle Points</label>
                                        <input type="number" className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={editBp} onChange={e => setEditBp(parseInt(e.target.value))} />
                                    </div>
                                    <div>
                                        <label className="text-gray-400 text-xs uppercase block mb-1">Rank</label>
                                        <select className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={editRank} onChange={e => setEditRank(e.target.value as Rank)}>
                                            <option value="Bronze">Bronze</option>
                                            <option value="Silver">Silver</option>
                                            <option value="Gold">Gold</option>
                                            <option value="Legend">Legend</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-gray-400 text-xs uppercase block mb-1">Street Rank</label>
                                        <select className="w-full bg-black border border-gray-600 rounded p-2 text-white" value={editStreet} onChange={e => setEditStreet(parseInt(e.target.value) as BlitzRank)}>
                                            {[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button variant="keep" onClick={handleUpdateStats} className="px-6 py-2 text-sm">Save Stats</Button>
                                </div>
                            </div>

                            {/* INVENTORY CONTROL */}
                            <div className="bg-black/40 p-6 rounded-xl border border-gray-700">
                                <h4 className="text-purple-400 font-header text-2xl mb-4 border-b border-gray-700 pb-2">Inventory Injection</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Add Card */}
                                    <div className="bg-gray-900/50 p-4 rounded border border-gray-700">
                                        <label className="text-gray-300 font-bold block mb-2">Give Card</label>
                                        <div className="flex gap-2">
                                            <select 
                                                className="flex-grow bg-black border border-gray-600 rounded p-2 text-white text-sm"
                                                value={selectedCardId}
                                                onChange={e => setSelectedCardId(e.target.value)}
                                            >
                                                <option value="">Select Card...</option>
                                                {allCards.sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                                                    <option key={c.id} value={c.id}>{c.name} ({c.rarity})</option>
                                                ))}
                                            </select>
                                            <Button variant="default" onClick={handleGiveCard} disabled={!selectedCardId} className="!py-1 !px-3 text-xs">Add</Button>
                                        </div>
                                    </div>

                                    {/* Add Pack */}
                                    <div className="bg-gray-900/50 p-4 rounded border border-gray-700">
                                        <label className="text-gray-300 font-bold block mb-2">Give Pack</label>
                                        <div className="flex gap-2">
                                            <select 
                                                className="flex-grow bg-black border border-gray-600 rounded p-2 text-white text-sm capitalize"
                                                value={selectedPackId}
                                                onChange={e => setSelectedPackId(e.target.value)}
                                            >
                                                <option value="">Select Pack...</option>
                                                {packOptions.map(p => (
                                                    <option key={p} value={p}>{p}</option>
                                                ))}
                                            </select>
                                            <Button variant="default" onClick={handleGivePack} disabled={!selectedPackId} className="!py-1 !px-3 text-xs">Add</Button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* DANGER ZONE & COMMS */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Actions */}
                                <div className="bg-red-900/20 p-6 rounded-xl border border-red-900/50">
                                    <h4 className="text-red-500 font-header text-2xl mb-4 border-b border-red-900/30 pb-2">Account Actions</h4>
                                    <div className="flex flex-col gap-3">
                                        <Button variant="sell" onClick={handleBanUser} className="w-full">
                                            {selectedUser.data.banned ? 'Unban User' : 'Ban User'}
                                        </Button>
                                        <Button variant="sell" onClick={handleResetAccount} className="w-full bg-black border-red-700 text-red-500 hover:bg-red-900">
                                            ⚠️ Reset Account
                                        </Button>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="bg-blue-900/20 p-6 rounded-xl border border-blue-900/50">
                                    <h4 className="text-blue-400 font-header text-2xl mb-4 border-b border-blue-900/30 pb-2">Admin Message</h4>
                                    <textarea 
                                        className="w-full bg-black/50 border border-gray-600 rounded p-3 text-white text-sm mb-3 h-24 resize-none"
                                        placeholder="Type message to user..."
                                        value={messageText}
                                        onChange={e => setMessageText(e.target.value)}
                                    />
                                    <Button variant="default" onClick={handleSendMessage} disabled={!messageText.trim()} className="w-full">
                                        Send Message
                                    </Button>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center bg-black/20 rounded-xl border border-dashed border-gray-700 min-h-[400px]">
                            <p className="text-gray-500 text-xl">Select a user to manage data.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DataControl;
