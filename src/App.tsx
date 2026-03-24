import { useState, useEffect, useRef, useCallback } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from "firebase/auth";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, updateDoc, deleteDoc,
  getDocs, writeBatch, Timestamp
} from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { streamChat, generateTitle, ChatMode } from "./services/ai";
import {
  MessageSquare, Plus, Settings, LogOut, Send, Mic,
  Paperclip, Menu, X, Code, BookOpen, Sparkles, Trash2, Copy, Check, Sun, Moon, Eye, EyeOff, ChevronDown, Search,
  ThumbsUp, ThumbsDown, Square, Star, Pencil
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const BOT_AVATAR = "https://i.pinimg.com/736x/e5/d1/84/e5d184c936d66f547437f84c1b20c833.jpg";

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

const SUGGESTIONS: Record<ChatMode, string[]> = {
  "ka-storya": ["Kumusta man ka ron, Turagsoy?", "Unsay nindot buhaton karong weekend?", "Hatagi kog travel tips para sa Japan.", "Unsa may trending karon?"],
  coding: ["Himoig React hook para sa local storage.", "Unsaon pag-fix sa useEffect infinite loop?", "Explain ang Closure sa JavaScript.", "Himoig Python script para sa web scraping."],
  tutor: ["Unsa nang quantum computing?", "Tabangi kog study sa biology.", "Explain ang Pythagorean theorem.", "Unsaon pag-solve: 2x + 5 = 15?"],
};

interface Chat {
  id: string; title: string; userId: string;
  createdAt: Timestamp; mode: ChatMode; lastMessageAt: Timestamp;
}
interface Message {
  id: string; chatId: string; userId: string;
  role: "user" | "model"; content: string;
  imageUrl?: string; createdAt: Timestamp;
}

function LoginPage({ dark, onGoogle, loginError, setLoginError }: {
  dark: boolean; onGoogle: () => void;
  loginError: string | null; setLoginError: (e: string | null) => void;
}) {
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const bg = dark ? "bg-[#050505]" : "bg-zinc-50";
  const bgModal = dark ? "bg-zinc-900 border-white/10" : "bg-white border-zinc-200";
  const text = dark ? "text-white" : "text-zinc-900";
  const textMuted = dark ? "text-zinc-400" : "text-zinc-500";
  const inputCls = cn("w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all",
    dark ? "bg-white/5 border-white/10 text-white placeholder-zinc-500 focus:border-indigo-500" : "bg-zinc-100 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-indigo-400");

  const handleForgotPassword = async () => {
    if (!email) { setLoginError("Enter your email first."); return; }
    setLoginError(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      setLoginError(err.code === "auth/user-not-found" ? "No account found with this email." : err.message);
    } finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoading(true);
    try {
      if (tab === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (name) await updateProfile(cred.user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      const msg: Record<string, string> = {
        "auth/email-already-in-use": "Email already registered.",
        "auth/invalid-email": "Invalid email address.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/invalid-credential": "Incorrect email or password.",
      };
      setLoginError(msg[err.code] || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className={cn("min-h-screen flex items-center justify-center p-4 relative overflow-hidden", bg)}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/20 blur-[120px] rounded-full animate-pulse" />
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className={cn("relative z-10 w-full max-w-md backdrop-blur-2xl rounded-3xl p-8 shadow-2xl border", bgModal)}>
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-indigo-500/30 mb-4 shrink-0">
            <img src={BOT_AVATAR} className="w-full h-full object-cover" alt="Turagsoy" />
          </div>
          <h1 className={cn("text-2xl font-bold", text)}>Turagsoy AI</h1>
          <p className={cn("text-sm mt-1", textMuted)}>Ang pinakabag-ong AI nga Bisaya kaayo.</p>
        </div>

        {/* Tabs */}
        <div className={cn("flex rounded-xl p-1 mb-6 border", dark ? "bg-white/5 border-white/10" : "bg-zinc-100 border-zinc-200")}>
          {(["login", "signup"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setLoginError(null); }}
              className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                tab === t ? "bg-indigo-600 text-white shadow" : textMuted)}>
              {t === "login" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {tab === "signup" && (
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Full name" className={inputCls} />
          )}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email address" required className={inputCls} />
          <div className="relative">
            <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" required className={cn(inputCls, "pr-12")} />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className={cn("absolute right-3 top-1/2 -translate-y-1/2", textMuted)}>
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {tab === "login" && (
            <div className="flex justify-end">
              <button type="button" onClick={handleForgotPassword}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                Forgot password?
              </button>
            </div>
          )}
          {resetSent && <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs">Password reset email sent! Check your inbox.</div>}
          {loginError && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{loginError}</div>}
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
            {tab === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className={cn("flex-1 h-px", dark ? "bg-white/10" : "bg-zinc-200")} />
          <span className={cn("text-xs", textMuted)}>or</span>
          <div className={cn("flex-1 h-px", dark ? "bg-white/10" : "bg-zinc-200")} />
        </div>

        <button onClick={onGoogle} className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-zinc-100 transition-all flex items-center justify-center gap-3 border border-zinc-200">
          <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
          Continue with Google
        </button>
      </motion.div>
    </div>
  );
}

function WelcomeScreen({ mode, onSelect, dark }: { mode: ChatMode; onSelect: (s: string) => void; dark: boolean }) {
  const illustrations: Record<ChatMode, React.ReactNode> = {
    "ka-storya": (
      <svg viewBox="0 0 120 120" className="w-32 h-32 mx-auto" fill="none">
        <circle cx="60" cy="60" r="56" fill={dark ? "#1e1b4b" : "#eef2ff"} />
        {/* Face */}
        <circle cx="60" cy="52" r="22" fill={dark ? "#4f46e5" : "#6366f1"} />
        <circle cx="52" cy="48" r="3" fill="white" />
        <circle cx="68" cy="48" r="3" fill="white" />
        <path d="M52 58 Q60 66 68 58" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* Speech bubbles */}
        <rect x="14" y="28" width="24" height="14" rx="7" fill={dark ? "#6366f1" : "#818cf8"} />
        <polygon points="28,42 22,48 34,42" fill={dark ? "#6366f1" : "#818cf8"} />
        <rect x="82" y="36" width="24" height="14" rx="7" fill={dark ? "#4ade80" : "#86efac"} />
        <polygon points="88,50 82,50 90,56" fill={dark ? "#4ade80" : "#86efac"} />
        {/* Dots in bubbles */}
        <circle cx="22" cy="35" r="2" fill="white" /><circle cx="26" cy="35" r="2" fill="white" /><circle cx="30" cy="35" r="2" fill="white" />
        <circle cx="90" cy="43" r="2" fill="white" /><circle cx="94" cy="43" r="2" fill="white" /><circle cx="98" cy="43" r="2" fill="white" />
        {/* Stars */}
        <text x="10" y="90" fontSize="14">⭐</text>
        <text x="90" y="20" fontSize="12">✨</text>
        <text x="95" y="95" fontSize="10">🌟</text>
      </svg>
    ),
    coding: (
      <svg viewBox="0 0 120 120" className="w-32 h-32 mx-auto" fill="none">
        <circle cx="60" cy="60" r="56" fill={dark ? "#052e16" : "#f0fdf4"} />
        {/* Monitor */}
        <rect x="22" y="30" width="76" height="50" rx="6" fill={dark ? "#166534" : "#4ade80"} />
        <rect x="26" y="34" width="68" height="42" rx="4" fill={dark ? "#0a0a0a" : "#1e1e1e"} />
        {/* Code lines */}
        <rect x="32" y="42" width="20" height="3" rx="1.5" fill="#6366f1" />
        <rect x="56" y="42" width="30" height="3" rx="1.5" fill="#4ade80" />
        <rect x="36" y="50" width="14" height="3" rx="1.5" fill="#f59e0b" />
        <rect x="54" y="50" width="22" height="3" rx="1.5" fill="#818cf8" />
        <rect x="32" y="58" width="36" height="3" rx="1.5" fill="#4ade80" />
        <rect x="36" y="66" width="18" height="3" rx="1.5" fill="#f472b6" />
        {/* Stand */}
        <rect x="54" y="80" width="12" height="8" rx="2" fill={dark ? "#166534" : "#4ade80"} />
        <rect x="44" y="88" width="32" height="4" rx="2" fill={dark ? "#166534" : "#4ade80"} />
        {/* Cursor blink */}
        <rect x="72" y="58" width="2" height="10" rx="1" fill="#6366f1" opacity="0.8" />
      </svg>
    ),
    tutor: (
      <svg viewBox="0 0 120 120" className="w-32 h-32 mx-auto" fill="none">
        <circle cx="60" cy="60" r="56" fill={dark ? "#451a03" : "#fffbeb"} />
        {/* Book */}
        <rect x="28" y="38" width="64" height="50" rx="4" fill={dark ? "#92400e" : "#fbbf24"} />
        <rect x="28" y="38" width="32" height="50" rx="4" fill={dark ? "#78350f" : "#f59e0b"} />
        <line x1="60" y1="38" x2="60" y2="88" stroke={dark ? "#451a03" : "#d97706"} strokeWidth="2" />
        {/* Lines on pages */}
        <rect x="34" y="50" width="20" height="2.5" rx="1.25" fill={dark ? "#fbbf24" : "#fff"} opacity="0.7" />
        <rect x="34" y="57" width="16" height="2.5" rx="1.25" fill={dark ? "#fbbf24" : "#fff"} opacity="0.7" />
        <rect x="34" y="64" width="20" height="2.5" rx="1.25" fill={dark ? "#fbbf24" : "#fff"} opacity="0.7" />
        <rect x="66" y="50" width="20" height="2.5" rx="1.25" fill={dark ? "#fbbf24" : "#fff"} opacity="0.7" />
        <rect x="66" y="57" width="14" height="2.5" rx="1.25" fill={dark ? "#fbbf24" : "#fff"} opacity="0.7" />
        <rect x="66" y="64" width="18" height="2.5" rx="1.25" fill={dark ? "#fbbf24" : "#fff"} opacity="0.7" />
        {/* Graduation cap */}
        <ellipse cx="60" cy="30" rx="18" ry="5" fill={dark ? "#f59e0b" : "#d97706"} />
        <rect x="56" y="25" width="8" height="8" rx="1" fill={dark ? "#f59e0b" : "#d97706"} />
        <line x1="78" y1="30" x2="78" y2="38" stroke={dark ? "#f59e0b" : "#d97706"} strokeWidth="2" />
        <circle cx="78" cy="40" r="3" fill={dark ? "#fbbf24" : "#f59e0b"} />
      </svg>
    ),
  };

  return (
    <div className="h-full flex flex-col items-center justify-center text-center max-w-xs sm:max-w-xl mx-auto py-10 space-y-5 sm:space-y-6 px-4">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 15 }}>
        {illustrations[mode]}
      </motion.div>
      <div>
        <h2 className={cn("text-xl sm:text-2xl font-bold mb-2 whitespace-nowrap", dark ? "text-white" : "text-zinc-900")}>Kumusta! Ako si Turagsoy 👋</h2>
        <p className={dark ? "text-zinc-400" : "text-zinc-500"}>Unsay gusto nimong hisgutan karon?</p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full px-2 sm:px-0 sm:max-w-xl sm:gap-3 mx-auto">
        {SUGGESTIONS[mode].map((s, i) => (
          <button key={i} onClick={() => onSelect(s)}
            className={cn("p-3 rounded-xl border text-xs text-left transition-all leading-snug",
              dark ? "bg-white/5 border-white/10 hover:bg-white/10 text-zinc-300" : "bg-zinc-100 border-zinc-200 hover:bg-zinc-200 text-zinc-700")}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [pendingMsg, setPendingMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("ka-storya");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [guestMessages, setGuestMessages] = useState<Record<string, Message[]>>({});
  const [dark, setDark] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [reactions, setReactions] = useState<Record<string, "up" | "down">>({});
  const [starred, setStarred] = useState<Map<string, Message>>(new Map());
  const [showStarred, setShowStarred] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pendingScrollId = useRef<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [tappedId, setTappedId] = useState<string | null>(null);
  const abortRef = useRef(false);

  const messagesRef = useRef<Message[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const streamingContentRef = useRef("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const streamIdRef = useRef<string | null>(null);
  const typingSoundRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const check = () => setSidebarOpen(window.innerWidth > 768);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setIsAuthReady(true), 5000);
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      clearTimeout(timeout);
    });
    return () => { unsub(); clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    if (!user || user.uid === "guest-user") return;
    const q = query(collection(db, "chats"), where("userId", "==", user.uid), where("mode", "==", mode), orderBy("lastMessageAt", "desc"));
    return onSnapshot(q, (snap) => setChats(snap.docs.map(d => ({ id: d.id, ...d.data() } as Chat))));
  }, [user, mode]);

  useEffect(() => {
    if (!currentChatId || !user) { setMessages([]); return; }
    if (user.uid === "guest-user") { setMessages(guestMessages[currentChatId] || []); return; }
    const q = query(collection(db, "chats", currentChatId, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      if (!streamIdRef.current) setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    });
  }, [currentChatId, user, guestMessages]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, pendingMsg, streamingContent]);

  // After messages load, scroll to pending starred message
  useEffect(() => {
    if (!pendingScrollId.current || messages.length === 0) return;
    const id = pendingScrollId.current;
    pendingScrollId.current = null;
    setTimeout(() => {
      const el = messageRefs.current[id];
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(id);
      setTimeout(() => setHighlightedId(null), 2000);
    }, 300);
  }, [messages]);

  // Scroll-to-bottom button visibility
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 100);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Typing sound — soft click using Web Audio API
  const playTypingSound = useCallback(() => {
    try {
      if (!typingSoundRef.current) typingSoundRef.current = new AudioContext();
      const ctx = typingSoundRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 600 + Math.random() * 200;
      gain.gain.setValueAtTime(0.008, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.start(); osc.stop(ctx.currentTime + 0.04);
    } catch {}
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleLogin = async () => {
    setLoginError(null);
    try { await signInWithPopup(auth, googleProvider); }
    catch (e: any) { setLoginError(e.message || "Login failed."); }
  };

  const handleGuestMode = () => {
    setUser({ uid: "guest-user", displayName: "Guest", email: "guest@Turagsoy.ai", photoURL: "https://api.dicebear.com/7.x/avataaars/svg?seed=guest" } as any);
    setIsAuthReady(true);
  };

  const createNewChat = async (firstMsg?: string) => {
    if (!user) return null;
    if (user.uid === "guest-user") {
      const id = "guest-" + Date.now();
      const chat: Chat = { id, title: "Bag-ong Chat", userId: user.uid, createdAt: Timestamp.now(), mode, lastMessageAt: Timestamp.now() };
      setChats(p => [chat, ...p]);
      setCurrentChatId(id);
      if (window.innerWidth <= 768) setSidebarOpen(false);
      if (firstMsg) generateTitle(firstMsg).then(t => setChats(p => p.map(c => c.id === id ? { ...c, title: t } : c)));
      return id;
    }
    const ref = await addDoc(collection(db, "chats"), { title: "Bag-ong Chat", userId: user.uid, createdAt: serverTimestamp(), mode, lastMessageAt: serverTimestamp() });
    setCurrentChatId(ref.id);
    if (window.innerWidth <= 768) setSidebarOpen(false);
    if (firstMsg) generateTitle(firstMsg).then(t => updateDoc(doc(db, "chats", ref.id), { title: t }));
    return ref.id;
  };

  const handleSend = async (e?: React.FormEvent, overrideMsg?: string) => {
    e?.preventDefault();
    const msg = overrideMsg ?? input.trim();
    if ((!msg && !selectedImage) || isStreaming || !user) return;
    const img = selectedImage, imgPrev = imagePreview;
    if (!overrideMsg) { setInput(""); setSelectedImage(null); setImagePreview(null); }
    abortRef.current = false;
    try {
      let chatId = currentChatId || await createNewChat(msg);
      if (!chatId) return;
      if (user.uid === "guest-user") {
        const userMsg: Message = { id: "gu-" + Date.now(), chatId, userId: user.uid, role: "user", content: msg, imageUrl: imgPrev || undefined, createdAt: Timestamp.now() };
        setGuestMessages(p => ({ ...p, [chatId!]: [...(p[chatId!] || []), userMsg] }));
        setMessages(p => [...p, userMsg]);
        const history = (guestMessages[chatId!] || []).map(m => ({ role: m.role, parts: [{ text: m.content }] }));
        setIsStreaming(true); setStreamingContent("");
        let full = "";
        for await (const chunk of streamChat(mode, history, msg, img || undefined)) {
          if (abortRef.current) break;
          for (const char of chunk) {
            if (abortRef.current) break;
            full += char;
            setStreamingContent(full);
            await new Promise(r => setTimeout(r, 8));
          }
        }
        const aiMsg: Message = { id: "ga-" + Date.now(), chatId, userId: user.uid, role: "model", content: full, createdAt: Timestamp.now() };
        setGuestMessages(p => ({ ...p, [chatId!]: [...(p[chatId!] || []), aiMsg] }));
        setMessages(p => [...p, aiMsg]);
        setIsStreaming(false); setStreamingContent("");
        return;
      }
      if (!overrideMsg) {
        const msgData: any = { chatId, userId: user.uid, role: "user", content: msg, createdAt: serverTimestamp() };
        if (imgPrev) msgData.imageUrl = imgPrev;
        await addDoc(collection(db, `chats/${chatId}/messages`), msgData);
        await updateDoc(doc(db, "chats", chatId), { lastMessageAt: serverTimestamp() });
      }
      setIsStreaming(true); setStreamingContent(""); streamingContentRef.current = "";
      let full = "";
      streamIdRef.current = "streaming";
      for await (const chunk of streamChat(mode, messagesRef.current.map(m => ({ role: m.role, parts: [{ text: m.content }] })), msg, img || undefined)) {
        if (abortRef.current) break;
        for (const char of chunk) {
          if (abortRef.current) break;
          full += char;
          streamingContentRef.current = full;
          setStreamingContent(full);
          playTypingSound();
          await new Promise(r => setTimeout(r, 8));
        }
      }
      setIsStreaming(false); setStreamingContent(""); streamingContentRef.current = "";
      if (full) {
        await addDoc(collection(db, `chats/${chatId}/messages`), { chatId, userId: user.uid, role: "model", content: full, createdAt: serverTimestamp() });
      }
      streamIdRef.current = null;
    } catch (err: any) {
      console.error("Chat error:", err);
      setIsStreaming(false); setStreamingContent(""); if (!overrideMsg) setInput(msg);
    } finally {
      setPendingMsg(null);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleStop = () => { abortRef.current = true; };

  const handleEditSend = async (msgId: string) => {
    if (!editText.trim() || isStreaming) return;
    // Update the message content locally and in Firestore
    setMessages(p => p.map(m => m.id === msgId ? { ...m, content: editText } : m));
    if (user && user.uid !== "guest-user" && currentChatId) {
      await updateDoc(doc(db, `chats/${currentChatId}/messages`, msgId), { content: editText });
    }
    setEditingId(null);
    setEditText("");
  };

  const scrollToMessage = (msg: Message) => {
    // Find which chat this message belongs to and its mode
    const targetChat = chats.find(c => c.id === msg.chatId);
    const isSameChat = currentChatId === msg.chatId;

    if (!isSameChat) {
      // Switch to the right mode + chat first, then scroll after load
      if (targetChat) setMode(targetChat.mode);
      pendingScrollId.current = msg.id;
      setCurrentChatId(msg.chatId);
      if (window.innerWidth <= 768) setSidebarOpen(false);
      return;
    }

    // Already in the right chat — scroll immediately
    const el = messageRefs.current[msg.id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(msg.id);
    setTimeout(() => setHighlightedId(null), 2000);
    if (window.innerWidth <= 768) setSidebarOpen(false);
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };





  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      setImagePreview(b64);
      setSelectedImage({ data: b64.split(",")[1], mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleVoice = () => {
    if (!("webkitSpeechRecognition" in window)) { alert("Speech not supported."); return; }
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }
    const r = new (window as any).webkitSpeechRecognition();
    r.lang = "en-US"; r.onstart = () => setIsRecording(true);
    r.onresult = (ev: any) => { setInput(ev.results[0][0].transcript); setIsRecording(false); };
    r.onerror = r.onend = () => setIsRecording(false);
    recognitionRef.current = r; r.start();
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text); setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteChat = async (id: string) => {
    if (user?.uid === "guest-user") { setChats(p => p.filter(c => c.id !== id)); }
    else { await deleteDoc(doc(db, "chats", id)); }
    if (currentChatId === id) { setCurrentChatId(null); setIsStreaming(false); setStreamingContent(""); setPendingMsg(null); }
    setDeleteId(null);
  };

  const clearAll = async () => {
    if (!user) return;
    if (user.uid === "guest-user") { setGuestMessages({}); setChats([]); }
    else {
      const snap = await getDocs(query(collection(db, "chats"), where("userId", "==", user.uid)));
      const batch = writeBatch(db); snap.forEach(d => batch.delete(d.ref)); await batch.commit();
    }
    setCurrentChatId(null); setIsStreaming(false); setStreamingContent(""); setPendingMsg(null); setShowSettings(false);
  };

  const resetChat = () => { setCurrentChatId(null); setInput(""); setIsStreaming(false); setStreamingContent(""); setPendingMsg(null); };

  // theme helpers
  const bg = dark ? "bg-[#050505]" : "bg-zinc-50";
  const bgSidebar = dark ? "bg-[#0a0a0a]" : "bg-white";
  const bgHeader = dark ? "bg-[#050505]/80" : "bg-white/80";
  const border = dark ? "border-white/5" : "border-zinc-200";
  const text = dark ? "text-white" : "text-zinc-900";
  const textMuted = dark ? "text-zinc-400" : "text-zinc-500";
  const bgInput = dark ? "bg-white/5 border-white/10" : "bg-zinc-100 border-zinc-300";
  const bgHover = dark ? "hover:bg-white/5" : "hover:bg-zinc-100";
  const bgCard = dark ? "bg-white/5 border-white/10" : "bg-white border-zinc-200";
  const bgModal = dark ? "bg-zinc-900 border-white/10" : "bg-white border-zinc-200";

  if (!isAuthReady) return <div style={{backgroundColor: '#050505'}} className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (!user) {
    return <LoginPage dark={dark} onGoogle={handleLogin} loginError={loginError} setLoginError={setLoginError} />;
  }

  return (
    <div className={cn("flex h-[100dvh] overflow-hidden font-sans transition-colors duration-200", bg, text)}>
      {/* Delete modal */}
      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className={cn("rounded-2xl p-6 max-w-sm w-full text-center border", bgModal)}>
              <p className={cn("font-semibold mb-2", text)}>Delete this chat?</p>
              <p className={cn("text-sm mb-6", textMuted)}>Dili na ma-undo ni.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className={cn("flex-1 py-2 rounded-xl transition-colors", dark ? "bg-white/5 hover:bg-white/10" : "bg-zinc-100 hover:bg-zinc-200")}>Cancel</button>
                <button onClick={() => deleteChat(deleteId)} className="flex-1 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className={cn("rounded-2xl p-6 max-w-sm w-full border", bgModal)}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={cn("font-semibold text-lg", text)}>Settings</h2>
                <button onClick={() => setShowSettings(false)} className={cn("p-2 rounded-lg", bgHover)}><X className="w-4 h-4" /></button>
              </div>
              <button onClick={clearAll} className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors text-sm font-medium">
                Clear All Chat History
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar backdrop mobile */}
      <AnimatePresence>
        {sidebarOpen && window.innerWidth <= 768 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/60 z-[45]" />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside initial={{ x: -300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={cn("w-72 border-r flex flex-col z-50 h-full fixed inset-y-0 left-0", bgSidebar, border)}>
            <div className="p-4 flex items-center gap-2">
              <button onClick={resetChat}
                className={cn("flex-1 flex items-center gap-3 p-3 rounded-2xl border transition-all", bgInput, bgHover)}>
                <Plus className="w-5 h-5 text-indigo-400" />
                <span className="font-medium text-sm">Bag-ong Chat</span>
              </button>
              <button onClick={() => setSidebarOpen(false)} className={cn("p-3 rounded-2xl", bgHover)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 space-y-1">
              {/* Search */}
              <div className="px-1 pb-2">
                <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl border", bgInput)}>
                  <Search className={cn("w-3.5 h-3.5 shrink-0", textMuted)} />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search chats..."
                    className={cn("flex-1 bg-transparent text-xs outline-none", text, "placeholder-zinc-500")} />
                  {searchQuery && <button onClick={() => setSearchQuery("")}><X className="w-3 h-3 text-zinc-500" /></button>}
                </div>
              </div>
              {/* Starred tab toggle */}
              <div className="px-1 pb-1">
                <button onClick={() => setShowStarred(v => !v)}
                  className={cn("w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all",
                    showStarred ? "bg-amber-500/20 text-amber-400" : cn(textMuted, bgHover))}>
                  <Star className="w-3.5 h-3.5" />
                  Starred Messages {starred.size > 0 && <span className="ml-auto bg-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded-full text-[10px]">{starred.size}</span>}
                </button>
              </div>
              {/* Starred panel or chat list */}
              {showStarred ? (
                <div className="space-y-1 px-1">
                  {starred.size === 0 ? (
                    <p className={cn("text-xs text-center py-6", textMuted)}>Wala pay starred messages.</p>
                  ) : [...starred.values()].map(m => (
                    <div key={m.id} className={cn("p-3 rounded-xl border text-xs leading-relaxed cursor-pointer transition-all", dark ? "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10" : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100")}
                      onClick={() => scrollToMessage(m)}>
                      <p className="line-clamp-3">{m.content}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-indigo-400 text-[10px]">Tap to jump ↗</span>
                        <button onClick={e => { e.stopPropagation(); setStarred(s => { const n = new Map(s); n.delete(m.id); return n; }); }}
                          className="text-amber-400 text-[10px]">Unstar</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>{chats.filter(c => !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())).map(chat => (
                <div key={chat.id} className="group relative">
                  <button onClick={() => { setCurrentChatId(chat.id); setIsStreaming(false); setStreamingContent(""); setPendingMsg(null); if (window.innerWidth <= 768) setSidebarOpen(false); }}
                    className={cn("w-full text-left p-3 rounded-xl transition-all flex items-center gap-3",
                      currentChatId === chat.id ? (dark ? "bg-white/10 text-white" : "bg-indigo-50 text-indigo-700") : cn(textMuted, bgHover))}>
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span className="truncate text-sm">{chat.title}</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteId(chat.id); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}</>
              )}
            </div>
            <div className={cn("p-4 border-t", border)}>
              <div className={cn("flex items-center gap-3 p-3 rounded-2xl", bgCard, "border")}>
                <img src={user.photoURL || ""} className="w-9 h-9 rounded-xl object-cover" alt="Profile" />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium truncate", text)}>{user.displayName}</p>
                  <p className={cn("text-xs truncate", textMuted)}>{user.email}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setShowSettings(true)} className={cn("p-2 rounded-lg", textMuted, bgHover)}><Settings className="w-4 h-4" /></button>
                  <button onClick={() => signOut(auth)} className={cn("p-2 hover:text-red-400 transition-colors", textMuted)}><LogOut className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className={cn("flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative transition-all duration-300", sidebarOpen ? "md:ml-72" : "ml-0")}>
        <header className={cn("h-14 border-b backdrop-blur-xl flex items-center justify-between px-3 z-40 shrink-0", bgHeader, border)}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className={cn("p-2 rounded-xl", bgHover)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className={cn("hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border", bgInput)}>
              {mode === "ka-storya" && <img src="https://www.svgrepo.com/show/69095/talk.svg" className="w-4 h-4" style={{filter: "invert(42%) sepia(93%) saturate(1352%) hue-rotate(196deg) brightness(119%) contrast(119%)"}} alt="Ka-Storya" />}
              {mode === "coding" && <Code className="w-4 h-4 text-emerald-400" />}
              {mode === "tutor" && <BookOpen className="w-4 h-4 text-amber-400" />}
              <span className="text-xs font-semibold uppercase tracking-wider">
                {mode === "ka-storya" ? "Ka-Storya" : mode} Mode
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("flex items-center gap-1 p-1 rounded-xl border", bgInput)}>
              {(["ka-storya", "coding", "tutor"] as ChatMode[]).map(m => (
                <button key={m} onClick={() => { setMode(m); resetChat(); }}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                    mode === m ? "bg-indigo-600 text-white shadow-lg" : cn(textMuted, bgHover))}>
                  {m === "ka-storya" ? "Ka-Storya" : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
            {/* Theme toggle — always visible in header */}
            <button onClick={() => setDark(!dark)} className={cn("p-2 rounded-xl", bgHover, textMuted)}>
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-4 pb-6 space-y-8 relative" onClick={() => setTappedId(null)}>
          {messages.length === 0 && !isStreaming && !pendingMsg && (
            <WelcomeScreen mode={mode} onSelect={(s) => { setInput(s); textareaRef.current?.focus(); }} dark={dark} />
          )}
          {messages.map(msg => (
            <div key={msg.id} ref={el => { messageRefs.current[msg.id] = el; }}
              className={cn("flex gap-3 group mb-6 transition-all duration-300", msg.role === "user" ? "justify-end" : "justify-start",
                highlightedId === msg.id ? "scale-[1.01]" : "")}>
              {msg.role === "model" && (
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-1">
                  <img src={BOT_AVATAR} className="w-full h-full object-cover" alt="Turagsoy" />
                </div>
              )}
              <div className={cn("max-w-[80%] rounded-2xl px-4 py-3 relative transition-all duration-300",
                msg.role === "user" ? "bg-indigo-600 text-white rounded-tr-sm" : cn("rounded-tl-sm border", dark ? "bg-white/5 border-white/10" : "bg-white border-zinc-200 text-zinc-800"),
                highlightedId === msg.id ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent" : "")}
                onClick={e => { e.stopPropagation(); if (window.innerWidth <= 768) setTappedId(t => t === msg.id ? null : msg.id); }}>
                {msg.imageUrl && <img src={msg.imageUrl} className="rounded-xl mb-2 max-w-[160px] sm:max-w-xs" alt="attachment" />}
                {msg.role === "model" ? (
                  <div className={cn("prose prose-sm max-w-none", dark ? "prose-invert" : "")}>
                    <ReactMarkdown components={{
                      code({ node, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || "");
                        const codeStr = String(children).replace(/\n$/, "");
                        const codeId = msg.id + codeStr.slice(0, 20);
                        return !match ? (
                          <code className={cn("px-1 py-0.5 rounded text-xs", dark ? "bg-white/10" : "bg-zinc-100")} {...props}>{children}</code>
                        ) : (
                          <div className="relative group/code">
                            <div className={cn("flex items-center justify-between px-3 py-1.5 rounded-t-lg text-xs", dark ? "bg-zinc-700" : "bg-zinc-200")}>
                              <span className={textMuted}>{match[1]}</span>
                              <button onClick={() => copyCode(codeStr, codeId)}
                                className={cn("flex items-center gap-1 transition-colors", copiedCodeId === codeId ? "text-green-400" : textMuted)}>
                                {copiedCodeId === codeId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                <span>{copiedCodeId === codeId ? "Copied!" : "Copy"}</span>
                              </button>
                            </div>
                            <SyntaxHighlighter style={dark ? atomDark : oneLight} language={match[1]} PreTag="div"
                              customStyle={{ margin: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                              {codeStr}
                            </SyntaxHighlighter>
                          </div>
                        );
                      }
                    }}>{msg.content}</ReactMarkdown>
                  </div>
                ) : editingId === msg.id ? (
                  <div className="space-y-2">
                    <textarea value={editText} onChange={e => setEditText(e.target.value)}
                      autoFocus
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSend(msg.id); } if (e.key === "Escape") { setEditingId(null); } }}
                      className="w-full bg-white/10 text-white text-sm rounded-lg p-2 outline-none resize-none min-h-[60px]" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingId(null)} className="text-xs text-zinc-400 hover:text-white transition-colors">Cancel</button>
                      <button onClick={() => handleEditSend(msg.id)} className="text-xs bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1 rounded-lg transition-colors">Save</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
                {/* Action buttons row */}
                <div className={cn("absolute -bottom-2 flex items-center gap-1 transition-all",
                  "opacity-0 sm:group-hover:opacity-100",
                  tappedId === msg.id ? "opacity-100" : "",
                  msg.role === "user" ? "right-2" : "left-2")}>
                  <button onClick={() => copyText(msg.content, msg.id)}
                    className={cn("p-1.5 rounded-lg transition-all", dark ? "bg-zinc-800" : "bg-zinc-100 border border-zinc-200")}>
                    {copiedId === msg.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className={cn("w-3 h-3", textMuted)} />}
                  </button>
                  {msg.role === "user" && (
                    <button onClick={() => { setEditingId(msg.id); setEditText(msg.content); }}
                      className={cn("p-1.5 rounded-lg transition-all", dark ? "bg-zinc-800" : "bg-zinc-100 border border-zinc-200", textMuted)}>
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  {msg.role === "model" && (
                    <>
                      <button onClick={() => setStarred(s => { const n = new Map(s); n.has(msg.id) ? n.delete(msg.id) : n.set(msg.id, msg); return n; })}
                        className={cn("p-1.5 rounded-lg transition-all", dark ? "bg-zinc-800" : "bg-zinc-100 border border-zinc-200", starred.has(msg.id) ? "text-amber-400" : textMuted)}>
                        <Star className="w-3 h-3" />
                      </button>
                      <button onClick={() => setReactions(r => ({ ...r, [msg.id]: r[msg.id] === "up" ? undefined as any : "up" }))}
                        className={cn("p-1.5 rounded-lg transition-all", dark ? "bg-zinc-800" : "bg-zinc-100 border border-zinc-200", reactions[msg.id] === "up" ? "text-green-400" : textMuted)}>
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => setReactions(r => ({ ...r, [msg.id]: r[msg.id] === "down" ? undefined as any : "down" }))}
                        className={cn("p-1.5 rounded-lg transition-all", dark ? "bg-zinc-800" : "bg-zinc-100 border border-zinc-200", reactions[msg.id] === "down" ? "text-red-400" : textMuted)}>
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
                {/* Timestamp on hover */}
                {msg.createdAt && (
                  <div className={cn("absolute -bottom-5 transition-all text-[10px] whitespace-nowrap",
                    "opacity-0 sm:group-hover:opacity-100",
                    tappedId === msg.id ? "opacity-100" : "",
                    textMuted, msg.role === "user" ? "right-0" : "left-0")}>
                    {msg.createdAt.toDate?.().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-1">
                  <img src={user.photoURL || ""} className="w-full h-full object-cover" alt="You" />
                </div>
              )}
            </div>
          ))}
          {pendingMsg && (
            <div className="flex gap-3 justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 bg-indigo-600 text-white">
                <p className="text-sm whitespace-pre-wrap">{pendingMsg}</p>
              </div>
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-1">
                <img src={user.photoURL || ""} className="w-full h-full object-cover" alt="You" />
              </div>
            </div>
          )}
          {isStreaming && streamingContent && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-1">
                <img src={BOT_AVATAR} className="w-full h-full object-cover" alt="Turagsoy" />
              </div>
              <div className={cn("max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-3 border", dark ? "bg-white/5 border-white/10" : "bg-white border-zinc-200")}>
                <div className={cn("prose prose-sm max-w-none", dark ? "prose-invert" : "")}>
                  <ReactMarkdown>{streamingContent}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
          {isStreaming && !streamingContent && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                <img src={BOT_AVATAR} className="w-full h-full object-cover" alt="Turagsoy" />
              </div>
              <div className={cn("px-4 py-3 rounded-2xl rounded-tl-sm border flex gap-1 items-center", dark ? "bg-white/5 border-white/10" : "bg-white border-zinc-200")}>
                {[0, 1, 2].map(i => (
                  <div key={i} className={cn("w-2 h-2 rounded-full animate-bounce", dark ? "bg-zinc-400" : "bg-zinc-400")} style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Scroll to bottom button */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="fixed bottom-28 right-4 z-30 p-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-colors">
              <ChevronDown className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Input */}
        <div className={cn("shrink-0 px-3 sm:px-4 pb-4 pt-3 flex justify-center", dark ? "bg-[#050505]" : "bg-zinc-50")}>
          <div className="w-full max-w-2xl mx-auto">
            {imagePreview && (
              <div className="mb-2 relative inline-block">
                <img src={imagePreview} className="h-16 rounded-xl border border-white/10" alt="preview" />
                <button onClick={() => { setImagePreview(null); setSelectedImage(null); }}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            <form onSubmit={handleSend} className={cn("flex items-center gap-2 border rounded-2xl p-2", bgInput)}>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className={cn("p-2 rounded-xl transition-colors shrink-0", textMuted, bgHover)}>
                <Paperclip className="w-5 h-5" />
              </button>
              <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Isulat ang imong mensahe..."
                rows={1} className={cn("flex-1 bg-transparent resize-none outline-none text-sm max-h-32 py-2 placeholder-zinc-500", text)} />
              <button type="button" onClick={handleVoice}
                className={cn("p-2 rounded-xl transition-colors shrink-0", isRecording ? "bg-red-500/20 text-red-400" : cn(textMuted, bgHover))}>
                <Mic className="w-5 h-5" />
              </button>
              {isStreaming ? (
                <button type="button" onClick={handleStop}
                  className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors shrink-0">
                  <Square className="w-4 h-4" />
                </button>
              ) : (
                <button type="submit" disabled={!input.trim() && !selectedImage}
                  className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
                  <Send className="w-4 h-4 text-white" />
                </button>
              )}
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
