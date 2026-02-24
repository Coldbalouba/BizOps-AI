import React, { useState } from 'react'
import { Bot, Send, Loader2 } from 'lucide-react'
import axios from 'axios'

const API_BASE = '/api'

const QUICK_ACTIONS = [
    'What is total revenue to date?',
    'Top 5 days by revenue',
    'How many orders do we have?',
    'Summarize customer and order trends',
]

/**
 * BIZOPS Assist — AI assistant for business data.
 * Uses the LLM from Configurations (Ollama or OpenAI). POST /api/chat only.
 * For Ollama we never send api_key; for OpenAI we send api_key.
 */
export default function BizOpsAssist({ settings, currentUser }) {
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)

    const provider = (settings?.llm_provider || 'ollama').toLowerCase()
    const model = (settings?.llm_model || 'llama3.2').trim() || 'llama3.2'
    const baseUrl = provider === 'ollama'
        ? ((settings?.api_base_url || '').trim() || 'http://localhost:11434')
        : undefined
    const apiKey = provider !== 'ollama' ? (settings?.api_key || '').trim() || undefined : undefined

    async function sendMessage(text) {
        const q = (text || input || '').trim()
        if (!q) return

        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: q }])
        setLoading(true)

        const body = {
            query: q,
            user_id: currentUser?.id ?? undefined,
            llm_provider: provider,
            llm_model: model,
        }
        if (provider === 'ollama') {
            body.api_base_url = baseUrl
            // do not send api_key for Ollama
        } else {
            body.api_key = apiKey
        }

        try {
            const { data } = await axios.post(`${API_BASE}/chat`, body, {
                headers: { 'Content-Type': 'application/json' },
            })
            const reply = data?.response != null ? String(data.response) : 'No response.'
            setMessages(prev => [...prev, { role: 'assistant', content: reply }])
        } catch (err) {
            const detail = err.response?.data?.detail ?? err.message ?? 'Request failed.'
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${detail}` }])
        } finally {
            setLoading(false)
        }
    }

    function handleSubmit(e) {
        e.preventDefault()
        sendMessage(input)
    }

    return (
        <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px] rounded-3xl border border-slate-700/60 overflow-hidden bg-slate-900/50 shadow-xl">
            <header className="shrink-0 flex items-center gap-4 px-6 py-5 border-b border-slate-700/60 bg-slate-800/40">
                <div className="w-11 h-11 rounded-xl bg-primary-500/25 flex items-center justify-center">
                    <Bot className="text-primary-400" size={24} />
                </div>
                <div>
                    <h1 className="text-lg font-bold text-white">BIZOPS Assist</h1>
                    <p className="text-xs text-slate-400">
                        {model} · {provider}
                    </p>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
                        <p className="text-slate-500 mb-6">Ask questions about your business data. Answers use your configured model.</p>
                        <p className="text-slate-600 text-xs mb-3">Try:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                            {QUICK_ACTIONS.map((q) => (
                                <button
                                    key={q}
                                    type="button"
                                    onClick={() => sendMessage(q)}
                                    className="text-left px-4 py-3 rounded-lg bg-slate-800/80 border border-slate-700/60 text-sm text-slate-300 hover:border-primary-500/50 hover:bg-slate-800 transition-colors"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[88%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                                msg.role === 'user'
                                    ? 'bg-primary-600 text-white rounded-br-sm'
                                    : 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-bl-sm'
                            }`}
                        >
                            {msg.content}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="rounded-xl rounded-bl-sm px-4 py-2.5 bg-slate-800/80 border border-slate-700/50 flex items-center gap-2">
                            <Loader2 size={16} className="animate-spin text-primary-400" />
                            <span className="text-sm text-slate-400">Thinking…</span>
                        </div>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="shrink-0 p-4 border-t border-slate-700/60 bg-slate-800/30">
                <div className="flex gap-2 max-w-3xl mx-auto">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about revenue, orders, customers…"
                        className="flex-1 bg-slate-950 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500/50 text-sm"
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="shrink-0 px-4 py-2.5 rounded-lg bg-primary-600 text-white font-medium text-sm hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                        <Send size={16} />
                        Send
                    </button>
                </div>
            </form>
        </div>
    )
}
