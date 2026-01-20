
import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import Button from '../Button';
import { Friend, ChatMessage } from '../../types';
import { db, auth } from '../../firebaseConfig';
import { collection, addDoc, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    friend: Friend | null;
}

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, friend }) => {
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatId, setChatId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen || !friend || !auth.currentUser) return;

        // 1. Resolve Chat ID (simple combination of UIDs alphabetically sorted)
        const participants = [auth.currentUser.uid, friend.uid].sort();
        const resolvedChatId = `${participants[0]}_${participants[1]}`;
        setChatId(resolvedChatId);

        // 2. Listen to Messages
        const q = query(
            collection(db, 'chats', resolvedChatId, 'messages'),
            orderBy('timestamp', 'asc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: ChatMessage[] = [];
            snapshot.forEach(doc => {
                msgs.push({ id: doc.id, ...doc.data() } as ChatMessage);
            });
            setMessages(msgs);
            // Scroll to bottom
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        return () => unsubscribe();
    }, [isOpen, friend]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !chatId || !auth.currentUser) return;

        try {
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                text: message,
                senderId: auth.currentUser.uid,
                timestamp: Date.now()
            });
            setMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    if (!isOpen || !friend) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Chat: ${friend.username}`} size="lg">
            <div className="flex flex-col h-[400px] w-full">
                <div className="flex-grow overflow-y-auto bg-black/40 rounded-lg p-4 mb-4 border border-gold-dark/20 space-y-3">
                    {messages.length === 0 ? (
                        <p className="text-gray-500 text-center italic mt-10">Start the conversation!</p>
                    ) : (
                        messages.map(msg => {
                            const isMe = msg.senderId === auth.currentUser?.uid;
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[70%] p-3 rounded-xl ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-darker-gray text-gray-200 rounded-bl-none border border-gray-700'}`}>
                                        <p className="break-words text-sm md:text-base">{msg.text}</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSend} className="flex gap-2">
                    <input 
                        type="text" 
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-grow bg-darker-gray border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-gold-light outline-none"
                    />
                    <Button variant="keep" type="submit" disabled={!message.trim()}>Send</Button>
                </form>
            </div>
        </Modal>
    );
};

export default ChatModal;
