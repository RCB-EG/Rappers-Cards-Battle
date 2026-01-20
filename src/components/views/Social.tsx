
import React, { useState, useEffect } from 'react';
import { GameState, User, FriendRequest, Friend, BattleCard } from '../../types';
import { db, auth } from '../../firebaseConfig';
import { collection, query, orderBy, limit, getDocs, where, addDoc, onSnapshot, doc, updateDoc, arrayUnion, writeBatch, getDoc } from 'firebase/firestore';
import Button from '../Button';
import InspectModal from '../modals/InspectModal';
import ChatModal from '../modals/ChatModal';
import { TranslationKey } from '../../utils/translations';

interface SocialProps {
    gameState: GameState;
    currentUser: User | null;
    t: (key: TranslationKey, replacements?: Record<string, string | number>) => string;
}

type Tab = 'leaderboard' | 'friends';

interface LeaderboardEntry {
    uid: string;
    username: string;
    rank: string;
    wins: number;
    value: number;
    avatar?: string;
    fullState?: GameState;
}

const Social: React.FC<SocialProps> = ({ gameState, currentUser, t }) => {
    const [activeTab, setActiveTab] = useState<Tab>('leaderboard');
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [searchUsername, setSearchUsername] = useState('');
    const [searchStatus, setSearchStatus] = useState<string>('');
    const [inspectUser, setInspectUser] = useState<{state: GameState, username: string} | null>(null);
    const [loadingLB, setLoadingLB] = useState(false);
    
    // New States for Features
    const [chatFriend, setChatFriend] = useState<Friend | null>(null);

    // --- Leaderboard Logic ---
    useEffect(() => {
        if (activeTab === 'leaderboard') {
            setLoadingLB(true);
            const fetchLeaderboard = async () => {
                try {
                    const q = query(
                        collection(db, 'users'), 
                        orderBy('rankValue', 'desc'), 
                        orderBy('rankWins', 'desc'), 
                        limit(50)
                    );
                    const snapshot = await getDocs(q);
                    const entries: LeaderboardEntry[] = [];
                    snapshot.forEach(doc => {
                        const data = doc.data() as GameState;
                        const profile = data.userProfile;
                        const squadValue = Object.values(data.formation).reduce((sum, c) => sum + (c?.value || 0), 0);

                        entries.push({
                            uid: doc.id,
                            username: profile?.username || 'Unknown',
                            rank: data.rank,
                            wins: data.rankWins,
                            value: squadValue,
                            avatar: profile?.avatar,
                            fullState: data 
                        });
                    });
                    setLeaderboard(entries);
                } catch (error) {
                    console.error("Leaderboard fetch error:", error);
                } finally {
                    setLoadingLB(false);
                }
            };
            fetchLeaderboard();
        }
    }, [activeTab]);

    // --- Friend Requests Listener ---
    useEffect(() => {
        if (!auth.currentUser) return;
        
        const q = query(
            collection(db, 'friend_requests'), 
            where('toUid', '==', auth.currentUser.uid),
            where('status', '==', 'pending')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reqs: FriendRequest[] = [];
            snapshot.forEach(doc => {
                reqs.push({ id: doc.id, ...doc.data() } as FriendRequest);
            });
            setFriendRequests(reqs);
        });

        return () => unsubscribe();
    }, []);

    const handleInspect = (entry: LeaderboardEntry) => {
        if (entry.fullState) {
            setInspectUser({ state: entry.fullState, username: entry.username });
        }
    };
    
    const handleInspectFriend = async (friend: Friend) => {
        try {
            const docRef = doc(db, 'users', friend.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const friendState = docSnap.data() as GameState;
                setInspectUser({ state: friendState, username: friend.username });
            }
        } catch (e) { console.error("Error inspecting friend:", e); }
    };

    const handleInviteBattle = async (friend: Friend) => {
        if (!auth.currentUser || !currentUser) return;
        try {
            await addDoc(collection(db, 'battle_invites'), {
                fromUid: auth.currentUser.uid,
                fromName: currentUser.username,
                toUid: friend.uid,
                status: 'pending',
                timestamp: Date.now()
            });
            alert(`Challenge sent to ${friend.username}!`);
        } catch (e) {
            console.error("Invite error:", e);
        }
    };

    const handleSendRequest = async () => {
        if (!searchUsername || !auth.currentUser || !currentUser) return;
        setSearchStatus('Searching...');

        try {
            const q = query(collection(db, 'users'), where('userProfile.username', '==', searchUsername));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                setSearchStatus(t('social_user_not_found'));
                return;
            }

            const targetDoc = snapshot.docs[0];
            const targetUid = targetDoc.id;
            const targetData = targetDoc.data();

            if (targetUid === auth.currentUser.uid) {
                setSearchStatus("Cannot add yourself.");
                return;
            }
            
            if (gameState.friends?.some(f => f.uid === targetUid)) {
                setSearchStatus("Already friends.");
                return;
            }

            await addDoc(collection(db, 'friend_requests'), {
                fromUid: auth.currentUser.uid,
                fromName: currentUser.username,
                fromAvatar: currentUser.avatar,
                toUid: targetUid,
                toName: targetData.userProfile.username,
                status: 'pending',
                timestamp: Date.now()
            });

            setSearchStatus(t('social_request_sent'));
            setSearchUsername('');
        } catch (error) {
            console.error(error);
            setSearchStatus("Error sending request.");
        }
    };

    const handleAcceptRequest = async (req: FriendRequest) => {
        if (!auth.currentUser) return;

        try {
            const batch = writeBatch(db);
            const reqRef = doc(db, 'friend_requests', req.id);
            batch.delete(reqRef);

            const myRef = doc(db, 'users', auth.currentUser.uid);
            const myNewFriend: Friend = { uid: req.fromUid, username: req.fromName, avatar: req.fromAvatar };
            batch.update(myRef, { friends: arrayUnion(myNewFriend) });

            const theirRef = doc(db, 'users', req.fromUid);
            const theirNewFriend: Friend = { uid: auth.currentUser.uid, username: currentUser?.username || 'Unknown', avatar: currentUser?.avatar };
            batch.update(theirRef, { friends: arrayUnion(theirNewFriend) });

            await batch.commit();
        } catch (error) {
            console.error("Accept error", error);
        }
    };

    return (
        <div className="animate-fadeIn max-w-4xl mx-auto">
            <h2 className="font-header text-4xl text-white text-center mb-6 [text-shadow:0_0_5px_#00c7e2,0_0_10px_#00c7e2]">{t('header_social')}</h2>

            <div className="flex justify-center gap-4 mb-6">
                <button 
                    onClick={() => setActiveTab('leaderboard')} 
                    className={`px-6 py-2 rounded-full font-bold transition-all ${activeTab === 'leaderboard' ? 'bg-gold-light text-black shadow-gold-glow' : 'bg-gray-800 text-gray-400'}`}
                >
                    {t('social_leaderboard')}
                </button>
                <button 
                    onClick={() => setActiveTab('friends')} 
                    className={`px-6 py-2 rounded-full font-bold transition-all ${activeTab === 'friends' ? 'bg-gold-light text-black shadow-gold-glow' : 'bg-gray-800 text-gray-400'}`}
                >
                    {t('social_friends')}
                </button>
            </div>

            {activeTab === 'leaderboard' && (
                <div className="bg-black/40 rounded-xl border border-gold-dark/30 overflow-hidden">
                    {loadingLB ? (
                        <div className="p-8 text-center text-gray-400">Loading rankings...</div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-gray-900/80 text-gold-light uppercase text-sm font-header tracking-wider">
                                <tr>
                                    <th className="p-4">#</th>
                                    <th className="p-4">Player</th>
                                    <th className="p-4">{t('social_rank')}</th>
                                    <th className="p-4 hidden md:table-cell">{t('social_squad_value')}</th>
                                    <th className="p-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {leaderboard.map((entry, idx) => (
                                    <tr key={entry.uid} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 font-bold text-gray-400">{idx + 1}</td>
                                        <td className="p-4 flex items-center gap-3">
                                            <img src={entry.avatar || 'https://api.dicebear.com/8.x/bottts/svg?seed=guest'} className="w-8 h-8 rounded-full bg-gray-700" alt="av" />
                                            <span className={entry.uid === auth.currentUser?.uid ? 'text-gold-light font-bold' : 'text-white'}>{entry.username}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${entry.rank === 'Legend' ? 'bg-purple-900 text-purple-200' : entry.rank === 'Gold' ? 'bg-yellow-900 text-yellow-200' : 'bg-gray-800 text-gray-300'}`}>
                                                {entry.rank}
                                            </span>
                                        </td>
                                        <td className="p-4 hidden md:table-cell text-gray-300">
                                            {entry.value.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => handleInspect(entry)} className="text-blue-400 hover:text-blue-300 text-sm underline">
                                                {t('social_inspect_squad')}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {activeTab === 'friends' && (
                <div className="space-y-8">
                    {/* Add Friend */}
                    <div className="bg-black/30 p-6 rounded-xl border border-gray-700">
                        <h3 className="font-header text-2xl text-white mb-4">{t('social_add_friend')}</h3>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={searchUsername}
                                onChange={(e) => setSearchUsername(e.target.value)}
                                placeholder={t('social_search_placeholder')}
                                className="flex-grow bg-darker-gray border border-gray-600 rounded-lg px-4 py-2 text-white focus:border-gold-light outline-none"
                            />
                            <Button variant="keep" onClick={handleSendRequest}>{t('social_send_request')}</Button>
                        </div>
                        {searchStatus && <p className={`mt-2 text-sm ${searchStatus.includes('sent') ? 'text-green-400' : 'text-red-400'}`}>{searchStatus}</p>}
                    </div>

                    {/* Pending Requests */}
                    {friendRequests.length > 0 && (
                        <div className="bg-black/30 p-6 rounded-xl border border-blue-900/50">
                            <h3 className="font-header text-2xl text-blue-300 mb-4">{t('social_requests')}</h3>
                            <div className="space-y-3">
                                {friendRequests.map(req => (
                                    <div key={req.id} className="flex justify-between items-center bg-darker-gray p-3 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <img src={req.fromAvatar || 'https://api.dicebear.com/8.x/bottts/svg?seed=req'} className="w-10 h-10 rounded-full" />
                                            <span className="text-white font-bold">{req.fromName}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="keep" onClick={() => handleAcceptRequest(req)} className="!py-1 !px-3 text-sm">{t('social_accept')}</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* My Friends */}
                    <div className="bg-black/30 p-6 rounded-xl border border-gold-dark/30">
                        <h3 className="font-header text-2xl text-gold-light mb-4">{t('social_my_friends')}</h3>
                        {gameState.friends && gameState.friends.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {gameState.friends.map((friend, idx) => (
                                    <div key={idx} className="flex flex-col bg-darker-gray p-4 rounded-lg border border-gray-700 hover:border-gold-light transition-all">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <img src={friend.avatar || 'https://api.dicebear.com/8.x/bottts/svg?seed=friend'} className="w-10 h-10 rounded-full bg-gray-600" />
                                                <span className="text-white font-bold">{friend.username}</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <button onClick={() => setChatFriend(friend)} className="flex-1 py-1 bg-blue-600/20 text-blue-300 text-xs rounded border border-blue-600/50 hover:bg-blue-600 hover:text-white transition">Message</button>
                                            <button onClick={() => handleInviteBattle(friend)} className="flex-1 py-1 bg-red-600/20 text-red-300 text-xs rounded border border-red-600/50 hover:bg-red-600 hover:text-white transition">Battle</button>
                                            <button onClick={() => handleInspectFriend(friend)} className="flex-1 py-1 bg-gray-600/20 text-gray-300 text-xs rounded border border-gray-600/50 hover:bg-gray-600 hover:text-white transition">Inspect</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 italic text-center">{t('social_no_friends')}</p>
                        )}
                    </div>
                </div>
            )}

            {inspectUser && (
                <InspectModal 
                    isOpen={!!inspectUser} 
                    onClose={() => setInspectUser(null)} 
                    targetUser={inspectUser.state} 
                    username={inspectUser.username} 
                />
            )}

            <ChatModal 
                isOpen={!!chatFriend}
                onClose={() => setChatFriend(null)}
                friend={chatFriend}
            />
        </div>
    );
};

export default Social;
