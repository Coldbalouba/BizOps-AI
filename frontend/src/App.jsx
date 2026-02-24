import React, { useState, useEffect } from 'react'
import { LayoutDashboard, MessageSquare, AlertTriangle, TrendingUp, Users, Settings, Upload, User, LogOut, ShieldCheck, Mail, Lock } from 'lucide-react'
import { LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import axios from 'axios'
import BizOpsAssist from './components/BizOpsAssist'

const API_BASE = '/api'

const SETTINGS_STORAGE_KEY = 'bizops_settings'

function loadStoredSettings() {
    try {
        const s = localStorage.getItem(SETTINGS_STORAGE_KEY)
        if (s) {
            const parsed = JSON.parse(s)
            return {
                llm_provider: parsed.llm_provider ?? 'ollama',
                llm_model: parsed.llm_model ?? 'llama3.2',
                api_key: parsed.api_key ?? '',
                api_base_url: parsed.api_base_url ?? 'http://localhost:11434'
            }
        }
    } catch (_) {}
    return null
}

function saveStoredSettings(settings) {
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
            llm_provider: settings.llm_provider,
            llm_model: settings.llm_model,
            api_key: settings.api_key ?? '',
            api_base_url: settings.api_base_url ?? 'http://localhost:11434'
        }))
    } catch (_) {}
}

