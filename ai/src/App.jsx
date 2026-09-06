import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Menu, 
  Plus, 
  MessageSquare, 
  Check, 
  Copy, 
  Sparkles,
  Github
} from 'lucide-react';

// --- API Helpers ---
const fetchWithBackoff = async (url, options, retries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delays[i]));
    }
  }
};

const copyToClipboard = (text) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {
    console.error('Failed to copy', err);
  }
  document.body.removeChild(textArea);
};

// --- Subcomponents ---

const CodeBlock = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-lg bg-[#0d1117] overflow-hidden border border-slate-700/50 shadow-md">
      <div className="flex justify-between items-center px-4 py-2 bg-slate-800 text-xs text-slate-300 font-sans">
        <span className="uppercase font-semibold tracking-wider text-slate-400">{language || 'code'}</span>
        <button 
          onClick={handleCopy} 
          className="flex items-center gap-1.5 hover:text-white transition-colors py-1 px-2 rounded-md hover:bg-slate-700"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy code'}</span>
        </button>
      </div>
      <div className="overflow-x-auto p-4 text-sm font-mono text-slate-50 leading-relaxed">
        <pre><code>{code}</code></pre>
      </div>
    </div>
  );
};

const MessageText = ({ text }) => {
  // A lightweight markdown parser for code blocks and bold text
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="text-slate-200 leading-7">
      {parts.map((part, index) => {
        // Code blocks
        if (part.startsWith('```') && part.endsWith('```')) {
          const match = part.match(/```([\w-]*)\n([\s\S]*?)```/);
          const language = match?.[1] || '';
          const code = match?.[2] || part.slice(3, -3).trim();
          return <CodeBlock key={index} language={language} code={code} />;
        }

        // Standard text with bolding and paragraphs
        const paragraphs = part.split('\n\n');
        return paragraphs.map((p, pIdx) => {
          if (!p.trim()) return null;
          return (
            <p key={`${index}-${pIdx}`} className="mb-4 last:mb-0">
              {p.split(/(\*\*.*?\*\*)/g).map((s, i) => {
                if (s.startsWith('**') && s.endsWith('**')) {
                  return <strong key={i} className="font-bold text-white">{s.slice(2, -2)}</strong>;
                }
                // Handle inline code formatting dynamically
                return s.split(/(`.*?`)/g).map((inline, j) => {
                    if (inline.startsWith('`') && inline.endsWith('`')) {
                        return <code key={j} className="bg-slate-700/50 text-emerald-300 px-1.5 py-0.5 rounded font-mono text-sm">{inline.slice(1,-1)}</code>;
                    }
                    return <span key={j}>{inline}</span>;
                });
              })}
            </p>
          );
        });
      })}
    </div>
  );
};

