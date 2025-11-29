import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Send, User, MessageSquare, ArrowLeft, Bell, CheckCircle2, Calendar, Users, DollarSign } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

// Helper type for a conversation
interface Conversation {
  partnerId: string;
  partnerName: string;
  lastMessageText: string;
  lastMessageTime: number;
  unreadCount: number;
}

export const InboxPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'messages' | 'notifications'>('notifications');

  // 🎉 Convex: Get all conversations automatically with real-time updates!
  const conversations = useQuery(api.messages.myConversations, user ? {} : "skip");

  // Get notifications
  const notifications = useQuery(
    api.notifications.inApp.getByUser,
    user ? { userId: user.id } : "skip"
  );

  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Get messages for selected conversation (automatically updates in real-time!)
  const conversationMessages = useQuery(
    api.messages.getConversation,
    selectedPartnerId ? { otherUserId: selectedPartnerId } : "skip"
  );

  // Mutations
  const sendMessageMutation = useMutation(api.messages.send);
  const markConversationAsReadMutation = useMutation(api.messages.markConversationAsRead);
  const markNotificationAsReadMutation = useMutation(api.notifications.inApp.markAsRead);
  const markAllNotificationsAsReadMutation = useMutation(api.notifications.inApp.markAllAsRead);
  const deleteNotificationMutation = useMutation(api.notifications.inApp.deleteNotification);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // If navigated here with state (e.g. from "Message Vendor" button)
  useEffect(() => {
    if (location.state && (location.state as any).recipientId) {
      setSelectedPartnerId((location.state as any).recipientId);
    }
  }, [location]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages]);

  // Mark messages as read when viewing a conversation
  useEffect(() => {
    if (selectedPartnerId && conversationMessages && conversationMessages.length > 0) {
      markConversationAsReadMutation({ otherUserId: selectedPartnerId });
    }
  }, [selectedPartnerId, conversationMessages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !selectedPartnerId) return;

    setIsSending(true);
    try {
      await sendMessageMutation({
        recipientId: selectedPartnerId,
        content: newMessage,
      });
      setNewMessage('');
      toast.success('Message sent!');
    } catch (err) {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const isLoading = conversations === undefined;

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Please log in to view messages</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const conversationsList: Conversation[] = (conversations || []).map(c => ({
    partnerId: c.otherUserId,
    partnerName: c.otherUserName,
    lastMessageText: c.lastMessage,
    lastMessageTime: c.lastMessageTime,
    unreadCount: c.unreadCount,
  }));

  const selectedConversation = conversationsList.find(c => c.partnerId === selectedPartnerId);

  const handleNotificationClick = async (notification: any) => {
    // Mark as read
    if (!notification.isRead) {
      await markNotificationAsReadMutation({
        notificationId: notification._id,
        userId: user!.id,
      });
    }

    // Navigate to action URL if provided
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsReadMutation({ userId: user!.id });
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Failed to mark notifications as read');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20">
      <div className="max-w-7xl mx-auto h-[calc(100vh-5rem)] flex">
        {/* Sidebar with Tabs */}
        <div className={`${selectedPartnerId && activeTab === 'messages' ? 'hidden md:block' : 'block'} w-full md:w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col`}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Inbox</h2>

            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('notifications')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'notifications'
                    ? 'bg-teal-600 dark:bg-teal-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Bell className="w-4 h-4" />
                <span>Alerts</span>
                {notifications && notifications.filter((n: any) => !n.isRead).length > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {notifications.filter((n: any) => !n.isRead).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('messages')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'messages'
                    ? 'bg-teal-600 dark:bg-teal-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Messages</span>
                {conversationsList.reduce((total, c) => total + c.unreadCount, 0) > 0 && (
                  <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {conversationsList.reduce((total, c) => total + c.unreadCount, 0)}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'notifications' ? (
              // Notifications List
              notifications && notifications.length > 0 ? (
                <>
                  {notifications.filter((n: any) => !n.isRead).length > 0 && (
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-sm text-teal-600 dark:text-teal-400 hover:underline font-medium"
                      >
                        Mark all as read
                      </button>
                    </div>
                  )}
                  {notifications.map((notification: any) => (
                    <button
                      key={notification._id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`w-full p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left ${
                        !notification.isRead ? 'bg-teal-50/50 dark:bg-teal-900/10' : ''
                      }`}
                    >
                      <div className="flex gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          notification.type === 'new_sale' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                          notification.type === 'booking_confirmed' ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400' :
                          'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        }`}>
                          {notification.type === 'new_sale' ? <DollarSign className="w-5 h-5" /> :
                           notification.type === 'booking_confirmed' ? <CheckCircle2 className="w-5 h-5" /> :
                           <Bell className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h3 className="font-bold text-gray-900 dark:text-white">{notification.title}</h3>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-teal-600 dark:bg-teal-400 rounded-full flex-shrink-0 ml-2 mt-1"></div>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{notification.message}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                          {notification.actionLabel && (
                            <span className="inline-block mt-2 text-xs font-medium text-teal-600 dark:text-teal-400">
                              {notification.actionLabel} →
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No notifications yet</p>
                </div>
              )
            ) : (
              // Messages List
              conversationsList.length > 0 ? (
                conversationsList.map(c => (
                  <button
                    key={c.partnerId}
                    onClick={() => setSelectedPartnerId(c.partnerId)}
                    className={`w-full p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left ${
                      selectedPartnerId === c.partnerId ? 'bg-teal-50 dark:bg-teal-900/30' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center text-teal-600 dark:text-teal-400 font-bold">
                        {c.partnerName?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-gray-900 dark:text-white truncate">{c.partnerName || 'Unknown'}</h3>
                          {c.unreadCount > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-teal-600 dark:bg-teal-500 text-white text-xs rounded-full">
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{c.lastMessageText}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {new Date(c.lastMessageTime).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No messages yet</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* Chat Area / Notification Detail */}
        <div className={`${selectedPartnerId && activeTab === 'messages' ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-white dark:bg-gray-800`}>
          {activeTab === 'messages' && selectedPartnerId ? (
            <>
              {/* Chat Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4">
                <button
                  onClick={() => setSelectedPartnerId(null)}
                  className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                >
                  <ArrowLeft className="w-5 h-5 dark:text-gray-300" />
                </button>
                <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center text-teal-600 dark:text-teal-400 font-bold">
                  {selectedConversation?.partnerName?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">{selectedConversation?.partnerName || 'Unknown'}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Active now</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {conversationMessages && conversationMessages.length > 0 ? (
                  conversationMessages.map((msg) => {
                    const isMine = msg.senderId === user.id;
                    return (
                      <div
                        key={msg._id}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-md px-4 py-3 rounded-2xl ${
                            isMine
                              ? 'bg-teal-600 dark:bg-teal-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                          }`}
                        >
                          <p>{msg.content}</p>
                          <p className={`text-xs mt-1 ${isMine ? 'text-teal-100 dark:text-teal-200' : 'text-gray-500 dark:text-gray-400'}`}>
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={handleSend} className="p-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-teal-500 outline-none"
                    disabled={isSending}
                  />
                  <button
                    type="submit"
                    disabled={isSending || !newMessage.trim()}
                    className="px-6 py-3 bg-teal-600 dark:bg-teal-500 text-white rounded-xl font-bold hover:bg-teal-700 dark:hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : activeTab === 'notifications' ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <Bell className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Select a notification to view details</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
