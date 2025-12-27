
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MP3Metadata, LyricLine, AudioState } from './types';
import { parseMetadata, parseLrc, serializeLrc } from './services/tagService';
import LyricItem from './components/LyricItem';

declare const ID3Writer: any;

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<MP3Metadata | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [syncIndex, setSyncIndex] = useState<number>(0);
  const [status, setStatus] = useState<'idle' | 'syncing' | 'completed'>('idle');
  const [showRawInput, setShowRawInput] = useState(false);
  const [rawText, setRawText] = useState('');
  const [audioState, setAudioState] = useState<AudioState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      setAudioUrl(URL.createObjectURL(uploadedFile));
      setStatus('idle');
      try {
        const meta = await parseMetadata(uploadedFile);
        setMetadata(meta);
        setLyrics(parseLrc(meta.lyrics || ""));
      } catch (err) {
        console.error("Meta parse error:", err);
      }
    }
  };

  const startSyncFromIndex = (index: number) => {
    if (lyrics.length === 0) return;
    
    // 定位到当前选中的行，从下一行开始记录
    const nextSyncIndex = index + 1;
    if (nextSyncIndex >= lyrics.length) {
      alert("已经是最后一句了");
      return;
    }

    setSyncIndex(nextSyncIndex);
    
    // 清除从下一行开始的所有时间戳
    setLyrics(prev => prev.map((l, i) => i >= nextSyncIndex ? { ...l, time: -1 } : l));
    
    setStatus('syncing');
    
    if (audioRef.current) {
      // 如果当前行有时间，跳到当前行时间；否则原地开始
      if (lyrics[index].time >= 0) {
        audioRef.current.currentTime = lyrics[index].time;
      }
      audioRef.current.play();
    }
  };

  const startFullSync = () => {
    if (lyrics.length === 0) return alert("请先提供歌词");
    setSyncIndex(0);
    setLyrics(prev => prev.map(l => ({ ...l, time: -1 })));
    setStatus('syncing');
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  const handleBeatMark = useCallback(() => {
    if (status !== 'syncing' || syncIndex >= lyrics.length || !audioRef.current) return;
    
    const now = audioRef.current.currentTime;
    setLyrics(prev => {
      const copy = [...prev];
      copy[syncIndex] = { ...copy[syncIndex], time: now };
      return copy;
    });
    
    const nextIdx = syncIndex + 1;
    setSyncIndex(nextIdx);
    
    if (nextIdx >= lyrics.length) {
      setStatus('completed');
      audioRef.current.pause();
    }
  }, [status, syncIndex, lyrics.length]);

  const handleImportText = () => {
    const lines = rawText.split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (lines.length > 0) {
      setLyrics(lines.map((t, i) => ({ id: `L-${i}-${Date.now()}`, text: t, time: -1 })));
      setShowRawInput(false);
      setRawText('');
      setStatus('idle');
    }
  };

  const saveMP3 = async () => {
    if (!file || !metadata) return;
    try {
      const writer = new ID3Writer(await file.arrayBuffer());
      writer.setFrame('USLT', { lyrics: serializeLrc(lyrics), description: 'Lyrics', language: 'eng' });
      if (metadata.title) writer.setFrame('TIT2', metadata.title);
      if (metadata.artist) writer.setFrame('TPE1', [metadata.artist]);
      if (metadata.album) writer.setFrame('TALB', metadata.album);
      if (metadata.rawPicture) {
        writer.setFrame('APIC', {
          type: 3, data: metadata.rawPicture, description: 'Cover',
          mimeType: metadata.pictureMime || 'image/jpeg'
        });
      }
      writer.addTag();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(writer.getBlob());
      a.download = `[Studio] ${file.name}`;
      a.click();
    } catch (e) { alert("导出失败"); }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (status === 'syncing' && e.key === 'Enter') {
        e.preventDefault();
        handleBeatMark();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [status, handleBeatMark]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeIdx = status === 'syncing' ? syncIndex : lyrics.findIndex((l, i) => {
        const next = lyrics[i + 1];
        return audioState.currentTime >= l.time && (!next || audioState.currentTime < next.time);
      });
      if (activeIdx !== -1) {
        const el = scrollContainerRef.current.children[activeIdx] as HTMLElement;
        if (el) scrollContainerRef.current.scrollTo({ top: el.offsetTop - 200, behavior: 'smooth' });
      }
    }
  }, [audioState.currentTime, syncIndex, status]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#05070a]">
      {/* Navbar */}
      <nav className="h-16 flex-shrink-0 flex items-center justify-between px-8 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl z-50">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white italic shadow-lg shadow-indigo-600/20">L</div>
          <div className="flex flex-col">
            <span className="font-bold text-base tracking-tight leading-none">LYRICAL <span className="text-indigo-500">PRO</span></span>
            <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-1">Studio Editor</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <a href="/principles.html" target="_blank" className="text-xs font-bold text-slate-400 hover:text-indigo-400 transition-colors uppercase tracking-widest border-r border-white/10 pr-6 mr-2">工作原理</a>
          {!file ? (
            <label className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-xl shadow-indigo-600/20">
              载入音乐 (MP3)
              <input type="file" accept="audio/mpeg" hidden onChange={handleFileUpload} />
            </label>
          ) : (
            <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
              <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-tighter">Loaded</span>
              <span className="text-xs text-slate-300 font-medium truncate max-w-[120px]">{file.name}</span>
              <button onClick={() => setFile(null)} className="text-slate-500 hover:text-white transition-colors ml-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          )}
        </div>
      </nav>

      <div className="flex-grow flex overflow-hidden">
        {/* Left Sidebar: Control & Meta */}
        <aside className="w-[360px] flex-shrink-0 border-r border-white/5 bg-[#080a0f] p-8 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
          {metadata ? (
            <>
              <div className="relative aspect-square group">
                <div className="absolute inset-0 bg-indigo-600 blur-[100px] opacity-10 group-hover:opacity-25 transition-all duration-700"></div>
                <img 
                  src={metadata.picture || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=800"} 
                  className="w-full h-full object-cover rounded-[2.5rem] shadow-2xl relative z-10 border border-white/10 transition-transform duration-700 group-hover:scale-[1.02]"
                  alt="Cover"
                />
              </div>

              <div className="space-y-2 text-center">
                <h2 className="text-xl font-extrabold text-white truncate px-2 leading-tight">{metadata.title}</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{metadata.artist}</p>
              </div>

              <div className="glass-panel rounded-[2rem] p-6 space-y-4">
                {status === 'idle' && (
                  <div className="space-y-3">
                    <button 
                      onClick={() => setShowRawInput(true)}
                      className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all"
                    >
                      导入歌词文本
                    </button>
                    <button 
                      onClick={startFullSync}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/></svg>
                      全曲节奏打点
                    </button>
                  </div>
                )}

                {status === 'syncing' && (
                  <div className="text-center space-y-6 py-4 animate-in fade-in zoom-in duration-300">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/10 text-red-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-500/20">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                      Recording Active
                    </div>
                    <div className="space-y-2">
                       <p className="text-5xl font-black text-white tracking-tighter">ENTER</p>
                       <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-60">敲击回车记录下一句时间</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">正在记录</p>
                      <p className="text-sm font-bold text-indigo-400 truncate italic">"{lyrics[syncIndex]?.text}"</p>
                    </div>
                    <button onClick={() => setStatus('idle')} className="text-[10px] text-slate-500 hover:text-white uppercase font-bold tracking-widest transition-colors underline underline-offset-8">停止并重置</button>
                  </div>
                )}

                {status === 'completed' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom duration-500">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
                      <p className="text-emerald-400 font-bold text-xs uppercase tracking-widest">✓ Sync Complete</p>
                    </div>
                    <button onClick={saveMP3} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-[11px] font-bold uppercase tracking-widest shadow-xl shadow-emerald-500/30 transition-all">导出同步文件</button>
                    <button onClick={() => setStatus('idle')} className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[11px] font-bold border border-white/5 transition-all uppercase tracking-widest">返回编辑器</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 px-4">
              <div className="w-24 h-24 bg-white/5 rounded-[3rem] flex items-center justify-center border border-white/5 shadow-inner">
                <svg className="w-10 h-10 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/></svg>
              </div>
              <div className="space-y-2">
                <p className="text-slate-300 font-bold text-sm">Studio Idle</p>
                <p className="text-slate-500 text-xs leading-relaxed">请先在顶部导航栏载入 MP3 音频文件开始编辑。</p>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content: Lyrics Workspace */}
        <main className="flex-grow flex flex-col relative bg-[#05070a]">
          <div className="h-16 flex-shrink-0 flex items-center justify-between px-10 bg-slate-950/40 backdrop-blur-sm border-b border-white/5 z-20">
            <div className="flex items-center gap-4">
              <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Workspace Editor</h3>
              {lyrics.length > 0 && <span className="text-[10px] font-mono text-slate-600">COUNT: {lyrics.length} LINES</span>}
            </div>
            <button 
              onClick={() => setLyrics(p => [...p, { id: `manual-${Date.now()}`, text: '', time: -1 }])}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeWidth="2.5" strokeLinecap="round"/></svg>
              追加新行
            </button>
          </div>

          <div 
            ref={scrollContainerRef}
            className={`flex-grow overflow-y-auto p-12 space-y-2 custom-scrollbar transition-all duration-1000 ${status === 'syncing' ? 'bg-indigo-950/20' : ''}`}
          >
            {lyrics.length > 0 ? (
              lyrics.map((line, idx) => {
                const isActiveSync = status === 'syncing' && syncIndex === idx;
                const isPlayingLine = status !== 'syncing' && lyrics.findIndex((l, i) => {
                  const n = lyrics[i+1];
                  return audioState.currentTime >= l.time && (!n || audioState.currentTime < n.time);
                }) === idx;

                return (
                  <LyricItem 
                    key={line.id}
                    line={line}
                    isActive={isActiveSync || isPlayingLine}
                    isSyncing={status === 'syncing'}
                    onTextChange={(id, text) => setLyrics(p => p.map(l => l.id === id ? {...l, text} : l))}
                    onTimeChange={() => {}}
                    onFocus={() => status === 'syncing' && setSyncIndex(idx)}
                    onSyncFromHere={() => startSyncFromIndex(idx)}
                  />
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-30 pointer-events-none">
                 <p className="text-6xl font-black italic tracking-tighter text-slate-800">EMPTY STUDIO</p>
                 <p className="text-[10px] uppercase tracking-[0.5em] mt-6 text-slate-600 font-bold">Import text to start the rhythm</p>
              </div>
            )}
          </div>

          {/* Bottom Player Controller */}
          <div className="h-28 flex-shrink-0 bg-slate-950/90 backdrop-blur-3xl border-t border-white/5 px-12 flex items-center gap-12 z-30">
            <button 
              onClick={() => audioRef.current?.paused ? audioRef.current.play() : audioRef.current?.pause()}
              className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-black active:scale-95 transition-all shadow-2xl hover:bg-indigo-50"
            >
              {audioState.isPlaying ? (
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            <div className="flex-grow space-y-3">
              <div className="flex justify-between text-[10px] font-mono text-slate-500 font-bold tracking-tighter uppercase">
                <span>{new Date(audioState.currentTime * 1000).toISOString().substr(14, 5)}</span>
                <span className="text-indigo-500/60">Playback Engine</span>
                <span>{new Date(audioState.duration * 1000).toISOString().substr(14, 5)}</span>
              </div>
              <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
                <input 
                  type="range" min="0" max={audioState.duration || 1} step="0.01" 
                  value={audioState.currentTime}
                  onChange={e => { if(audioRef.current) audioRef.current.currentTime = parseFloat(e.target.value); }}
                  className="absolute inset-0 w-full opacity-0 z-10 cursor-pointer"
                />
                <div className="h-full bg-indigo-600 rounded-full transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(79,70,229,0.5)]" style={{ width: `${(audioState.currentTime / (audioState.duration || 1)) * 100}%` }}></div>
              </div>
            </div>

            <div className="w-32 flex items-center gap-4 group">
              <svg className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" fill="currentColor" viewBox="0 0 24 24"><path d="M14 5v14l-7-5H4V10h3l7-5zm3.5 7c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={audioState.volume}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  if(audioRef.current) audioRef.current.volume = v;
                  setAudioState(p => ({ ...p, volume: v }));
                }}
                className="flex-grow accent-indigo-500 h-1 bg-white/5 rounded-full appearance-none cursor-pointer"
              />
            </div>
          </div>
        </main>
      </div>

      <audio 
        ref={audioRef} src={audioUrl || ""} 
        onTimeUpdate={() => setAudioState(p => ({...p, currentTime: audioRef.current?.currentTime || 0}))}
        onLoadedMetadata={() => setAudioState(p => ({...p, duration: audioRef.current?.duration || 0}))}
        onPlay={() => setAudioState(p => ({...p, isPlaying: true}))}
        onPause={() => setAudioState(p => ({...p, isPlaying: false}))}
        onEnded={() => { if(status === 'syncing') setStatus('completed'); }}
      />

      {/* Import Text Modal */}
      {showRawInput && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="glass-panel w-full max-w-2xl rounded-[3rem] p-12 flex flex-col gap-8 shadow-[0_0_100px_rgba(0,0,0,0.5)] border-white/10 scale-in-center">
            <div className="space-y-2">
              <h3 className="text-3xl font-black italic tracking-tighter text-white uppercase">Sync Start</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">粘贴不带时间轴的纯文本歌词</p>
            </div>
            <textarea 
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="在这里粘贴歌词内容，每一行为一句..."
              className="w-full h-80 bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-8 text-slate-200 focus:border-indigo-500/50 transition-all outline-none resize-none custom-scrollbar leading-relaxed"
            />
            <div className="flex gap-4">
              <button onClick={() => setShowRawInput(false)} className="flex-grow py-5 rounded-2xl bg-white/5 text-slate-400 font-bold uppercase tracking-widest text-[11px] hover:bg-white/10 transition-all">取消</button>
              <button onClick={handleImportText} className="flex-grow py-5 rounded-2xl bg-indigo-600 text-white font-bold uppercase tracking-widest text-[11px] hover:bg-indigo-500 shadow-2xl shadow-indigo-600/30 transition-all">导入编辑器</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
