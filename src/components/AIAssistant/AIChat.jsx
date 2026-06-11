import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bot, X, Send, Search, Lightbulb, BarChart2, Shield, Minimize2 } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';

const API_BASE = `${API_BASE_URL}/api`;

function chipStyle(bg, color) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: bg, color, border: `1px solid ${color}33`,
    borderRadius: 999, padding: '4px 10px',
    fontSize: 11, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0, outline: 'none',
  };
}

export default function AIChat({ context, clientSlug, currentItem }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', type: 'text', content: `Hi! I'm your Autonomous SOC Agent. Ask me to search your actual database for hypotheses or IOCs, and I can even execute hunts for you directly.` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const addMsg = (msg) => setMessages(prev => [...prev, msg]);

  const handleAction = async (actionText) => {
    const text = actionText.trim();
    if (!text) return;
    setLoading(true);
    
    const newMsg = { role: 'user', type: 'text', content: text };
    addMsg(newMsg);

    // Build history for the agent, filtering out internal UI types
    const history = [...messages, newMsg].map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.data || m.content)
    }));

    try {
      const res = await fetch(`${API_BASE}/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientSlug,
          messages: history
        }),
      });
      
      if (!res.ok) throw new Error(`Agent error ${res.status}`);
      const data = await res.json();
      
      addMsg({ role: 'assistant', type: 'text', content: data.content });
      
    } catch (e) {
      addMsg({ role: 'assistant', type: 'text', content: `⚠️ ${e.message}` });
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const renderMsg = (msg) => {
    if (msg.type === 'text') {
      return <span style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', display: 'block' }}>{msg.content}</span>;
    }
    return <span style={{ fontSize: 13 }}>{JSON.stringify(msg.content)}</span>;
  };

  const floatingUI = (
    <>
      <style>{`
        @keyframes popIn { from { transform: scale(0.85) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes dot { 0%,80%,100% { transform:translateY(0) } 40% { transform:translateY(-5px) } }
        .ai-chip:hover { filter: brightness(0.93); }
      `}</style>

      {/* Floating button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        title="Autonomous Agent"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 10000,
          width: 52, height: 52, borderRadius: '50%', border: 'none',
          background: isOpen ? '#4f46e5' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
          color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(124,58,237,0.5)',
          transition: 'all 0.2s',
        }}
      >
        {isOpen ? <X size={22} /> : <Bot size={24} />}
      </button>

      {/* Chat widget */}
      {isOpen && (
        <div style={{
          position: 'fixed', bottom: 88, right: 24, zIndex: 9999,
          width: 360, height: 520,
          display: 'flex', flexDirection: 'column',
          background: '#fff', borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          border: '1px solid #e5e7eb',
          animation: 'popIn 0.2s ease-out',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 34, height: 34, background: 'rgba(255,255,255,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={18} color="#fff" />
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>Autonomous Agent</div>
                <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10, letterSpacing: 0.5 }}>CONNECTED TO DATABASE</div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Minimize2 size={14} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 12px 6px', display: 'flex', flexDirection: 'column', gap: 8, background: '#f8fafc' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '88%',
                  background: msg.role === 'user' ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : '#fff',
                  color: msg.role === 'user' ? '#fff' : '#111827',
                  borderRadius: msg.role === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                  padding: '9px 12px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  border: msg.role === 'user' ? 'none' : '1px solid #e5e7eb',
                }}>
                  {renderMsg(msg)}
                </div>
              </div>
            ))}

            {/* Loading dots */}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px 14px 14px 3px', padding: '10px 14px', display: 'flex', gap: 5 }}>
                  {[0, 160, 320].map(d => <div key={d} style={{ width: 7, height: 7, background: '#7c3aed', borderRadius: '50%', animation: `dot 1s ${d}ms infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Action chips (Quick prompts) */}
          <div style={{ background: '#fff', borderTop: '1px solid #f1f5f9', padding: '8px 10px 6px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 6 }}>
              <button className="ai-chip" onClick={() => handleAction('What exfiltration hunts do I have?')} style={chipStyle('#f5f3ff', '#6d28d9')}><Search size={11} /> Find Exfil Hunts</button>
              <button className="ai-chip" onClick={() => handleAction('Show me malicious IOCs')} style={chipStyle('#fffbeb', '#92400e')}><Shield size={11} /> Malicious IOCs</button>
            </div>

            {/* Input */}
            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && input.trim()) handleAction(input.trim()); }}
                placeholder="Ask me to search or run a hunt..."
                style={{
                  flex: 1, fontSize: 13, color: '#111827',
                  padding: '8px 14px', border: '1.5px solid #e5e7eb',
                  borderRadius: 999, outline: 'none', background: '#f9fafb',
                  boxSizing: 'border-box', transition: 'border 0.2s',
                }}
                onFocus={e => e.target.style.border = '1.5px solid #7c3aed'}
                onBlur={e => e.target.style.border = '1.5px solid #e5e7eb'}
              />
              <button
                onClick={() => { if (input.trim()) handleAction(input.trim()); }}
                disabled={!input.trim() || loading}
                style={{
                  width: 36, height: 36, borderRadius: '50%', border: 'none',
                  background: input.trim() && !loading ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : '#e5e7eb',
                  color: input.trim() && !loading ? '#fff' : '#9ca3af',
                  cursor: input.trim() && !loading ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.2s',
                }}
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return createPortal(floatingUI, document.body);
}