// --- 3D Background Component ---
const Background3D = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    
    // Settings
    const particles = [];
    const particleCount = 150;
    
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Resize handler
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', handleResize);

    // Particle Class
    class Particle {
      constructor() {
        this.x = (Math.random() - 0.5) * width * 2;
        this.y = (Math.random() - 0.5) * height * 2;
        this.z = Math.random() * 1000; // Depth for 3D effect
        this.vx = (Math.random() - 0.5) * 0.8;
        this.vy = (Math.random() - 0.5) * 0.8;
        this.vz = (Math.random() - 0.5) * 2; // Moving forwards/backwards
        // Emerald to Cyan color range
        this.color = `hsla(${150 + Math.random() * 50}, 100%, 60%, ${Math.random() * 0.8 + 0.2})`; 
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;
        this.z += this.vz;

        // Reset if out of bounds to create a continuous infinite flow
        if (this.z < 1) this.z = 1000;
        if (this.z > 1000) this.z = 1;
        if (this.x < -width) this.x = width;
        if (this.x > width) this.x = -width;
        if (this.y < -height) this.y = height;
        if (this.y > height) this.y = -height;
      }

      draw() {
        // 3D Projection calculation
        const fov = 350;
        const scale = fov / (fov + this.z);
        const x2d = this.x * scale + width / 2;
        const y2d = this.y * scale + height / 2;
        
        // Scale size based on depth
        const radius = Math.max(0.1, 2.5 * scale);

        ctx.beginPath();
        ctx.arc(x2d, y2d, radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        
        return { x: x2d, y: y2d, scale };
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const render = () => {
      // Clear with dark fading trail for motion blur effect
      ctx.fillStyle = 'rgba(2, 6, 23, 0.3)'; // Deep tailwind slate-950
      ctx.fillRect(0, 0, width, height);

      const projectedPoints = [];

      particles.forEach(p => {
        p.update();
        projectedPoints.push(p.draw());
      });

      // Draw connecting neural lines
      ctx.lineWidth = 0.5;
      for (let i = 0; i < projectedPoints.length; i++) {
        for (let j = i + 1; j < projectedPoints.length; j++) {
          const p1 = projectedPoints[i];
          const p2 = projectedPoints[j];
          
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Connect nearby nodes
          if (dist < 120) {
            // Opacity scales with distance and 3D depth
            const opacity = (1 - dist / 120) * p1.scale * p2.scale * 1.5;
            ctx.strokeStyle = `rgba(52, 211, 113, ${opacity})`; // Emerald line
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 z-0 pointer-events-none"
      style={{ background: 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)' }}
    />
  );
};

// --- Main Application ---

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Auto-resize textarea
  const handleInput = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setInput('');
    setIsSidebarOpen(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const apiKey = ""; // Injected by environment
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      // Build history payload for contextual memory
      const contents = newMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const payload = {
        contents,
        systemInstruction: {
          parts: [{ text: "You are phantomsAI, a highly capable, helpful, and friendly AI assistant. Answer accurately and format your responses clearly using markdown when helpful (especially for code)." }]
        }
      };

      const result = await fetchWithBackoff(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const botText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (botText) {
        setMessages(prev => [...prev, { role: 'model', content: botText }]);
      } else {
        throw new Error("No text found in response");
      }
    } catch (error) {
      console.error("AI Generation Error:", error);
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: "I'm sorry, I encountered an error while trying to process your request. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen text-slate-50 font-sans selection:bg-emerald-500/30 overflow-hidden relative bg-slate-950">
      
      {/* 3D Animated Background */}
      <Background3D />

      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Upgraded to Glassmorphism */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-30 w-[260px] bg-slate-900/60 backdrop-blur-xl flex flex-col transition-transform duration-300 ease-in-out border-r border-white/10 shadow-2xl
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-3">
          <button 
            onClick={startNewChat}
            className="flex items-center gap-3 w-full p-3 rounded-lg border border-white/10 bg-slate-800/40 hover:bg-slate-700/60 hover:border-emerald-500/50 transition-all group text-sm font-medium shadow-sm"
          >
            <Plus size={18} className="text-emerald-400 group-hover:scale-110 transition-transform drop-shadow-[0_0_5px_rgba(52,211,113,0.8)]" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="text-xs font-semibold text-slate-400 mb-3 px-3 uppercase tracking-wider">Recent</div>
          {messages.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500 italic">No recent chats</div>
          ) : (
            <button className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-slate-700/50 transition-colors text-sm text-slate-200 text-left border border-transparent hover:border-white/5">
              <MessageSquare size={16} className="text-emerald-500/70" />
              <span className="truncate flex-1 drop-shadow-sm">{messages[0].content}</span>
            </button>
          )}
        </div>

        <div className="p-5 border-t border-white/10 flex items-center gap-3 text-sm bg-black/20">
           <Bot className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,113,0.8)]" />
           <span className="font-bold tracking-wide bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">phantomsAI</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative z-10">
        
        {/* Prominent Header (Desktop & Mobile) */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/40 backdrop-blur-md sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="text-slate-300 hover:text-white md:hidden"
            >
              <Menu size={24} />
            </button>
            <span className="font-extrabold text-2xl tracking-wide bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2 drop-shadow-lg">
              <Sparkles size={24} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,113,0.8)]" /> 
              phantomsAI
            </span>
          </div>
          <div className="text-xs font-mono font-semibold text-emerald-400/80 hidden md:flex items-center gap-2 border border-emerald-500/30 px-3 py-1.5 rounded-full bg-emerald-500/10 backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            System Online
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto px-4 mt-[-5vh]">
              <div className="w-28 h-28 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full flex items-center justify-center mb-8 shadow-[0_0_60px_rgba(16,185,129,0.25)] backdrop-blur-xl border border-white/10 relative">
                <div className="absolute inset-0 rounded-full border-t border-emerald-400/50 animate-spin" style={{ animationDuration: '3s' }} />
                <Sparkles size={50} className="text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,113,0.9)]" />
              </div>
              
              <h1 className="text-4xl md:text-6xl font-black mb-6 text-white tracking-tight drop-shadow-2xl leading-tight">
                Welcome to <br className="md:hidden" />
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(52,211,113,0.4)]">phantomsAI</span>
              </h1>
              
              <p className="text-slate-300 mb-12 max-w-lg mx-auto text-lg drop-shadow-md font-medium leading-relaxed">
                I'm phantomsAI, a highly advanced assistant. Ask me to write code, explain concepts, or brainstorm ideas. No login required.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-xl">
                {[
                  "Explain quantum computing in simple terms",
                  "Write a Python script to scrape a website",
                  "Give me 5 creative ideas for a 10-year-old's birthday",
                  "How do I center a div using Tailwind CSS?"
                ].map((suggestion, i) => (
                  <button 
                    key={i}
                    onClick={() => {
                      setInput(suggestion);
                      textareaRef.current?.focus();
                    }}
                    className="p-4 rounded-xl border border-white/10 bg-slate-900/50 backdrop-blur-md hover:bg-slate-800/80 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all text-sm text-slate-200 text-left group flex items-start gap-3"
                  >
                    <span className="text-emerald-400 group-hover:text-cyan-400 transition-colors mt-0.5">✦</span>
                    <span className="leading-relaxed">{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto w-full pb-32">
              {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`py-6 flex gap-4 md:gap-6 px-4 md:px-6 rounded-3xl mb-4 backdrop-blur-sm transition-all ${
                    msg.role === 'model' ? 'bg-slate-900/70 border border-white/10 shadow-lg' : 'bg-transparent border border-transparent'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-md ${
                    msg.role === 'user' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' : 'bg-gradient-to-br from-emerald-400 to-cyan-500 text-white shadow-[0_0_10px_rgba(52,211,113,0.5)]'
                  }`}>
                    {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-300 mb-1.5 tracking-wide text-sm drop-shadow-sm flex items-center gap-2">
                      {msg.role === 'user' ? 'You' : (
                        <>
                          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">phantomsAI</span>
                        </>
                      )}
                    </div>
                    {msg.role === 'user' ? (
                      <div className="text-slate-100 whitespace-pre-wrap leading-relaxed font-medium">
                        {msg.content}
                      </div>
                    ) : (
                      <MessageText text={msg.content} />
                    )}
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="py-6 flex gap-4 md:gap-6 px-4 md:px-6 rounded-3xl mb-4 bg-slate-900/70 border border-white/10 shadow-lg backdrop-blur-sm">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 text-white flex items-center justify-center shrink-0 mt-1 shadow-[0_0_10px_rgba(52,211,113,0.5)]">
                    <Bot size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-300 mb-2 tracking-wide text-sm drop-shadow-sm">
                      <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">phantomsAI</span>
                    </div>
                    <div className="flex gap-1.5 items-center mt-2 h-6">
                      <div className="w-2 h-2 rounded-full bg-emerald-400/80 animate-bounce shadow-[0_0_5px_rgba(52,211,113,0.8)]" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-cyan-400/80 animate-bounce shadow-[0_0_5px_rgba(6,182,212,0.8)]" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-emerald-400/80 animate-bounce shadow-[0_0_5px_rgba(52,211,113,0.8)]" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent p-4 md:p-6 pb-6 pt-12">
          <div className="max-w-4xl mx-auto w-full relative">
            <div className="relative flex items-end bg-slate-900/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500/50 focus-within:border-emerald-400/70 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Message phantomsAI..."
                className="w-full max-h-[200px] bg-transparent text-slate-100 placeholder-slate-400 p-4 pr-14 focus:outline-none resize-none overflow-y-auto leading-relaxed font-medium"
                rows="1"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-3 bottom-3 p-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white transition-all shadow-lg hover:shadow-[0_0_15px_rgba(52,211,113,0.4)] disabled:shadow-none"
              >
                <Send size={18} className={input.trim() && !isLoading ? 'ml-0.5' : ''} />
              </button>
            </div>
            <div className="text-center mt-3 text-xs text-slate-400 drop-shadow-md font-medium tracking-wide">
              phantomsAI can make mistakes. Consider verifying important information.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
