import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Paperclip,
  Mic,
  Square,
  X,
  Search,
  Lock,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
  Download,
  Trash2,
  Users,
  ChevronLeft,
  AlertCircle,
  UserPlus
} from 'lucide-react';

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100MB max limit

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function MessengerModal({
  isOpen,
  onClose,
  socket,
  currentUser,
  authToken,
  inquiredProduct,
  setInquiredProduct
}) {
  const isAdmin = currentUser?.role === 'admin';
  const viewRole = isAdmin ? 'admin' : 'client';
  const clientId = currentUser?.id || '';
  const clientName = currentUser?.fullName || 'Customer';
  const clientPhone = currentUser?.phone || '';
  const clientEmail = currentUser?.email || '';

  const [thread, setThread] = useState(null);
  const [allThreads, setAllThreads] = useState([]);
  const [activeAdminThreadId, setActiveAdminThreadId] = useState(null);
  const [searchClient, setSearchClient] = useState('');
  const [mobilePane, setMobilePane] = useState('chat'); // 'list' | 'chat'

  // Admin: start new chat with any client
  const [showNewClientBox, setShowNewClientBox] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  // Composer state
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const currentThreadId = viewRole === 'admin' ? activeAdminThreadId || allThreads[0]?.clientId || clientId : clientId;

  useEffect(() => {
    if (!isOpen || !currentUser || !authToken) return;

    if (viewRole === 'admin') {
      fetch('/api/chat/threads', {
        headers: {}
      })
        .then((r) => r.json())
        .then((data) => {
          const list = data.threads || [];
          setAllThreads(list);
          if (!activeAdminThreadId && list.length > 0) {
            setActiveAdminThreadId(list[0].clientId);
            setThread(list[0]);
          } else if (activeAdminThreadId) {
            const match = list.find((t) => t.clientId === activeAdminThreadId);
            if (match) setThread(match);
          }
        })
        .catch(console.error);
    } else {
      fetch('/api/chat/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.thread) setThread(data.thread);
        })
        .catch(console.error);
    }
  }, [isOpen, viewRole, currentUser, authToken, activeAdminThreadId]);

  useEffect(() => {
    if (!socket || !isOpen) return;
    // Rooms are assigned by the server from the signed-in session.

    const onIncoming = (payload) => {
      if (payload.clientId === currentThreadId) {
        setThread(payload.thread);
      }
      if (viewRole === 'admin') {
        setAllThreads((prev) => [payload.thread, ...prev.filter((t) => t.clientId !== payload.clientId)]);
      }
    };

    const onMessageDeleted = (payload) => {
      if (payload.clientId === currentThreadId) {
        setThread(payload.thread);
      }
      if (viewRole === 'admin') {
        setAllThreads((prev) => prev.map((t) => (t.clientId === payload.clientId ? payload.thread : t)));
      }
    };

    const onThreadDeleted = (payload) => {
      if (viewRole === 'admin') {
        setAllThreads((prev) => {
          const remaining = prev.filter((t) => t.clientId !== payload.clientId);
          if (payload.clientId === currentThreadId) {
            const next = remaining[0] || null;
            setActiveAdminThreadId(next ? next.clientId : null);
            setThread(next);
          }
          return remaining;
        });
      } else if (payload.clientId === currentThreadId) {
        setThread((prev) => (prev ? { ...prev, messages: [] } : null));
      }
    };

    socket.on('chat:message', onIncoming);
    socket.on('chat:admin-update', onIncoming);
    socket.on('chat:message-deleted', onMessageDeleted);
    socket.on('chat:thread-deleted', onThreadDeleted);
    return () => {
      socket.off('chat:message', onIncoming);
      socket.off('chat:admin-update', onIncoming);
      socket.off('chat:message-deleted', onMessageDeleted);
      socket.off('chat:thread-deleted', onThreadDeleted);
    };
  }, [socket, isOpen, currentThreadId, viewRole]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages?.length, isOpen, inquiredProduct]);

  const uploadFile = (file) => {
    setUploadError('');
    if (file.size > MAX_FILE_BYTES) {
      setUploadError(`"${file.name}" (${formatBytes(file.size)}) exceeds the 100MB limit.`);
      return;
    }

    setUploading(true);
    setUploadProgress(5);
    const fd = new FormData();
    fd.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/media/upload', true);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      setUploading(false);
      setUploadProgress(0);
      if (xhr.status >= 200 && xhr.status < 300) {
        const resp = JSON.parse(xhr.responseText);
        if (resp.file) setAttachments((prev) => [...prev, resp.file]);
      } else {
        try {
          setUploadError(JSON.parse(xhr.responseText).error || 'Upload rejected.');
        } catch {
          setUploadError('Upload failed.');
        }
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      setUploadProgress(0);
      setUploadError('Network error during file upload.');
    };
    xhr.send(fd);
  };

  const startVoice = async () => {
    setUploadError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      audioChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const voiceFile = new File([blob], `Voice-${Date.now()}.webm`, { type: 'audio/webm' });
        uploadFile(voiceFile);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = rec;
      rec.start();
      setIsRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    } catch {
      setUploadError('Microphone unavailable. You can still attach audio/video files up to 100MB.');
    }
  };

  const stopVoice = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleStartNewClientChat = async (e) => {
    e.preventDefault();
    if (!newClientName.trim() || !authToken) return;
    const res = await fetch('/api/chat/admin-start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientName: newClientName.trim(),
        clientPhone: newClientPhone.trim()
      })
    });
    const data = await res.json();
    if (data.thread) {
      setAllThreads((prev) => [data.thread, ...prev]);
      setActiveAdminThreadId(data.thread.clientId);
      setThread(data.thread);
      setNewClientName('');
      setNewClientPhone('');
      setShowNewClientBox(false);
      setMobilePane('chat');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!isAdmin || !authToken || !currentThreadId) return;
    if (!window.confirm('Delete this message for BOTH Admin and Client and permanently remove any attached files to save storage?')) {
      return;
    }
    const res = await fetch(
      `/api/chat/message/${encodeURIComponent(currentThreadId)}/${encodeURIComponent(messageId)}`,
      {
        method: 'DELETE',
        headers: {}
      }
    );
    const data = await res.json();
    if (res.ok && data.thread) {
      setThread(data.thread);
      setAllThreads((prev) => prev.map((t) => (t.clientId === currentThreadId ? data.thread : t)));
    }
  };

  const handleDeleteConversation = async (targetClientId, targetName = 'this client') => {
    if (!isAdmin || !authToken || !targetClientId) return;
    if (
      !window.confirm(
        `Permanently delete the ENTIRE conversation with ${targetName} from BOTH Admin and Client and free all uploaded media storage?`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/chat/thread/${encodeURIComponent(targetClientId)}`, {
      method: 'DELETE',
      headers: {}
    });
    const data = await res.json();
    if (res.ok) {
      const remaining = data.threads || [];
      setAllThreads(remaining);
      if (targetClientId === currentThreadId) {
        const next = remaining[0] || null;
        setActiveAdminThreadId(next ? next.clientId : null);
        setThread(next);
      }
    }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!authToken) return;
    if (!text.trim() && attachments.length === 0 && !inquiredProduct) return;

    const payload = {
      clientId: currentThreadId,
      text: text.trim(),
      attachments: attachments.map((a) => a.id),
      inquiredProductId: inquiredProduct?.id || null
    };

    setText('');
    setAttachments([]);
    if (setInquiredProduct) setInquiredProduct(null);

    const res = await fetch('/api/chat/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setUploadError(data.error || 'Message could not be sent.');
      return;
    }
    if (data.thread) {
      setThread(data.thread);
      if (viewRole === 'admin') {
        setAllThreads((prev) => [data.thread, ...prev.filter((t) => t.clientId !== data.thread.clientId)]);
      }
    }
  };

  if (!isOpen || !currentUser) return null;

  const filteredThreads = allThreads.filter((t) => {
    if (!searchClient.trim()) return true;
    const q = searchClient.toLowerCase();
    return (
      t.clientName?.toLowerCase().includes(q) ||
      t.clientPhone?.toLowerCase().includes(q) ||
      t.clientEmail?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060F24]/75 p-0 sm:p-4 backdrop-blur-sm">
      <div className="flex h-full sm:h-[88vh] w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl border border-[#B8844E]/50">
        {/* Messenger Header */}
        <div className="flex items-center justify-between gap-2 bg-[#0F2557] px-4 sm:px-5 py-3.5 text-white border-b border-[#B8844E]/40 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {viewRole === 'admin' && (
              <button
                type="button"
                onClick={() => setMobilePane(mobilePane === 'list' ? 'chat' : 'list')}
                className="md:hidden p-1.5 rounded bg-white/10 text-[#F2D5B1]"
              >
                {mobilePane === 'chat' ? <ChevronLeft className="h-4 w-4" /> : <Users className="h-4 w-4" />}
              </button>
            )}
            <MessageSquare className="h-5 w-5 text-[#F2D5B1] shrink-0" />
            <div className="min-w-0">
              <h3 className="font-serif text-lg sm:text-xl font-bold text-[#F2D5B1] truncate">
                {viewRole === 'admin' ? 'AXELON Admin Messenger' : 'Chat with AXELON Admin'}
              </h3>
              <p className="text-[11px] text-white/75 truncate">
                Text, Voice Notes, Photos, Videos, PDFs & Any File (Up to 100MB • Encrypted)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && thread && (
              <button
                type="button"
                onClick={() => handleDeleteConversation(thread.clientId, thread.clientName)}
                className="inline-flex items-center gap-1 bg-red-600/90 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-red-700 transition"
                title="Delete Entire Conversation for Both Admin & Client"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Delete Chat</span>
              </button>
            )}
            <span className="hidden sm:inline-block bg-[#060F24] border border-[#B8844E]/40 px-2.5 py-1 text-[10px] font-bold uppercase text-[#F2D5B1]">
              {isAdmin ? 'Admin Account' : clientName}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-white/80 hover:bg-white/10 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Admin Sidebar: Search & Text Any Client */}
          {viewRole === 'admin' && (
            <div
              className={`${
                mobilePane === 'list' ? 'flex w-full' : 'hidden'
              } md:flex md:w-72 flex-col border-r border-[#DBBB97]/60 bg-[#FBF8F4] shrink-0`}
            >
              <div className="p-3 border-b border-[#DBBB97]/60 space-y-2 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#0F2557]">
                    Clients ({filteredThreads.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNewClientBox(!showNewClientBox)}
                    className="inline-flex items-center gap-1 bg-[#0F2557] px-2 py-1 text-[10px] font-bold text-[#F2D5B1] hover:bg-[#060F24]"
                    title="Start New Chat with a Client"
                  >
                    <UserPlus className="h-3 w-3" /> New Chat
                  </button>
                </div>

                {/* Search Client Box */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-navy-400" />
                  <input
                    type="text"
                    value={searchClient}
                    onChange={(e) => setSearchClient(e.target.value)}
                    placeholder="Search client name or phone..."
                    className="w-full border border-[#DBBB97] bg-[#FBF8F4] pl-8 pr-2.5 py-1.5 text-xs focus:outline-none"
                  />
                </div>

                {showNewClientBox && (
                  <form onSubmit={handleStartNewClientChat} className="space-y-1.5 pt-1 border-t border-navy-100">
                    <input
                      type="text"
                      required
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      placeholder="Client Name *"
                      className="w-full border border-navy-200 px-2 py-1 text-xs"
                    />
                    <input
                      type="tel"
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      placeholder="Phone (Optional)"
                      className="w-full border border-navy-200 px-2 py-1 text-xs"
                    />
                    <button
                      type="submit"
                      className="w-full bg-[#B8844E] py-1 text-[11px] font-bold text-white"
                    >
                      Start Chat
                    </button>
                  </form>
                )}
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#DBBB97]/40">
                {filteredThreads.map((t) => {
                  const last = t.messages?.[t.messages.length - 1];
                  const active = t.clientId === currentThreadId;
                  return (
                    <div
                      key={t.clientId}
                      className={`flex items-start justify-between gap-1 transition ${
                        active ? 'bg-[#0F2557] text-white' : 'hover:bg-[#DBBB97]/30 text-[#0F2557]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setActiveAdminThreadId(t.clientId);
                          setThread(t);
                          setMobilePane('chat');
                        }}
                        className="flex-1 min-w-0 text-left p-3.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold truncate">{t.clientName || 'Customer'}</span>
                          <span className={`text-[10px] ${active ? 'text-[#F2D5B1]' : 'text-navy-500'}`}>
                            {t.messages?.length || 0}
                          </span>
                        </div>
                        {t.clientPhone && (
                          <p className={`text-[10px] ${active ? 'text-white/75' : 'text-navy-500'}`}>
                            {t.clientPhone}
                          </p>
                        )}
                        {last && (
                          <p className={`text-[11px] truncate mt-1 ${active ? 'text-white/90' : 'text-navy-600'}`}>
                            {last.text || (last.inquiredProduct ? `📦 ${last.inquiredProduct.name}` : '📎 Attachment')}
                          </p>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(t.clientId, t.clientName);
                        }}
                        className={`mt-3 mr-2 p-1.5 rounded transition shrink-0 ${
                          active
                            ? 'text-red-300 hover:bg-red-600 hover:text-white'
                            : 'text-red-600 hover:bg-red-100'
                        }`}
                        title="Delete Entire Conversation & Free Storage"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Chat Stream */}
          <div
            className={`${
              viewRole === 'admin' && mobilePane === 'list' ? 'hidden md:flex' : 'flex'
            } flex-1 flex-col bg-[#F7F4EF] overflow-hidden min-w-0`}
          >
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="mx-auto max-w-md bg-[#0F2557] px-3 py-2 text-center text-[11px] text-[#F2D5B1] border border-[#B8844E]/40">
                <Lock className="inline h-3 w-3 mr-1" />
                Private AXELON Messenger — only you and the store can read it
              </div>

              {(thread?.messages || []).map((msg) => {
                const isMine = viewRole === 'admin' ? msg.sender === 'admin' : msg.sender === 'client';
                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[10px] font-bold text-navy-600">
                        {msg.senderName} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 hover:bg-red-50 px-1.5 py-0.5 rounded transition"
                          title="Delete this message from both Admin & Client"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>

                    <div
                      className={`max-w-[85%] p-3.5 shadow-sm break-words ${
                        isMine
                          ? 'bg-[#0F2557] text-white'
                          : 'bg-white text-[#0F2557] border border-[#DBBB97]/70'
                      }`}
                    >
                      {/* Specific Product Card Attached When Client Clicked "Text Admin" */}
                      {msg.inquiredProduct && (
                        <div
                          className={`mb-3 flex gap-3 p-2.5 border ${
                            isMine
                              ? 'bg-[#060F24] border-[#B8844E]/50 text-white'
                              : 'bg-[#FBF8F4] border-[#DBBB97] text-[#0F2557]'
                          }`}
                        >
                          {msg.inquiredProduct.images?.[0] && (
                            <img
                              src={msg.inquiredProduct.images[0]}
                              alt={msg.inquiredProduct.name}
                              className="h-20 w-16 object-cover shrink-0 border border-white/20"
                            />
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#D4A876]">
                              Product Discussion
                            </p>
                            <p className="text-xs font-bold truncate">{msg.inquiredProduct.name}</p>
                            <p className="text-xs font-extrabold text-[#D4A876]">
                              TK {Number(msg.inquiredProduct.price || 0).toLocaleString()}
                            </p>
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {(msg.inquiredProduct.fields || []).map((f) => (
                                <span
                                  key={f.id || f.label}
                                  className="px-1.5 py-0.5 text-[10px] bg-black/15"
                                >
                                  {f.label}: {f.value}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Media Attachments (Image, Video, Audio, PDF, Any File up to 100MB) */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mb-2.5 space-y-2">
                          {msg.attachments.map((att) => (
                            <div key={att.id} className="border border-white/20 overflow-hidden bg-black/10">
                              {att.category === 'image' && (
                                <a href={att.url} target="_blank" rel="noreferrer">
                                  <img src={att.url} alt={att.originalName} className="max-h-60 w-full object-cover" />
                                </a>
                              )}
                              {att.category === 'video' && (
                                <video controls className="max-h-60 w-full bg-black">
                                  <source src={att.url} type={att.mimeType} />
                                </video>
                              )}
                              {att.category === 'audio' && (
                                <div className="p-2">
                                  <audio controls className="w-full h-9">
                                    <source src={att.url} type={att.mimeType} />
                                  </audio>
                                </div>
                              )}
                              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px]">
                                <span className="truncate flex items-center gap-1">
                                  <FileText className="h-3.5 w-3.5 text-[#D4A876] shrink-0" />
                                  {att.originalName} ({formatBytes(att.size)})
                                </span>
                                <a
                                  href={`${att.url}?download=1`}
                                  download={att.originalName}
                                  className="inline-flex items-center gap-1 font-bold text-[#D4A876] hover:underline shrink-0"
                                >
                                  <Download className="h-3 w-3" /> Save
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.text && <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Staged Product Card from "Text Admin" Button */}
            {inquiredProduct && (
              <div className="border-t border-[#B8844E] bg-[#FBF6F0] px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {inquiredProduct.images?.[0] && (
                    <img
                      src={inquiredProduct.images[0]}
                      alt={inquiredProduct.name}
                      className="h-12 w-10 object-cover border border-[#0F2557]/30 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9A6B3B]">
                      Asking Admin About This Product
                    </p>
                    <p className="text-xs font-bold text-[#0F2557] truncate">
                      {inquiredProduct.name} — TK {Number(inquiredProduct.price || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInquiredProduct(null)}
                  className="p-1 text-navy-500 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Staged Files Ready to Send */}
            {attachments.length > 0 && (
              <div className="border-t border-[#DBBB97] bg-white px-4 py-2 flex flex-wrap gap-2 shrink-0">
                {attachments.map((att) => (
                  <div key={att.id} className="inline-flex items-center gap-1.5 bg-[#0F2557] text-[#F2D5B1] px-2.5 py-1 text-xs">
                    {att.category === 'image' && <ImageIcon className="h-3.5 w-3.5" />}
                    {att.category === 'video' && <Film className="h-3.5 w-3.5" />}
                    {att.category === 'audio' && <Music className="h-3.5 w-3.5" />}
                    {att.category === 'document' && <FileText className="h-3.5 w-3.5" />}
                    <span className="max-w-[140px] truncate">{att.originalName}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== att.id))}
                      className="hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploading && (
              <div className="bg-[#0F2557] px-4 py-1.5 text-xs text-[#F2D5B1] flex justify-between shrink-0">
                <span>Encrypting & Uploading File...</span>
                <span className="font-bold">{uploadProgress}%</span>
              </div>
            )}

            {uploadError && (
              <div className="bg-red-50 px-4 py-1.5 text-xs text-red-700 flex items-center justify-between shrink-0">
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> {uploadError}
                </span>
                <button type="button" onClick={() => setUploadError('')}>✕</button>
              </div>
            )}

            {/* Composer */}
            <form onSubmit={handleSend} className="border-t border-[#DBBB97] bg-white p-3 flex items-center gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => {
                  Array.from(e.target.files || []).forEach(uploadFile);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 border border-[#DBBB97] bg-[#FBF6F0] text-[#0F2557] hover:bg-[#0F2557] hover:text-white transition shrink-0"
                title="Attach Image, Video, Audio, PDF, or Any File (Max 100MB)"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              {!isRecording ? (
                <button
                  type="button"
                  onClick={startVoice}
                  className="p-2.5 border border-[#DBBB97] bg-[#FBF6F0] text-[#0F2557] hover:bg-[#0F2557] hover:text-white transition shrink-0"
                  title="Record Voice Note"
                >
                  <Mic className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopVoice}
                  className="px-3 py-2 bg-red-600 text-white text-xs font-bold flex items-center gap-1 animate-pulse shrink-0"
                >
                  <Square className="h-3 w-3 fill-current" /> {recSeconds}s
                </button>
              )}

              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message or attach up to 100MB file..."
                className="flex-1 min-w-0 border border-[#DBBB97] bg-[#FBF8F4] px-3 py-2 text-xs sm:text-sm text-[#0F2557] focus:border-[#0F2557] focus:bg-white focus:outline-none"
              />

              <button
                type="submit"
                className="inline-flex items-center gap-1.5 bg-[#0F2557] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#F2D5B1] hover:bg-[#060F24] transition shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