function App() {
    const [activeTab, setActiveTab] = useState('dashboard')
    const [metrics, setMetrics] = useState([])
    const [anomalies, setAnomalies] = useState([])
    const [stats, setStats] = useState({ total_revenue: 0, total_orders: 0, active_customers: 0 })

    // Auth & Profile
    const [currentUser, setCurrentUser] = useState(null)
    const [showAuthModal, setShowAuthModal] = useState(false)
    const [authMode, setAuthMode] = useState('login')
    const [authForm, setAuthForm] = useState({ username: '', password: '', full_name: '' })

    // Settings — default to Ollama so BIZOPS Assist works without an API key
    const [settings, setSettings] = useState({
        llm_provider: 'ollama',
        llm_model: 'llama3.2',
        api_key: '',
        api_base_url: 'http://localhost:11434'
    })
    const [availableModels, setAvailableModels] = useState([])
    const [isLoadingModels, setIsLoadingModels] = useState(false)
    const [modelSearch, setModelSearch] = useState('')
    const [connectionStatus, setConnectionStatus] = useState('idle') // idle, checking, success, error

    const predefinedModels = {
        openai: [
            { id: 'gpt-4o', label: 'GPT-4o', desc: 'Most powerful, versatile cloud model', tier: 'premium' },
            { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Fast, efficient for simple tasks', tier: 'balanced' },
            { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', desc: 'Previous flagship performance', tier: 'premium' },
            { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', desc: 'Legacy fast model', tier: 'legacy' }
        ],
        anthropic: [
            { id: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet', desc: 'Unbeatable reasoning & coding', tier: 'premium' },
            { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus', desc: 'Deep creative intelligence', tier: 'premium' },
            { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', desc: 'Near-instant responses', tier: 'balanced' }
        ],
        ollama: []
    }

    useEffect(() => {
        fetchData()
        const savedUser = localStorage.getItem('bizops_user')
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser)
                setCurrentUser(user)
                fetchSettings(user.id)
            } catch (_) {}
        } else {
            const stored = loadStoredSettings()
            if (stored) setSettings(stored)
        }
    }, [])

    useEffect(() => {
        if (settings.llm_provider === 'ollama') {
            fetchOllamaModels()
        } else {
            setAvailableModels(predefinedModels[settings.llm_provider] || [])
        }
    }, [settings.llm_provider, settings.api_base_url])

    const fetchOllamaModels = async (baseUrlOverride) => {
        setIsLoadingModels(true)
        setConnectionStatus('checking')
        const baseUrl = baseUrlOverride ?? settings.api_base_url?.trim() ?? 'http://localhost:11434'
        try {
            const res = await axios.get(`${API_BASE}/ollama/models`, {
                params: { base_url: baseUrl }
            })
            const list = Array.isArray(res.data) ? res.data : []
            const formatted = list.map(m => ({
                id: typeof m === 'string' ? m : (m?.name ?? m?.model ?? String(m)),
                label: typeof m === 'string' ? m : (m?.name ?? m?.model ?? String(m)),
                desc: 'Local model running on your system',
                tier: 'local'
            }))
            setAvailableModels(formatted)
            setConnectionStatus(list.length > 0 ? 'success' : 'error')
        } catch (err) {
            console.error("Error fetching Ollama models:", err)
            setAvailableModels([])
            setConnectionStatus('error')
        } finally {
            setIsLoadingModels(false)
        }
    }

    const fetchData = async () => {
        try {
            const [mRes, aRes, sRes] = await Promise.all([
                axios.get(`${API_BASE}/metrics`),
                axios.get(`${API_BASE}/anomalies`),
                axios.get(`${API_BASE}/stats`)
            ])
            setMetrics(mRes.data)
            setAnomalies(aRes.data)
            setStats(sRes.data)
        } catch (err) {
            console.error("Error fetching data:", err)
        }
    }

    const fetchSettings = async (userId) => {
        try {
            const res = await axios.get(`${API_BASE}/settings/${userId}`)
            const data = res.data
            const next = {
                llm_provider: data.llm_provider ?? 'ollama',
                llm_model: data.llm_model ?? 'llama3.2',
                api_key: data.api_key ?? '',
                api_base_url: data.api_base_url ?? 'http://localhost:11434'
            }
            setSettings(next)
            saveStoredSettings(next)
        } catch (err) {
            console.error("Error fetching settings:", err)
        }
    }

    const handleAuth = async (e) => {
        e.preventDefault()
        try {
            const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register'
            const res = await axios.post(`${API_BASE}${endpoint}`, null, { params: authForm })
            setCurrentUser(res.data)
            localStorage.setItem('bizops_user', JSON.stringify(res.data))
            setShowAuthModal(false)
            if (authMode === 'login') fetchSettings(res.data.id)
        } catch (err) {
            alert(err.response?.data?.detail || "Auth failed")
        }
    }

    const handleFileUpload = async (event) => {
        const file = event.target.files[0]
        if (!file) return

        const formData = new FormData()
        formData.append('file', file)

        try {
            const res = await axios.post(`${API_BASE}/upload`, formData)
            alert(res.data.message)
            fetchData()
        } catch (err) {
            alert("Upload failed")
        }
    }

    const saveSettings = async () => {
        const payload = {
            llm_provider: settings.llm_provider,
            llm_model: settings.llm_model,
            api_key: settings.api_key ?? '',
            api_base_url: settings.llm_provider === 'ollama' ? (settings.api_base_url?.trim() || 'http://localhost:11434') : (settings.api_base_url || null)
        }
        saveStoredSettings(payload)
        if (currentUser) {
            try {
                await axios.post(`${API_BASE}/settings/${currentUser.id}`, payload)
                alert("Settings saved successfully!")
                await fetchSettings(currentUser.id)
                if (payload.llm_provider === 'ollama') {
                    fetchOllamaModels(payload.api_base_url)
                }
            } catch (err) {
                alert(err.response?.data?.detail || "Failed to save settings")
            }
        } else {
            alert("Settings saved for this session. Sign in to persist across server restarts.")
            if (payload.llm_provider === 'ollama') fetchOllamaModels(payload.api_base_url)
        }
    }

    return (
        <div className="flex h-screen bg-slate-950 text-slate-100 font-sans">
            {/* Sidebar */}
            <aside className="w-72 border-r border-slate-800/50 flex flex-col glass z-10 backdrop-blur-2xl">
                <div className="p-8">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center font-bold shadow-lg shadow-primary-500/20">B</div>
                        <h1 className="text-2xl font-black bg-gradient-to-r from-primary-400 via-purple-400 to-pink-400 bg-clip-text text-transparent tracking-tight">
                            BizOps AI
                        </h1>
                    </div>
                </div>

                <nav className="flex-1 px-5 space-y-3">
                    {[
                        { id: 'dashboard', icon: LayoutDashboard, label: 'Insights Center' },
                        { id: 'assist', icon: MessageSquare, label: 'BIZOPS Assist' },
                        { id: 'anomalies', icon: AlertTriangle, label: 'Risk Monitor' },
                        { id: 'settings', icon: Settings, label: 'Configurations' },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center space-x-4 px-5 py-4 rounded-2xl transition-all duration-300 group ${activeTab === item.id
                                ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-inner'
                                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                                }`}
                        >
                            <item.icon size={22} className={activeTab === item.id ? 'stroke-[2.5px]' : 'group-hover:scale-110 transition-transform'} />
                            <span className="font-bold tracking-tight">{item.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="p-6">
                    {currentUser ? (
                        <div className="bg-slate-900/40 border border-slate-800/50 p-4 rounded-3xl backdrop-blur-xl">
                            <div className="flex items-center space-x-4 mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-slate-700 flex items-center justify-center text-lg font-bold">
                                    {currentUser?.username?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white truncate">{currentUser?.full_name || 'User'}</p>
                                    <p className="text-[10px] text-primary-400 font-black uppercase tracking-widest">Enterprise Tier</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { localStorage.removeItem('bizops_user'); setCurrentUser(null); }}
                                className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl bg-slate-950/50 text-slate-400 text-sm font-bold hover:bg-red-500/10 hover:text-red-400 transition-all border border-slate-800/50"
                            >
                                <LogOut size={16} />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowAuthModal(true)}
                            className="w-full py-4 rounded-2xl bg-primary-600 text-white font-bold shadow-lg shadow-primary-500/20 hover:bg-primary-500 transition-all active:scale-95 flex items-center justify-center space-x-2"
                        >
                            <User size={20} />
                            <span>Connect Account</span>
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-slate-950 relative">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary-500/5 blur-[120px] rounded-full -mr-48 -mt-48"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 blur-[120px] rounded-full -ml-48 -mb-48"></div>

                <div className="p-12 max-w-7xl mx-auto relative z-10">
                    <header className="flex justify-between items-start mb-12">
                        <div>
                            <div className="flex items-center space-x-2 text-primary-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">
                                <ShieldCheck size={14} />
                                <span>Verified Environment</span>
                            </div>
                            <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-3">
                                {activeTab === 'dashboard' ? 'Operational Hub' :
                                    activeTab === 'assist' ? 'BIZOPS Assist' :
                                        activeTab === 'settings' ? 'System Controls' : 'Threat Intelligence'}
                            </h2>
                            <p className="text-slate-500 font-medium">Autonomously monitoring multi-dimensional business performance.</p>
                        </div>

                        <div className="flex items-center space-x-4">
                            <label className="flex items-center space-x-3 bg-slate-900 border border-slate-800 px-6 py-3.5 rounded-2xl cursor-pointer hover:bg-slate-800 transition-all shadow-xl group">
                                <Upload size={18} className="text-primary-400 group-hover:bounce" />
                                <span className="text-sm font-bold text-slate-300">Ingest New Dataset</span>
                                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.csv,.xlsx,.xls" />
                            </label>
                            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer">
                                <TrendingUp size={20} />
                            </div>
                        </div>
                    </header>

                    {activeTab === 'dashboard' && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {[
                                    { label: 'Revenue Vector', value: `$${(stats.total_revenue || 0).toLocaleString()}`, trend: '+12.5%', icon: TrendingUp, color: 'emerald' },
                                    { label: 'Order Velocity', value: (stats.total_orders || 0).toLocaleString(), trend: '+4.2%', icon: LayoutDashboard, color: 'amber' },
                                    { label: 'Retention Map', value: (stats.active_customers || 0).toLocaleString(), trend: '+8.1%', icon: Users, color: 'blue' },
                                ].map((kpi, idx) => (
                                    <div key={idx} className="glass p-8 rounded-[32px] border border-slate-800/50 hover:border-slate-700/50 transition-all duration-500 group relative overflow-hidden">
                                        <div className={`absolute -right-8 -top-8 w-32 h-32 blur-3xl rounded-full group-hover:scale-125 transition-transform duration-700 ${kpi.color === 'emerald' ? 'bg-emerald-500/10' : kpi.color === 'amber' ? 'bg-amber-500/10' : 'bg-blue-500/10'}`}></div>
                                        <div className="flex items-center justify-between mb-6">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${kpi.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' : kpi.color === 'amber' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                                <kpi.icon size={24} />
                                            </div>
                                            <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400">{kpi.trend}</span>
                                        </div>
                                        <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mb-1">{kpi.label}</p>
                                        <h3 className="text-3xl font-black text-white">{kpi.value}</h3>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                                <div className="lg:col-span-2 glass p-10 rounded-[40px] border border-slate-800/50 h-[500px] shadow-2xl">
                                    <div className="flex items-center justify-between mb-10">
                                        <h4 className="text-xl font-black">Performance Trajectory</h4>
                                        <div className="flex space-x-2">
                                            {['7D', '30D', '90D', 'ALL'].map(t => (
                                                <button key={t} className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${t === '30D' ? 'bg-primary-600 text-white shadow-lg' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}>{t}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="h-[350px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={metrics}>
                                                <defs>
                                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                                                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                                <XAxis dataKey="date" stroke="#475569" fontSize={11} tickFormatter={(str) => str.split('-')[2]} axisLine={false} tickLine={false} dy={10} />
                                                <YAxis stroke="#475569" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                                                <Tooltip
                                                    cursor={{ stroke: '#0ea5e9', strokeWidth: 2 }}
                                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(51, 65, 85, 0.5)', borderRadius: '20px', backdropFilter: 'blur(10px)', padding: '15px' }}
                                                    itemStyle={{ color: 'white', fontWeight: 'bold' }}
                                                />
                                                <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorRev)" strokeWidth={4} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="glass p-10 rounded-[40px] border border-slate-800/50 flex flex-col shadow-2xl overflow-hidden relative">
                                    <div className="flex items-center justify-between mb-8 z-10">
                                        <h4 className="text-xl font-black">Live Threats</h4>
                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                                    </div>
                                    <div className="flex-1 space-y-5 overflow-y-auto pr-2 custom-scrollbar z-10">
                                        {anomalies.slice(0, 6).map((anomaly, idx) => (
                                            <div key={idx} className="p-5 rounded-3xl bg-slate-900/40 border border-slate-800/50 group hover:border-slate-700/50 transition-all hover:bg-slate-900/60 cursor-pointer">
                                                <div className="flex items-start space-x-4">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${anomaly.severity === 'high' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                                        <AlertTriangle size={20} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-white leading-snug group-hover:text-primary-400 transition-colors">{anomaly.description}</p>
                                                        <div className="flex items-center space-x-3 mt-3">
                                                            <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">{anomaly.metric_date}</span>
                                                            <span className={`text-[9px] px-2 py-0.5 rounded-lg border font-black uppercase tracking-widest ${anomaly.severity === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                                }`}>{anomaly.severity}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {anomalies.length === 0 && <p className="text-center text-slate-500 py-12 italic text-sm">Clear operational horizon.</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'assist' && (
                        <BizOpsAssist settings={settings} currentUser={currentUser} />
                    )}

                    {activeTab === 'settings' && (
                        <div className="glass rounded-[48px] p-12 animate-in fade-in slide-in-from-bottom-8 duration-700 border border-slate-800/50 shadow-2xl max-w-5xl mx-auto mb-20">
                            <div className="flex items-center justify-between mb-12">
                                <div>
                                    <h3 className="text-3xl font-black tracking-tight text-white mb-2">System Configuration</h3>
                                    <p className="text-slate-500 font-medium">Fine-tune the cognitive architecture and neural links.</p>
                                </div>
                                {settings.llm_provider === 'ollama' && (
                                    <div className={`px-4 py-2 rounded-2xl border flex items-center space-x-2 text-xs font-bold uppercase tracking-widest ${connectionStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                            connectionStatus === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                'bg-slate-900 text-slate-500 border-slate-800'
                                        }`}>
                                        <div className={`w-2 h-2 rounded-full ${connectionStatus === 'success' ? 'bg-emerald-500 animate-pulse' :
                                                connectionStatus === 'error' ? 'bg-red-500' : 'bg-slate-600'
                                            }`} />
                                        <span>Local Node: {connectionStatus === 'success' ? 'Synchronized' : connectionStatus === 'error' ? 'Offline' : 'Idle'}</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                                {/* Left Side: Provider & Connection */}
                                <div className="lg:col-span-4 space-y-10">
                                    <div className="space-y-6">
                                        <label className="text-xs font-black uppercase tracking-widest text-primary-400">LLM Provider Interaction</label>
                                        <div className="space-y-3">
                                            {['openai', 'ollama', 'anthropic'].map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => setSettings({ ...settings, llm_provider: p })}
                                                    className={`w-full py-5 rounded-3xl border-2 transition-all font-bold text-lg flex items-center px-6 space-x-4 ${settings.llm_provider === p
                                                        ? 'bg-primary-600/10 border-primary-600 text-white ring-4 ring-primary-500/5 shadow-lg'
                                                        : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                                                        }`}
                                                >
                                                    <div className={`w-3 h-3 rounded-full ${settings.llm_provider === p ? 'bg-primary-500' : 'bg-slate-700'}`} />
                                                    <span>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <label className="text-xs font-black uppercase tracking-widest text-slate-500">Node Entry Point</label>
                                        {settings.llm_provider === 'ollama' ? (
                                            <div className="space-y-3">
                                                <input
                                                    type="text"
                                                    value={settings.api_base_url}
                                                    onChange={(e) => setSettings({ ...settings, api_base_url: e.target.value })}
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-6 py-4 font-bold text-white focus:outline-none focus:border-primary-500 transition-all text-sm"
                                                    placeholder="http://localhost:11434"
                                                />
                                                <button
                                                    onClick={fetchOllamaModels}
                                                    className="w-full py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-white hover:bg-slate-900 transition-all flex items-center justify-center space-x-2"
                                                >
                                                    <Loader2 size={12} className={isLoadingModels ? 'animate-spin' : ''} />
                                                    <span>Recalibrate Connection</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="relative">
                                                    <Lock className="absolute left-5 top-4.5 text-slate-600" size={16} />
                                                    <input
                                                        type="password"
                                                        value={settings.api_key}
                                                        onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                                                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-4 pl-14 pr-6 font-bold text-white focus:outline-none focus:border-primary-500 transition-all text-sm"
                                                        placeholder="sk-••••••••••••••••"
                                                    />
                                                </div>
                                                <p className="text-[10px] text-slate-600 font-medium px-2">API keys are stored securely in your private workspace.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Side: Model Selection */}
                                <div className="lg:col-span-8 space-y-8">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <label className="text-xs font-black uppercase tracking-widest text-primary-400 flex items-center space-x-2">
                                            <ShieldCheck size={14} />
                                            <span>Cognitive Engine Selection</span>
                                        </label>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                value={modelSearch}
                                                onChange={(e) => setModelSearch(e.target.value)}
                                                placeholder="Search models..."
                                                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs font-bold text-slate-300 focus:outline-none focus:border-primary-500 transition-all w-full sm:w-64 pl-10"
                                            />
                                            <TrendingUp className="absolute left-4 top-2.5 text-slate-600 group-focus-within:text-primary-400 transition-colors" size={14} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                                        {availableModels.filter(m => m.id.toLowerCase().includes(modelSearch.toLowerCase())).length > 0 ? (
                                            availableModels.filter(m => m.id.toLowerCase().includes(modelSearch.toLowerCase())).map(m => (
                                                <button
                                                    key={m.id}
                                                    onClick={() => setSettings({ ...settings, llm_model: m.id })}
                                                    className={`p-6 rounded-[24px] border-2 transition-all text-left relative group overflow-hidden ${settings.llm_model === m.id
                                                        ? 'bg-primary-500/10 border-primary-500 shadow-xl shadow-primary-500/5'
                                                        : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.tier === 'premium' ? 'bg-purple-500/10 text-purple-400' : m.tier === 'local' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary-500/10 text-primary-400'}`}>
                                                            {m.tier === 'local' ? <Users size={20} /> : <ShieldCheck size={20} />}
                                                        </div>
                                                        {settings.llm_model === m.id && (
                                                            <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                                                                <div className="w-2 h-2 bg-white rounded-full" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <h5 className="font-black text-white mb-1 group-hover:text-primary-400 transition-colors">{m.label}</h5>
                                                    <p className="text-[11px] text-slate-500 font-bold group-hover:text-slate-400 transition-colors leading-relaxed">{m.desc}</p>
                                                    {m.tier === 'premium' && (
                                                        <div className="absolute top-0 right-0 p-2">
                                                            <span className="text-[8px] font-black uppercase tracking-tighter bg-purple-500 text-white px-2 py-0.5 rounded-lg shadow-lg">Cloud Flagship</span>
                                                        </div>
                                                    )}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="col-span-full p-12 bg-slate-900/30 border border-dashed border-slate-800 rounded-[32px] text-center">
                                                <p className="text-slate-500 font-bold mb-4">No compatible neural architectures found.</p>
                                                {settings.llm_provider === 'ollama' && (
                                                    <>
                                                        {connectionStatus === 'error' && (
                                                            <p className="text-amber-500/90 text-sm mb-4">Ensure Ollama is running and the base URL is correct, then click below.</p>
                                                        )}
                                                        {settings.llm_model && (
                                                            <p className="text-slate-400 text-sm mb-4">Current selection: <span className="text-white font-bold">{settings.llm_model}</span></p>
                                                        )}
                                                        <button
                                                            onClick={() => fetchOllamaModels()}
                                                            className="px-6 py-2 bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
                                                        >
                                                            Attempt Rescan
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6">
                                        <div className="flex items-center space-x-4">
                                            <button
                                                onClick={saveSettings}
                                                className="px-10 py-5 rounded-3xl bg-primary-600 text-white font-black text-lg shadow-2xl shadow-primary-500/30 hover:bg-primary-500 transition-all active:scale-95 flex items-center space-x-3"
                                            >
                                                <ShieldCheck size={20} />
                                                <span>Deploy Configurations</span>
                                            </button>
                                            <button className="px-8 py-5 rounded-3xl bg-slate-900 text-slate-500 font-bold border border-slate-800 hover:bg-slate-800 transition-all hover:text-slate-300">
                                                Purge Cache
                                            </button>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1">Target Identity</p>
                                            <p className="text-xs text-slate-400 font-bold">{currentUser?.username || 'SYSTEM_ADMIN_01'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'anomalies' && (
                        <div className="glass rounded-[48px] p-12 animate-in slide-in-from-bottom duration-700 border border-slate-800/50 shadow-22xl">
                            <div className="mb-12 flex items-center justify-between">
                                <h3 className="text-3xl font-black tracking-tight">Threat Analysis Feed</h3>
                                <div className="flex space-x-3">
                                    <button className="px-6 py-3 bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg shadow-red-500/20">Purge Alerts</button>
                                    <button className="px-6 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all">Export Log</button>
                                </div>
                            </div>
                            <div className="space-y-6">
                                {anomalies.map((anomaly, idx) => (
                                    <div key={idx} className="p-8 bg-slate-900/30 border border-slate-800 rounded-[32px] flex items-center justify-between group hover:border-primary-500/30 transition-all hover:bg-slate-900/50">
                                        <div className="flex items-center space-x-8">
                                            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center text-2xl shadow-xl ${anomaly.severity === 'high' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                                                }`}>
                                                <AlertTriangle size={32} />
                                            </div>
                                            <div>
                                                <p className="font-black text-xl text-white mb-2">{anomaly.description}</p>
                                                <div className="flex items-center space-x-6 text-slate-500 text-xs font-bold uppercase tracking-widest">
                                                    <span className="flex items-center space-x-2"><LayoutDashboard size={14} /> <span>{anomaly.metric_date}</span></span>
                                                    <span className="flex items-center space-x-2 text-indigo-400"><TrendingUp size={14} /> <span>E: {anomaly.expected_value}</span></span>
                                                    <span className="flex items-center space-x-2 text-white"><ShieldCheck size={14} /> <span>A: {anomaly.actual_value}</span></span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-6">
                                            <span className={`px-6 py-2 rounded-2xl text-[10px] font-black tracking-widest uppercase border-2 ${anomaly.severity === 'high' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                }`}>
                                                {anomaly.severity} Level Threat
                                            </span>
                                            <button className="w-12 h-12 rounded-2xl bg-slate-950/50 border border-slate-800 flex items-center justify-center text-slate-500 hover:text-white hover:border-slate-600 transition-all transform active:scale-90">
                                                <Settings size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Auth Modal */}
            {showAuthModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-3xl animate-in fade-in duration-300">
                    <div className="absolute inset-0 bg-slate-950/80" onClick={() => setShowAuthModal(false)}></div>
                    <div className="bg-slate-900 border-2 border-slate-800/80 w-full max-w-lg rounded-[48px] p-12 relative z-10 shadow-3xl animate-in zoom-in-95 duration-300 overflow-hidden">
                        <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600"></div>
                        <div className="text-center mb-10">
                            <h3 className="text-4xl font-black text-white tracking-tighter mb-2">
                                {authMode === 'login' ? 'Operational Access' : 'New Identity Core'}
                            </h3>
                            <p className="text-slate-400 font-medium">Verify credentials to synchronize with the neural nexus.</p>
                        </div>

                        <form onSubmit={handleAuth} className="space-y-6">
                            {authMode === 'register' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-4">Full Designation</label>
                                    <div className="relative">
                                        <User className="absolute left-6 top-5 text-slate-500" size={18} />
                                        <input
                                            type="text"
                                            required
                                            value={authForm.full_name}
                                            onChange={(e) => setAuthForm({ ...authForm, full_name: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-3xl py-5 pl-14 pr-8 text-white focus:outline-none focus:border-primary-500 transition-all font-bold placeholder:text-slate-700"
                                            placeholder="System Administrator"
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-4">User Identifier</label>
                                <div className="relative">
                                    <Mail className="absolute left-6 top-5 text-slate-500" size={18} />
                                    <input
                                        type="text"
                                        required
                                        value={authForm.username}
                                        onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-3xl py-5 pl-14 pr-8 text-white focus:outline-none focus:border-primary-500 transition-all font-bold placeholder:text-slate-700"
                                        placeholder="admin_core_01"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-4">Security Sequence</label>
                                <div className="relative">
                                    <Lock className="absolute left-6 top-5 text-slate-500" size={18} />
                                    <input
                                        type="password"
                                        required
                                        value={authForm.password}
                                        onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-3xl py-5 pl-14 pr-8 text-white focus:outline-none focus:border-primary-500 transition-all font-bold placeholder:text-slate-700"
                                        placeholder="••••••••••••"
                                    />
                                </div>
                            </div>

                            <button type="submit" className="w-full py-6 rounded-3xl bg-primary-600 text-white font-black text-xl shadow-2xl shadow-primary-500/20 hover:bg-primary-500 transition-all active:scale-[0.98] mt-4">
                                {authMode === 'login' ? 'Initiate Link' : 'Forge Identity'}
                            </button>
                        </form>

                        <div className="mt-8 text-center pt-8 border-t border-slate-800/50">
                            <p className="text-slate-500 font-bold mb-4">
                                {authMode === 'login' ? "No core footprint?" : "Already synchronized?"}
                            </p>
                            <button
                                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                                className="text-primary-400 font-black hover:text-primary-300 transition-colors uppercase text-xs tracking-widest"
                            >
                                {authMode === 'login' ? 'Create Neural Link' : 'Access Hub'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default App
