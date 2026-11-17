import React, { useState, useEffect, useRef } from 'react';
import './styles/styles.css'; 
import { colors, styles } from './styles/appStyles';
import { pts, gd, sortedTeams, getBestThirdPlaces, parseCSVToGroups } from './groupsData'; 

const JOGOS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS9aKOTDUnPPIx6xpEtLl0LXwzhVwKWTlL7igp-Lp951LK2eUg4HOn8Ba7mRQwGaUcLkgfrF2b7BZLF/pub?gid=0&single=true&output=csv";
const TIMES_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS9aKOTDUnPPIx6xpEtLl0LXwzhVwKWTlL7igp-Lp951LK2eUg4HOn8Ba7mRQwGaUcLkgfrF2b7BZLF/pub?gid=1281186793&single=true&output=csv";
const JOGADORES_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS9aKOTDUnPPIx6xpEtLl0LXwzhVwKWTlL7igp-Lp951LK2eUg4HOn8Ba7mRQwGaUcLkgfrF2b7BZLF/pub?gid=798750360&single=true&output=csv";

// ─── DURAÇÃO DE PARTIDA (minutos) ─────────────────────────────────────────────
const MATCH_DURATION_MINUTES = 115; // 90min + ~25min de acréscimos/intervalo
// Mata-mata pode ir a prorrogação (+30min) e pênaltis (+~20min com cobranças e intervalos)
const KNOCKOUT_MATCH_DURATION_MINUTES = 165; // 90min + intervalo + prorrogação + pênaltis

// ─── HELPER: resolve data+hora para Date, suportando DD/MM, DD/MM/YYYY, YYYY-MM-DD ─
function resolveMatchStart(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  let isoDate;
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2] ? parts[2] : new Date().getFullYear();
    isoDate = `${y}-${m}-${d}`;
  } else if (dateStr.includes('-')) {
    isoDate = dateStr;
  } else {
    return null;
  }
  const [h, min] = timeStr.split(':');
  const start = new Date(`${isoDate}T${h.padStart(2,'0')}:${(min||'00').padStart(2,'0')}:00`);
  return isNaN(start.getTime()) ? null : start;
}

// ─── HOOK: verifica se um jogo está ao vivo agora ─────────────────────────────
function useIsLive(dateStr, timeStr, durationMinutes = MATCH_DURATION_MINUTES) {
  const [isLive, setIsLive] = useState(false);
  useEffect(() => {
    const check = () => {
      const start = resolveMatchStart(dateStr, timeStr);
      if (!start) { setIsLive(false); return; }
      const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
      setIsLive(Date.now() >= start.getTime() && Date.now() <= end.getTime());
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [dateStr, timeStr, durationMinutes]);
  return isLive;
}

// ─── HOOK: retorna data local no formato DD/MM (zero-padded) ─────────────────
// A planilha armazena apenas dia e mês (ex: "11/06"), então comparamos só DD/MM
function useTodayStr() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}`;
}

// ─── HELPER: extrai DD/MM de qualquer formato de data ────────────────────────
// Suporta: "DD/MM", "DD/MM/YYYY", "YYYY-MM-DD" — sempre devolve "DD/MM"
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const s = dateStr.trim();
  if (s.includes('/')) {
    const parts = s.split('/');
    return `${parts[0].padStart(2,'0')}/${parts[1].padStart(2,'0')}`;
  }
  if (s.includes('-')) {
    // YYYY-MM-DD → DD/MM
    const [, m, d] = s.split('-');
    return `${d.padStart(2,'0')}/${m.padStart(2,'0')}`;
  }
  return s;
}

// ─── COMPONENTE: Badge "AO VIVO" com pulse ────────────────────────────────────
function LiveBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.5)',
      color: '#f87171', fontSize: '10px', fontWeight: '800',
      letterSpacing: '1.5px', textTransform: 'uppercase',
      padding: '2px 8px', borderRadius: '4px',
    }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%',
        background: '#ef4444',
        animation: 'livePulse 1.2s ease-in-out infinite',
        flexShrink: 0,
      }} />
      ao vivo
    </span>
  );
}

// ─── COMPONENTE: Card de jogo (usado na landing e nos detalhes de grupo) ──────
function MatchCard({ match, compact = false }) {
  const isLive = useIsLive(match.date, match.time);
  const isFutureMatch = match.s1 === null || match.s2 === null;

  if (compact) {
    // Versão compacta para a seção "Jogos de Hoje" da landing
    return (
      <div className="today-match-card" style={{
        background: isLive ? 'rgba(220,38,38,0.08)' : 'rgba(255,255,255,0.04)',
        border: isLive ? '1px solid rgba(220,38,38,0.35)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        transition: 'all 0.2s ease',
        animation: 'fadeSlideIn 0.4s ease both',
      }}>
        <span style={{ flex: 1, textAlign: 'right', fontSize: '13px', fontWeight: '700', color: colors.white, lineHeight: 1.2 }}>{match.t1}</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '72px' }}>
          {isLive && <LiveBadge />}
          {isFutureMatch ? (
            <span style={{ fontSize: '13px', fontWeight: '600', color: colors.gold, letterSpacing: '1px' }}>{match.time}</span>
          ) : (
            <span style={{ fontSize: '16px', fontWeight: '800', color: isLive ? '#f87171' : colors.white, letterSpacing: '2px' }}>{match.s1}–{match.s2}</span>
          )}
          {!isLive && isFutureMatch && <span style={{ fontSize: '10px', color: colors.textMuted }}>{match.date}</span>}
        </div>
        <span style={{ flex: 1, textAlign: 'left', fontSize: '13px', fontWeight: '700', color: colors.white, lineHeight: 1.2 }}>{match.t2}</span>
      </div>
    );
  }

  // Versão padrão (páginas de grupo)
  return (
    <div style={{
      ...styles.matchCard,
      border: isLive ? '1px solid rgba(220,38,38,0.4)' : (styles.matchCard.border || '1px solid transparent'),
      background: isLive ? 'rgba(220,38,38,0.07)' : styles.matchCard.background,
      position: 'relative',
    }}>
      {isLive && (
        <div style={{ position: 'absolute', top: '6px', left: '50%', transform: 'translateX(-50%)' }}>
          <LiveBadge />
        </div>
      )}
      <div style={{ ...styles.matchTeamLeft, paddingTop: isLive ? '18px' : '0' }}>
        <span className="team-text" style={styles.matchTeamText}>{match.t1}</span>
      </div>
      <div style={{ ...styles.matchScoreBox(isFutureMatch), paddingTop: isLive ? '18px' : '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {isFutureMatch ? (
          <div style={{ ...styles.matchFutureBox, alignItems: 'center', textAlign: 'center' }}>
            <span style={styles.matchDate}>{match.date}</span>
            <span style={styles.matchTime}>{match.time}</span>
          </div>
        ) : (
          <div style={{ ...styles.matchScoreText, color: isLive ? '#f87171' : styles.matchScoreText?.color, textAlign: 'center' }}>{match.s1}–{match.s2}</div>
        )}
      </div>
      <div style={{ ...styles.matchTeamRight, paddingTop: isLive ? '18px' : '0' }}>
        <span className="team-text" style={styles.matchTeamText}>{match.t2}</span>
      </div>
    </div>
  );
}

// ─── COMPONENTE: Próximo(s) jogo(s) — aparece só quando não há nenhum jogo hoje ─
function NextMatch({ groups, knockoutMatches = [] }) {
  const todayStr = (() => {
    const now = new Date();
    return `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}`;
  })();

  // Se houver qualquer jogo hoje (encerrado, ao vivo ou futuro), não mostra nada
  const hasAnyToday =
    groups.some(g => g.matches.some(m => normalizeDate(m.date) === todayStr)) ||
    knockoutMatches.some(m => normalizeDate(m.date) === todayStr);
  if (hasAnyToday) return null;

  // Coleta todos os jogos futuros (sem placar, fora de hoje)
  const futurMatches = [];
  groups.forEach(g => {
    g.matches.forEach(m => {
      if (m.s1 !== null || m.s2 !== null) return;
      const start = resolveMatchStart(m.date, m.time);
      if (start && start.getTime() > Date.now()) {
        futurMatches.push({ ...m, groupId: g.id, _start: start.getTime() });
      }
    });
  });
  // Inclui também jogos futuros do mata-mata
  knockoutMatches.forEach(m => {
    if (m.s1 !== null || m.s2 !== null) return;
    const start = resolveMatchStart(m.date, m.time);
    if (start && start.getTime() > Date.now()) {
      futurMatches.push({ ...m, groupId: null, _start: start.getTime() });
    }
  });
  if (futurMatches.length === 0) return null;

  futurMatches.sort((a, b) => a._start - b._start);
  const nextTime = futurMatches[0]._start;
  // Agrupa todos do mesmo horário (podem ser vários simultâneos)
  const nextBatch = futurMatches.filter(m => m._start === nextTime);

  // Formata data legível
  const nextDate = new Date(nextTime);
  const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const dayLabel = `${dayNames[nextDate.getDay()]}, ${String(nextDate.getDate()).padStart(2,'0')}/${String(nextDate.getMonth()+1).padStart(2,'0')}`;

  return (
    <div style={{
      width: '100%', maxWidth: '560px', margin: '0 auto 8px',
      padding: '0 20px', boxSizing: 'border-box',
      animation: 'fadeSlideIn 0.5s ease 0.1s both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', color: colors.gold }}>
          Próximos Jogos
        </div>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ fontSize: '11px', color: colors.textMuted }}>{dayLabel}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {nextBatch.map((m, i) => (
          <div key={m.id || i} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px', padding: '12px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
            animation: `fadeSlideIn 0.4s ease ${i * 0.07}s both`,
          }}>
            <span style={{ flex: 1, textAlign: 'right', fontSize: '13px', fontWeight: '700', color: colors.white, lineHeight: 1.2 }}>{m.t1}</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '80px' }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: colors.gold, letterSpacing: '1px' }}>{m.time}</span>
              <span style={{ fontSize: '10px', color: colors.textMuted }}>{m.groupId ? `Grupo ${m.groupId}` : (m.fase || 'Mata-Mata')}</span>
            </div>
            <span style={{ flex: 1, textAlign: 'left', fontSize: '13px', fontWeight: '700', color: colors.white, lineHeight: 1.2 }}>{m.t2}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── COMPONENTE: Seção "Jogos de Hoje" (landing page) ────────────────────────
// Exibe TODOS os jogos do dia: finalizados, ao vivo e ainda não iniciados.
function TodayMatches({ groups, knockoutMatches = [] }) {
  const todayStr = useTodayStr();
  const todayMatches = [];
  groups.forEach(g => {
    g.matches.forEach(m => {
      // Inclui independente de ter placar ou não — finalizados e futuros
      if (normalizeDate(m.date) === todayStr) {
        todayMatches.push({ ...m, groupId: g.id });
      }
    });
  });
  // Inclui também jogos do mata-mata de hoje (fase eliminatória)
  knockoutMatches.forEach(m => {
    if (normalizeDate(m.date) === todayStr) {
      todayMatches.push({ ...m, groupId: null });
    }
  });
  // Ordena por horário crescente (mais cedo primeiro)
  todayMatches.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  if (todayMatches.length === 0) return null;
  return (
    <div style={{
      width: '100%',
      maxWidth: '560px',
      margin: '0 auto 8px',
      padding: '0 20px',
      boxSizing: 'border-box',
      animation: 'fadeSlideIn 0.5s ease 0.1s both',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginBottom: '12px',
      }}>
        <div style={{
          fontSize: '11px', fontWeight: '800', letterSpacing: '2px',
          textTransform: 'uppercase', color: colors.gold,
        }}>
          Jogos de Hoje
        </div>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ fontSize: '11px', color: colors.textMuted }}>
          {todayMatches.length} {todayMatches.length === 1 ? 'jogo' : 'jogos'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {todayMatches.map((m, i) => (
          <TodayMatchCardWithLive key={m.id || i} match={m} index={i} />
        ))}
      </div>
    </div>
  );
}

// Card de jogo — versão ao vivo substitui o card normal inline na lista
function TodayMatchCardWithLive({ match, index }) {
  const isKnockout = !match.groupId;
  const isLive = useIsLive(match.date, match.time, isKnockout ? KNOCKOUT_MATCH_DURATION_MINUTES : MATCH_DURATION_MINUTES);
  const isFutureMatch = match.s1 === null || match.s2 === null;

  // ── Card ao vivo: destaque vermelho, maior, substitui o card padrão ──────────
  if (isLive) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(220,38,38,0.16) 0%, rgba(220,38,38,0.05) 100%)',
        border: '1.5px solid rgba(220,38,38,0.55)',
        borderRadius: '14px',
        padding: '14px 16px',
        boxShadow: '0 0 28px rgba(220,38,38,0.13)',
        transition: 'all 0.3s ease',
        animation: `fadeSlideIn 0.4s ease ${(index || 0) * 0.07}s both`,
      }}>
        {/* Cabeçalho: badge ao vivo + grupo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <LiveBadge />
          <span style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(248,113,113,0.65)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {match.groupId ? `Grupo ${match.groupId}` : (match.fase || 'Mata-Mata')}
          </span>
        </div>
        {/* Times e placar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ flex: 1, textAlign: 'right', fontSize: '14px', fontWeight: '800', color: colors.white, lineHeight: 1.2 }}>{match.t1}</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '72px' }}>
            {isFutureMatch ? (
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#f87171' }}>• • •</span>
            ) : (
              <span style={{ fontSize: '22px', fontWeight: '900', color: '#f87171', letterSpacing: '3px' }}>{match.s1}–{match.s2}</span>
            )}
          </div>
          <span style={{ flex: 1, textAlign: 'left', fontSize: '14px', fontWeight: '800', color: colors.white, lineHeight: 1.2 }}>{match.t2}</span>
        </div>
      </div>
    );
  }

  // ── Card padrão (não ao vivo) ────────────────────────────────────────────────
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '10px',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      transition: 'background 0.3s ease, border 0.3s ease',
      animation: `fadeSlideIn 0.4s ease ${(index || 0) * 0.07}s both`,
    }}>
      <span style={{ flex: 1, textAlign: 'right', fontSize: '13px', fontWeight: '700', color: colors.white, lineHeight: 1.2 }}>{match.t1}</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '80px' }}>
        {isFutureMatch ? (
          <span style={{ fontSize: '14px', fontWeight: '700', color: colors.gold, letterSpacing: '1px' }}>{match.time}</span>
        ) : (
          <span style={{ fontSize: '17px', fontWeight: '800', color: colors.white, letterSpacing: '2px' }}>{match.s1}–{match.s2}</span>
        )}
        <span style={{ fontSize: '10px', color: colors.textMuted }}>{match.groupId ? `Grupo ${match.groupId}` : (match.fase || 'Mata-Mata')}</span>
      </div>
      <span style={{ flex: 1, textAlign: 'left', fontSize: '13px', fontWeight: '700', color: colors.white, lineHeight: 1.2 }}>{match.t2}</span>
    </div>
  );
}

// ─── COMPONENTE: Busca por seleção ────────────────────────────────────────────
function TeamSearch({ groups, onClose }) {
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // Trigger entrada com pequeno delay para animar
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (visible && inputRef.current) inputRef.current.focus();
  }, [visible]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  // Coleta todas as seleções únicas
  const allTeams = [];
  groups.forEach(g => {
    g.teams.forEach(t => { if (!allTeams.find(x => x.name === t)) allTeams.push({ name: t, groupId: g.id }); });
  });
  allTeams.sort((a, b) => a.name.localeCompare(b.name));

  const q = query.trim().toLowerCase();
  const filtered = q.length >= 1 ? allTeams.filter(t => t.name.toLowerCase().includes(q)) : [];

  // Para um time encontrado, busca seus jogos e posição na tabela
  const getTeamData = (teamName) => {
    const teamMatches = [];
    let groupId = null;
    let standing = null;

    groups.forEach(g => {
      const gMatches = g.matches.filter(m => m.t1 === teamName || m.t2 === teamName);
      if (gMatches.length > 0) {
        groupId = g.id;
        gMatches.forEach(m => teamMatches.push(m));
        const sorted = sortedTeams(g.teams, g.matches);
        const pos = sorted.findIndex(t => t.name === teamName);
        if (pos !== -1) standing = { pos: pos + 1, stats: sorted[pos] };
      }
    });

    teamMatches.sort((a, b) => (a.r || 0) - (b.r || 0));
    return { teamMatches, groupId, standing };
  };

  const exactMatch = filtered.length === 1 ? filtered[0] : (filtered.find(t => t.name.toLowerCase() === q) || null);
  const teamData = exactMatch ? getTeamData(exactMatch.name) : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '60px 20px 20px',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.25s ease',
    }}>
      <div style={{
        width: '100%', maxWidth: '520px',
        background: '#0f172a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        overflow: 'hidden',
        transform: visible ? 'translateY(0)' : 'translateY(-20px)',
        transition: 'transform 0.25s ease',
        maxHeight: 'calc(100vh - 100px)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header de busca */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar seleção…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: colors.white, fontSize: '16px', fontWeight: '500',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
          )}
          <button onClick={handleClose} style={{
            background: 'rgba(255,255,255,0.07)', border: 'none', color: colors.textMuted,
            cursor: 'pointer', fontSize: '12px', padding: '4px 10px', borderRadius: '6px', fontWeight: '600',
          }}>Fechar</button>
        </div>

        {/* Conteúdo */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Sugestões de times */}
          {q.length >= 1 && !exactMatch && filtered.length > 0 && (
            <div style={{ padding: '8px 0' }}>
              {filtered.map((t, i) => (
                <button key={i} onClick={() => setQuery(t.name)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 20px', background: 'none', border: 'none',
                  color: colors.white, cursor: 'pointer', textAlign: 'left',
                  fontSize: '14px', fontWeight: '600',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  {t.name}
                  <span style={{ fontSize: '11px', color: colors.textMuted, fontWeight: '400' }}>Grupo {t.groupId}</span>
                </button>
              ))}
            </div>
          )}

          {/* Resultado detalhado */}
          {exactMatch && teamData && (
            <div style={{ padding: '20px' }}>
              {/* Cabeçalho do time */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '22px', fontWeight: '800', color: colors.white }}>{exactMatch.name}</div>
                <div style={{ fontSize: '12px', color: colors.textMuted, marginTop: '2px' }}>Grupo {teamData.groupId}</div>
              </div>

              {/* Stats rápidas */}
              {teamData.standing && (() => {
                const s = teamData.standing.stats;
                const gdVal = gd(s);
                return (
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px',
                    marginBottom: '20px',
                  }}>
                    {[
                      { label: 'Posição', value: `${teamData.standing.pos}º` },
                      { label: 'Pontos', value: pts(s) },
                      { label: 'SG', value: `${gdVal > 0 ? '+' : ''}${gdVal}` },
                      { label: 'Gols', value: s.gf || 0 },
                    ].map((item, i) => (
                      <div key={i} style={{
                        background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
                        padding: '10px 8px', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: i === 0 ? colors.gold : colors.white }}>{item.value}</div>
                        <div style={{ fontSize: '10px', color: colors.textMuted, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Jogos do time */}
              <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', color: colors.textMuted, marginBottom: '10px' }}>Jogos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {teamData.teamMatches.map((m, i) => {
                  const isLive = false; // Aqui useIsLive não pode ser chamado em map, usamos o componente
                  const isFuture = m.s1 === null || m.s2 === null;
                  const isTeam1 = m.t1 === exactMatch.name;
                  const won = !isFuture && ((isTeam1 && m.s1 > m.s2) || (!isTeam1 && m.s2 > m.s1));
                  const drew = !isFuture && m.s1 === m.s2;
                  const lost = !isFuture && !won && !drew;
                  const resultColor = isFuture ? colors.textMuted : won ? '#4ade80' : drew ? colors.gold : '#f87171';
                  const resultLabel = isFuture ? '' : won ? 'V' : drew ? 'E' : 'D';
                  return (
                    <SearchMatchRow key={i} match={m} teamName={exactMatch.name} resultColor={resultColor} resultLabel={resultLabel} isFuture={isFuture} />
                  );
                })}
              </div>
            </div>
          )}

          {/* Nenhum resultado */}
          {q.length >= 2 && filtered.length === 0 && (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: colors.textMuted, fontSize: '14px' }}>
              Nenhuma seleção encontrada para "{query}"
            </div>
          )}

          {/* Estado inicial */}
          {q.length === 0 && (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: colors.textMuted, fontSize: '13px' }}>
              Digite o nome de uma seleção para ver seus jogos e classificação
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Row de jogo dentro do modal de busca (componente separado para poder usar o hook isLive)
function SearchMatchRow({ match, teamName, resultColor, resultLabel, isFuture }) {
  const isLive = useIsLive(match.date, match.time);
  const isTeam1 = match.t1 === teamName;
  const won = !isFuture && ((isTeam1 && match.s1 > match.s2) || (!isTeam1 && match.s2 > match.s1));
  const drew = !isFuture && match.s1 === match.s2;
  const actualResultColor = isFuture ? (isLive ? '#f87171' : colors.textMuted) : won ? '#4ade80' : drew ? colors.gold : '#f87171';
  const actualResultLabel = isLive ? '●' : (isFuture ? '' : (won ? 'V' : drew ? 'E' : 'D'));

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      background: isLive ? 'rgba(220,38,38,0.08)' : 'rgba(255,255,255,0.04)',
      border: isLive ? '1px solid rgba(220,38,38,0.3)' : '1px solid transparent',
      borderRadius: '8px', padding: '10px 12px',
      transition: 'background 0.2s',
    }}>
      <div style={{
        width: '20px', textAlign: 'center',
        fontSize: isLive ? '10px' : '12px', fontWeight: '800',
        color: actualResultColor,
      }}>{actualResultLabel}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: colors.white }}>
          {match.t1} <span style={{ color: colors.textMuted, fontWeight: '400' }}>vs</span> {match.t2}
        </div>
        {isLive && (
          <div style={{ marginTop: '2px' }}><LiveBadge /></div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        {isFuture && !isLive ? (
          <div style={{ fontSize: '12px', color: colors.gold, fontWeight: '600' }}>{match.time}</div>
        ) : (
          <div style={{ fontSize: '14px', fontWeight: '800', color: isLive ? '#f87171' : colors.white }}>{match.s1}–{match.s2}</div>
        )}
        <div style={{ fontSize: '10px', color: colors.textMuted }}>{match.date}</div>
      </div>
    </div>
  );
}

// ─── HELPER: extrai gols e pênaltis de um valor de placar ────────────────────
// Suporta formatos: "1", "1(3)" → { gols: 1, pen: 3 }
function parsePlacarComPenaltis(raw) {
  if (raw === undefined || raw === null || raw === '') return { gols: null, pen: null };
  const s = String(raw).trim();
  const m = s.match(/^(\d+)\s*\((\d+)\)$/);
  if (m) return { gols: parseInt(m[1], 10), pen: parseInt(m[2], 10) };
  if (!isNaN(s) && s !== '') return { gols: parseInt(s, 10), pen: null };
  return { gols: null, pen: null };
}

// ─── PARSER: lê a aba "Eliminatórias" do Google Sheets ──────────────────────
export function parseKnockoutCSV(csvText) {
  if (!csvText) return [];
  const lines = csvText.replace(/\r/g, "").split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(s => s.trim().toLowerCase());

  const idx = (name) => {
    const alts = { fase: ['fase'], jogo: ['jogo','num','número'], time1: ['time1','time 1'],
      placar1: ['placar1','gols1','p1'], placar2: ['placar2','gols2','p2'],
      time2: ['time2','time 2'], data: ['data'], hora: ['hora','horário'] };
    const keys = alts[name] || [name];
    for (const k of keys) { const i = headers.indexOf(k); if (i !== -1) return i; }
    return -1;
  };

  return lines.slice(1).map((line, i) => {
    const cols = line.split(sep).map(s => s.trim());
    const p1 = parsePlacarComPenaltis(cols[idx('placar1')]);
    const p2 = parsePlacarComPenaltis(cols[idx('placar2')]);
    return {
      id:    i,
      fase:  cols[idx('fase')]  || '',
      jogo:  parseInt(cols[idx('jogo')], 10) || (i + 73),
      t1:    cols[idx('time1')] || '',
      t2:    cols[idx('time2')] || '',
      s1:    p1.gols,
      s2:    p2.gols,
      pen1:  p1.pen,
      pen2:  p2.pen,
      date:  cols[idx('data')]  || '',
      time:  cols[idx('hora')]  || '',
    };
  }).filter(m => m.fase && m.t1 && m.t2);
}

// ─── COMPONENTE: Card de jogo do mata-mata ────────────────────────────────────
// Layout no estilo dos cards da fase de grupos: times nas laterais, placar central.
// Quando há pênaltis (match.pen1/pen2 preenchidos), exibe o resultado da disputa
// como subtítulo abaixo do placar normal.
function BracketMatchCard({ match, resolvedT1, resolvedT2 }) {
  const isLive = useIsLive(match?.date, match?.time, KNOCKOUT_MATCH_DURATION_MINUTES);
  const t1 = resolvedT1 || match?.t1 || 'A definir';
  const t2 = resolvedT2 || match?.t2 || 'A definir';
  const hasScore = match && match.s1 !== null && match.s2 !== null;
  const hasPenalties = match && match.pen1 !== null && match.pen2 !== null && match.pen1 !== undefined && match.pen2 !== undefined;
  const isFutureMatch = !hasScore;

  const isPlaceholder = (name) => {
    if (!name) return true;
    if (name === 'A definir') return true;
    if (name.startsWith('Vencedor') || name.startsWith('Perdedor')) return true;
    // Labels de posição ainda não resolvidos (ex: "1° A", "2° B", "3° A/B/C/D")
    if (/^\d[°ºo]\s*[A-L]/i.test(name)) return true;
    return false;
  };

  // Vencedor real considerando pênaltis em caso de empate no tempo normal
  const winnerSide = (() => {
    if (!hasScore) return null;
    if (match.s1 !== match.s2) return match.s1 > match.s2 ? 't1' : 't2';
    if (hasPenalties && match.pen1 !== match.pen2) return match.pen1 > match.pen2 ? 't1' : 't2';
    return null;
  })();

  const t1Color = isPlaceholder(t1) ? colors.textMuted : (winnerSide === 't1' ? colors.gold : colors.white);
  const t2Color = isPlaceholder(t2) ? colors.textMuted : (winnerSide === 't2' ? colors.gold : colors.white);

  return (
    <div style={{
      ...styles.matchCard,
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '6px',
      border: isLive ? '1px solid rgba(220,38,38,0.5)' : (styles.matchCard.border || '1px solid transparent'),
      background: isLive ? 'rgba(220,38,38,0.07)' : styles.matchCard.background,
      position: 'relative',
    }}>
      <div style={{ fontSize: '9px', color: colors.gold, fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
        Jogo {match?.jogo}
      </div>

      {isLive && (
        <div style={{ display: 'flex', justifyContent: 'center' }}><LiveBadge /></div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
        <div style={styles.matchTeamLeft}>
          <span className="team-text" style={{ ...styles.matchTeamText, color: t1Color, fontWeight: winnerSide === 't1' ? '800' : '600' }}>{t1}</span>
        </div>

        <div style={{ ...styles.matchScoreBox(isFutureMatch), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
          {isFutureMatch ? (
            <div style={{ ...styles.matchFutureBox, alignItems: 'center', textAlign: 'center' }}>
              <span style={styles.matchDate}>{match?.date}</span>
              <span style={styles.matchTime}>{match?.time}</span>
            </div>
          ) : (
            <>
              <div style={{ ...styles.matchScoreText, color: isLive ? '#f87171' : styles.matchScoreText?.color, textAlign: 'center' }}>
                {match.s1}–{match.s2}
              </div>
              {hasPenalties && (
                <div style={{ fontSize: '10px', fontWeight: '700', color: colors.gold, letterSpacing: '0.3px' }}>
                  pên. {match.pen1}–{match.pen2}
                </div>
              )}
            </>
          )}
        </div>

        <div style={styles.matchTeamRight}>
          <span className="team-text" style={{ ...styles.matchTeamText, color: t2Color, fontWeight: winnerSide === 't2' ? '800' : '600' }}>{t2}</span>
        </div>
      </div>
    </div>
  );
}

// ─── UTILITÁRIO: agrupa jogos de uma fase em pares cujos vencedores se enfrentam ─
// Retorna um array de pares [[jogoA, jogoB], ...] ordenados pela ordem do próximo jogo.
// Se não houver fase seguinte (semifinal) ou o jogo não tiver referência explícita,
// cai no comportamento simples de split ao meio.
function pairMatchesByNextRound(phaseMatches, allKnockoutMatches) {
  if (phaseMatches.length === 0) return [];

  // Monta mapa jogo# → match para consulta rápida
  const byNum = {};
  allKnockoutMatches.forEach(m => { byNum[m.jogo] = m; });

  // Descobre quais jogos da próxima fase referenciam cada jogo atual
  const currentNums = new Set(phaseMatches.map(m => m.jogo));

  // Para cada jogo da próxima fase, coleta os dois feeders (V XX) na ordem t1, t2
  const nextMatches = allKnockoutMatches.filter(m => {
    const nums = [m.t1, m.t2].map(raw => {
      const hit = (raw || '').trim().match(/^[Vv]\s*(\d+)$/);
      return hit ? parseInt(hit[1]) : null;
    });
    return nums.some(n => n !== null && currentNums.has(n));
  }).sort((a, b) => a.jogo - b.jogo);

  const paired = [];
  const used = new Set();

  nextMatches.forEach(next => {
    const feeders = [next.t1, next.t2].map(raw => {
      const hit = (raw || '').trim().match(/^[Vv]\s*(\d+)$/);
      return hit ? parseInt(hit[1]) : null;
    }).filter(n => n !== null && currentNums.has(n) && !used.has(n));

    if (feeders.length === 2) {
      paired.push([byNum[feeders[0]], byNum[feeders[1]]]);
      feeders.forEach(n => used.add(n));
    } else if (feeders.length === 1) {
      // Só um feeder encontrado para este jogo — adiciona como par incompleto
      paired.push([byNum[feeders[0]], null]);
      used.add(feeders[0]);
    }
  });

  // Jogos que não foram pareados (fase final ou sem referência explícita)
  const unpaired = phaseMatches.filter(m => !used.has(m.jogo));
  unpaired.forEach(m => paired.push([m, null]));

  return paired;
}

// Distribui os pares entre chave esquerda e direita:
// par 0 → esquerda, par 1 → direita, par 2 → esquerda, etc.
// Caso especial: quando a fase tem apenas 2 jogos (semifinal), 1 de cada lado.
function splitPairsToSides(pairs, phaseMatches) {
  const left = [], right = [];
  // Semifinal: 2 jogos, 1 de cada lado independente do pareamento
  if (phaseMatches && phaseMatches.length === 2) {
    left.push(phaseMatches[0]);
    right.push(phaseMatches[1]);
    return { left, right };
  }
  pairs.forEach((pair, i) => {
    const target = i % 2 === 0 ? left : right;
    pair.forEach(m => { if (m) target.push(m); });
  });
  return { left, right };
}

// ─── COMPONENTE: Página do Mata-Mata ──────────────────────────────────────────
const KNOCKOUT_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vS9aKOTDUnPPIx6xpEtLl0LXwzhVwKWTlL7igp-Lp951LK2eUg4HOn8Ba7mRQwGaUcLkgfrF2b7BZLF/pub?gid=239921622&single=true&output=csv";

const PHASE_ORDER = ['16avos', 'oitavas', 'quartas', 'semi'];
const PHASE_LABELS = { '16avos': '16avos de Final', oitavas: 'Oitavas', quartas: 'Quartas', semi: 'Semifinais', final: 'Final' };
const PHASE_RANGES = { '16avos': [73,88], oitavas: [89,96], quartas: [97,100], semi: [101,102] };

function KnockoutPage({ groups, onBack }) {
  const [activePhase, setActivePhase] = useState('16avos');
  const [knockoutMatches, setKnockoutMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(KNOCKOUT_CSV_URL)
      .then(r => r.text())
      .then(csv => { setKnockoutMatches(parseKnockoutCSV(csv)); setLoading(false); })
      .catch(() => setLoading(false));
    const id = setInterval(() =>
      fetch(KNOCKOUT_CSV_URL).then(r => r.text()).then(csv => setKnockoutMatches(parseKnockoutCSV(csv))).catch(() => {})
    , 60000);
    return () => clearInterval(id);
  }, []);

  // Mapa jogo# → match para resolução de V/P
  const matchByNum = {};
  knockoutMatches.forEach(m => { matchByNum[m.jogo] = m; });

  // Helper: pega o time de um grupo por posição (0=1°, 1=2°, 2=3°)
  // (mantido para uso futuro em fases avançadas, mas 3° colocados não são resolvidos)
  const getFromGroup = (groupLetter, rankIndex) => {
    const g = groups.find(x => x.id === groupLetter.toUpperCase());
    if (!g) return null;
    const sorted = sortedTeams(g.teams, g.matches, g.extraTeamInfo || {});
    return sorted[rankIndex]?.name || null;
  };

  // Resolve labels da planilha de eliminatórias:
  //
  // "1° A" / "2° B" → substitui pelo nome do time SOMENTE quando ambos os
  //   classificados matemáticos do grupo estão confirmados (posição imutável).
  //   Caso contrário mantém o texto original da planilha.
  //
  // "3° X/Y/Z" ou qualquer label de 3° colocado → NUNCA resolve; mantém como
  //   está na planilha (o critério de avanço dos 3°s é externo a este código).
  //
  // "V 73" / "P 73" → resolve pelo resultado do jogo indicado; o label interno
  //   do jogo-fonte (t1/t2) é retornado diretamente, sem recursão adicional,
  //   para evitar que um único time apareça em múltiplos confrontos.
  const resolveLabel = (raw) => {
    if (!raw) return 'A definir';
    const s = raw.trim();

    // ── Vencedor / Perdedor de um jogo anterior ────────────────────────────────
    const vMatch = s.match(/^[Vv]\s*(\d+)$/);
    const pMatch = s.match(/^[Pp]\s*(\d+)$/);
    if (vMatch || pMatch) {
      const num = parseInt((vMatch || pMatch)[1]);
      const src = matchByNum[num];
      const label = vMatch ? `Vencedor Jogo ${num}` : `Perdedor Jogo ${num}`;
      if (!src || src.s1 === null || src.s2 === null) return label;
      // Empate no tempo normal: só resolve se houver pênaltis registrados
      if (src.s1 === src.s2) {
        if (src.pen1 === null || src.pen2 === null || src.pen1 === src.pen2) return label;
        if (vMatch) {
          const winnerRaw = src.pen1 > src.pen2 ? src.t1 : src.t2;
          return resolveLabel(winnerRaw);
        } else {
          const loserRaw = src.pen1 < src.pen2 ? src.t1 : src.t2;
          return resolveLabel(loserRaw);
        }
      }
      if (vMatch) {
        // Retorna o label resolvido do jogo-fonte (pode ser "1° A" já substituído ou nome direto)
        const winnerRaw = src.s1 > src.s2 ? src.t1 : src.t2;
        return resolveLabel(winnerRaw);
      } else {
        const loserRaw = src.s1 < src.s2 ? src.t1 : src.t2;
        return resolveLabel(loserRaw);
      }
    }

    // ── Labels de posição em grupo: "N° Grupo" ────────────────────────────────
    const rankMatch = s.match(/^(\d)[°ºo]\s*([A-La-l](?:\/[A-La-l])*)\s*$/i);
    if (rankMatch) {
      const rank = parseInt(rankMatch[1], 10) - 1; // 0-indexed
      const groupStr = rankMatch[2];

      // 3° colocados — NUNCA resolve; critério externo. Mantém label da planilha.
      if (rank >= 2) return s;

      // 1° ou 2° de um grupo
      const g = groups.find(x => x.id === groupStr.toUpperCase());
      if (!g) return s;

      const sorted = sortedTeams(g.teams, g.matches, g.extraTeamInfo || {});
      const teamAtRank = sorted[rank];
      if (!teamAtRank) return s;

      const qualified = getQualifiedTeams(g.teams, g.matches, g.extraTeamInfo || {});

      // Posição só é imutável quando AMBOS os classificados matemáticos estão
      // confirmados E os dois não se enfrentam mais em jogo pendente.
      // Se ainda se enfrentam, o vencedor pode trocar de posição com o outro.
      if (qualified.size >= 2 && qualified.has(teamAtRank.name)) {
        const qualifiedNames = [...qualified];
        const [q1, q2] = qualifiedNames;
        const stillFaceEachOther = g.matches.some(m =>
          (m.s1 === null || m.s2 === null) &&
          ((m.t1 === q1 && m.t2 === q2) || (m.t1 === q2 && m.t2 === q1))
        );
        if (!stillFaceEachOther) {
          return teamAtRank.name;
        }
      }

      // Ainda não fixado — mantém label original da planilha
      return s;
    }

    // ── Texto literal (nome de time já definido na planilha) ──────────────────
    return s;
  };

  // Final e 3° lugar sempre visíveis no centro, independente da fase selecionada
  const finalMatch = knockoutMatches.find(m => m.jogo === 104);
  const thirdMatch = knockoutMatches.find(m => m.jogo === 103);

  // Fases disponíveis para o seletor — excluindo 'final' (sempre fica no centro)
  const availablePhases = PHASE_ORDER.filter(p => {
    if (p === 'final') return false;
    const [mn, mx] = PHASE_RANGES[p];
    return knockoutMatches.some(m => m.jogo >= mn && m.jogo <= mx);
  });

  const [min, max] = PHASE_RANGES[activePhase] || [73, 88];
  const phaseMatches = knockoutMatches.filter(m => m.jogo >= min && m.jogo <= max);
  const pairs = pairMatchesByNextRound(phaseMatches, knockoutMatches);
  const { left: leftMatches, right: rightMatches } = splitPairsToSides(pairs, phaseMatches);

  return (
    <div className="container-wrapper page-enter" style={styles.detailWrapper}>
      <div style={styles.detailHeader}>
        <button onClick={onBack} style={styles.backButton}>Voltar</button>
        <div style={styles.detailHeaderTitle}>Chaveamento • <span style={{ color: colors.gold }}>Mata-Mata</span></div>
        <div style={{ width: '80px' }}></div>
      </div>

      {/* Seletor de fase */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '16px 0 20px', flexWrap: 'wrap', padding: '0 20px' }}>
        {availablePhases.map(p => (
          <button key={p} onClick={() => setActivePhase(p)} style={styles.tabButton(activePhase === p)}>
            {PHASE_LABELS[p]}
          </button>
        ))}
      </div>


      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: colors.textMuted }}>Carregando chaveamento…</div>
      ) : (
        <div className="bracket-container">
          <div className="bracket-split-layout">

            {/* Chave esquerda */}
            <div className="bracket-side-column">
              <div style={{ ...styles.sectionTitle, textAlign: 'left' }}>Chave Esquerda</div>
              {leftMatches.length === 0 ? (
                <div style={{ fontSize: '12px', color: colors.textMuted, padding: '12px 0' }}>Jogos ainda não definidos.</div>
              ) : (() => {
                const items = [];
                for (let i = 0; i < leftMatches.length; i += 2) {
                  if (i > 0) items.push(
                    <div key={`sep-l-${i}`} style={{ height: '1px', background: 'rgba(245,197,24,0.12)', margin: '6px 0' }} />
                  );
                  items.push(<BracketMatchCard key={leftMatches[i].id} match={leftMatches[i]} resolvedT1={resolveLabel(leftMatches[i].t1)} resolvedT2={resolveLabel(leftMatches[i].t2)} />);
                  if (leftMatches[i + 1]) {
                    items.push(<BracketMatchCard key={leftMatches[i+1].id} match={leftMatches[i+1]} resolvedT1={resolveLabel(leftMatches[i+1].t1)} resolvedT2={resolveLabel(leftMatches[i+1].t2)} />);
                  }
                }
                return items;
              })()}
            </div>

            {/* Centro: pódio fixo com Final + 3° lugar */}
            <div className="bracket-center-podium">
              <div className="final-grand-box">
                <div style={{ fontSize: '11px', fontWeight: '800', color: colors.gold, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px', textAlign: 'center' }}>
                  Grande Final
                </div>
                {finalMatch ? (
                  <BracketMatchCard match={finalMatch} resolvedT1={resolveLabel(finalMatch.t1)} resolvedT2={resolveLabel(finalMatch.t2)} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="bracket-team-line" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: colors.textMuted }}>Vencedor Semi 1</span>
                      <div style={styles.bracketScoreField}></div>
                    </div>
                    <div className="bracket-team-line" style={{ paddingTop: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: colors.textMuted }}>Vencedor Semi 2</span>
                      <div style={styles.bracketScoreField}></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="final-third-box">
                <div style={{ fontSize: '9px', fontWeight: '700', color: colors.textMuted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center' }}>
                  Disputa do 3º Lugar
                </div>
                {thirdMatch ? (
                  <BracketMatchCard match={thirdMatch} resolvedT1={resolveLabel(thirdMatch.t1)} resolvedT2={resolveLabel(thirdMatch.t2)} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="bracket-team-line">
                      <span style={{ fontSize: '12px', color: colors.textMuted }}>Perdedor Semi 1</span>
                      <div style={{ ...styles.bracketScoreField, width: '18px', height: '18px', fontSize: '10px' }}></div>
                    </div>
                    <div className="bracket-team-line">
                      <span style={{ fontSize: '12px', color: colors.textMuted }}>Perdedor Semi 2</span>
                      <div style={{ ...styles.bracketScoreField, width: '18px', height: '18px', fontSize: '10px' }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chave direita */}
            <div className="bracket-side-column">
              <div style={{ ...styles.sectionTitle, textAlign: 'right' }}>Chave Direita</div>
              {rightMatches.length === 0 ? (
                <div style={{ fontSize: '12px', color: colors.textMuted, padding: '12px 0', textAlign: 'right' }}>Jogos ainda não definidos.</div>
              ) : (() => {
                const items = [];
                for (let i = 0; i < rightMatches.length; i += 2) {
                  if (i > 0) items.push(
                    <div key={`sep-r-${i}`} style={{ height: '1px', background: 'rgba(245,197,24,0.12)', margin: '6px 0' }} />
                  );
                  items.push(<BracketMatchCard key={rightMatches[i].id} match={rightMatches[i]} resolvedT1={resolveLabel(rightMatches[i].t1)} resolvedT2={resolveLabel(rightMatches[i].t2)} />);
                  if (rightMatches[i + 1]) {
                    items.push(<BracketMatchCard key={rightMatches[i+1].id} match={rightMatches[i+1]} resolvedT1={resolveLabel(rightMatches[i+1].t1)} resolvedT2={resolveLabel(rightMatches[i+1].t2)} />);
                  }
                }
                return items;
              })()}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}


// ─── COMPONENTE: Times Invictos ──────────────────────────────────────────────
function UnbeatenTeams({ groups, knockoutMatches = [] }) {
  const stats = {};

  const processMatch = (m) => {
    if (m.s1 === null || m.s2 === null) return;
    [m.t1, m.t2].forEach(name => {
      if (!stats[name]) stats[name] = { played: 0, lost: 0, won: 0, drawn: 0, gf: 0, ga: 0 };
    });
    stats[m.t1].played++; stats[m.t2].played++;
    stats[m.t1].gf += m.s1; stats[m.t1].ga += m.s2;
    stats[m.t2].gf += m.s2; stats[m.t2].ga += m.s1;
    if (m.s1 > m.s2)      { stats[m.t1].won++;  stats[m.t2].lost++; }
    else if (m.s1 < m.s2) { stats[m.t2].won++;  stats[m.t1].lost++; }
    else if (m.pen1 != null && m.pen2 != null && m.pen1 !== m.pen2) {
      // Pênaltis: nenhum time é marcado como "lost" (ambos continuam invictos no tempo normal)
      if (m.pen1 > m.pen2) stats[m.t1].won++; else stats[m.t2].won++;
    } else {
      stats[m.t1].drawn++; stats[m.t2].drawn++;
    }
  };

  groups.forEach(g => g.matches.forEach(processMatch));
  knockoutMatches.forEach(processMatch);

  const unbeaten = Object.entries(stats)
    .filter(([, s]) => s.played > 0 && s.lost === 0)
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => {
      const pctA = a.won / a.played;
      const pctB = b.won / b.played;
      if (pctB !== pctA) return pctB - pctA;
      if (b.won !== a.won) return b.won - a.won;
      const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });

  const gold      = '#F5C518';
  const navyMid   = '#1E2D45';
  const textMuted = '#8DA3C4';
  const offWhite  = '#E8EDF5';
  const green     = '#4CAF84';

  if (unbeaten.length === 0) return null;

  const badgeStyle = (label, bg, color) => (
    <span style={{
      fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px',
      padding: '2px 6px', borderRadius: '4px',
      background: bg, color,
    }}>{label}</span>
  );

  const getRecord = (t) => {
    const parts = [];
    if (t.won   > 0) parts.push(`${t.won}V`);
    if (t.drawn > 0) parts.push(`${t.drawn}E`);
    return parts.join(' · ') || '—';
  };

  return (
    <div style={{
      width: '100%', maxWidth: '600px',
      padding: '0 16px', boxSizing: 'border-box',
      marginTop: '12px', margin: '12px auto 0',
      animation: 'fadeSlideIn 0.5s ease 0.4s both',
    }}>
      <div style={{
        background: navyMid,
        border: '1px solid rgba(76,175,132,0.2)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        {/* Cabeçalho */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: '11px', fontWeight: '800', letterSpacing: '2px',
            color: textMuted, textTransform: 'uppercase',
          }}>Times Invictos</span>
          <div style={{
            background: 'rgba(76,175,132,0.15)',
            border: '1px solid rgba(76,175,132,0.3)',
            borderRadius: '20px',
            padding: '3px 10px',
            fontSize: '12px', fontWeight: '800', color: green,
          }}>
            {unbeaten.length} {unbeaten.length === 1 ? 'seleção' : 'seleções'}
          </div>
        </div>

        {/* Lista com scroll — altura fixa mostrando ~4 itens */}
        <div style={{
          maxHeight: '196px',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
        }}>
          {unbeaten.map((t, i) => {
            const isAllWins = t.drawn === 0 && t.won === t.played;
            const gd = t.gf - t.ga;
            return (
              <div key={t.name} style={{
                display: 'flex', alignItems: 'center',
                padding: '9px 18px',
                gap: '12px',
                borderBottom: i < unbeaten.length - 1
                  ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <div style={{
                  width: '18px', flexShrink: 0, textAlign: 'center',
                  fontSize: '11px', fontWeight: '800',
                  color: i === 0 ? gold : textMuted,
                }}>{i + 1}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px', fontWeight: '700', color: offWhite,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: '3px',
                  }}>{t.name}</div>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {isAllWins
                      ? badgeStyle('100% vitórias', 'rgba(76,175,132,0.18)', green)
                      : badgeStyle(getRecord(t), 'rgba(255,255,255,0.07)', textMuted)
                    }
                    {t.gf > 0 && badgeStyle(
                      `${t.gf} gol${t.gf > 1 ? 's' : ''}`,
                      'rgba(245,197,24,0.1)', gold
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '11px', color: textMuted, marginBottom: '2px' }}>
                    {t.played} jogo{t.played > 1 ? 's' : ''}
                  </div>
                  <div style={{
                    fontSize: '12px', fontWeight: '700',
                    color: gd > 0 ? green : gd < 0 ? '#C41E3A' : textMuted,
                  }}>
                    {gd > 0 ? `+${gd}` : gd} SG
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ─── COMPONENTE: Cards de Estatísticas de Gols ───────────────────────────────
function GoalStatsSection({ groups, knockoutMatches = [] }) {
  // Agrega stats por time a partir dos jogos disputados (fase de grupos + mata-mata)
  const teamStats = {};
  groups.forEach(g => {
    g.matches.forEach(m => {
      if (m.s1 === null || m.s2 === null) return;
      [m.t1, m.t2].forEach(name => { if (!teamStats[name]) teamStats[name] = { gf: 0, ga: 0 }; });
      teamStats[m.t1].gf += m.s1;
      teamStats[m.t1].ga += m.s2;
      teamStats[m.t2].gf += m.s2;
      teamStats[m.t2].ga += m.s1;
    });
  });
  // Inclui gols do mata-mata no ranking de times
  knockoutMatches.forEach(m => {
    if (m.s1 === null || m.s2 === null) return;
    [m.t1, m.t2].forEach(name => { if (name && !teamStats[name]) teamStats[name] = { gf: 0, ga: 0 }; });
    if (m.t1 && teamStats[m.t1]) { teamStats[m.t1].gf += m.s1; teamStats[m.t1].ga += m.s2; }
    if (m.t2 && teamStats[m.t2]) { teamStats[m.t2].gf += m.s2; teamStats[m.t2].ga += m.s1; }
  });

  const allTeams = Object.entries(teamStats).map(([name, s]) => ({ name, ...s }));
  const top5Scored   = [...allTeams].sort((a, b) => b.gf - a.gf || a.ga - b.ga).slice(0, 5);
  const top5Conceded = [...allTeams].sort((a, b) => b.ga - a.ga || a.gf - b.gf).slice(0, 5);

  let totalGoals = 0;
  let playedCount = 0;
  groups.forEach(g => g.matches.forEach(m => {
    if (m.s1 !== null && m.s2 !== null) { totalGoals += m.s1 + m.s2; playedCount++; }
  }));
  // Soma gols do mata-mata no total
  knockoutMatches.forEach(m => {
    if (m.s1 !== null && m.s2 !== null) { totalGoals += m.s1 + m.s2; playedCount++; }
  });
  const avg = playedCount > 0 ? (totalGoals / playedCount).toFixed(1) : '—';

  const gold = '#F5C518';
  const navy = '#0A1628';
  const navyMid = '#1E2D45';
  const textMuted = '#8DA3C4';
  const offWhite = '#E8EDF5';
  const red = '#C41E3A';
  const green = '#4CAF84';

  const sectionLabel = {
    fontSize: '11px', fontWeight: '700', letterSpacing: '2px',
    color: textMuted, textTransform: 'uppercase', marginBottom: '12px',
    marginTop: '6px',
  };

  const rankRow = (item, i, valueKey, accentColor) => (
    <div key={item.name} style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '7px 0',
      borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none',
    }}>
      {/* Posição */}
      <div style={{
        width: '20px', textAlign: 'center',
        fontSize: '11px', fontWeight: '800',
        color: i === 0 ? gold : textMuted,
        flexShrink: 0,
      }}>{i + 1}</div>

      {/* Barra de progresso */}
      {(() => {
        const maxVal = (valueKey === 'gf' ? top5Scored : top5Conceded)[0][valueKey];
        const pct = maxVal > 0 ? (item[valueKey] / maxVal) * 100 : 0;
        return (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '12px', fontWeight: '600', color: offWhite,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: '3px',
            }}>{item.name}</div>
            <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.07)' }}>
              <div style={{
                height: '100%', borderRadius: '2px',
                width: `${pct}%`,
                background: accentColor,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        );
      })()}

      {/* Valor */}
      <div style={{
        fontSize: '16px', fontWeight: '900',
        color: i === 0 ? accentColor : offWhite,
        minWidth: '24px', textAlign: 'right', flexShrink: 0,
      }}>{item[valueKey]}</div>
    </div>
  );

  return (
    <div style={{
      width: '100%', maxWidth: '600px',
      padding: '0 16px', boxSizing: 'border-box',
      marginTop: '20px',
      animation: 'fadeSlideIn 0.5s ease 0.35s both',
    }}>
      {/* Card: Total de Gols */}
      <div style={{
        background: navyMid,
        border: `1px solid rgba(245,197,24,0.2)`,
        borderRadius: '12px', padding: '18px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '2px', color: textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>
            Gols no Torneio
          </div>
          <div style={{ fontSize: '36px', fontWeight: '900', color: offWhite, lineHeight: 1 }}>
            {totalGoals}
            <span style={{ fontSize: '14px', fontWeight: '600', color: textMuted, marginLeft: '8px' }}>gols</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '2px', color: textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>
            Média / Jogo
          </div>
          <div style={{ fontSize: '36px', fontWeight: '900', color: gold, lineHeight: 1 }}>
            {avg}
          </div>
        </div>
      </div>
    </div>
  );
}



// ─── PARSER: aba Jogadores ────────────────────────────────────────────────────
function parseJogadoresCSV(csv) {
  if (!csv) return [];
  const lines = csv.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(s => s.trim().toLowerCase());

  const col = (name) => headers.indexOf(name.toLowerCase());

  return lines.slice(1).map(line => {
    const cols = line.split(sep).map(s => s.trim());
    const num = (i) => i !== -1 && cols[i] !== '' ? parseFloat(cols[i]) || 0 : 0;
    return {
      selecao:        cols[col('seleção')]    || cols[col('selecao')]  || '',
      jogador:        cols[col('jogador')]    || '',
      gols:           num(col('gols')),
      xg:             num(col('xg')),
      assistencias:   num(col('assist')),
      golsHistoricos: num(col('gols na copa')),
      jogos:          num(col('jogos na copa')),
      jogosCopa:      num(col('jogos')),
    };
  }).filter(j => j.jogador);
}

// ─── COMPONENTE: Página de Curiosidades ───────────────────────────────────────
function CuriosidadesPage({ onBack, groups = [], knockoutMatches = [] }) {
  const [jogadores, setJogadores] = useState([]);
  const [loadingJogadores, setLoadingJogadores] = useState(true);
  const [activeTab, setActiveTab] = useState('copa2026');
  const [timelineSelected, setTimelineSelected] = useState(null);

  useEffect(() => {
    fetch(JOGADORES_CSV_URL)
      .then(r => r.text())
      .then(csv => { setJogadores(parseJogadoresCSV(csv)); setLoadingJogadores(false); })
      .catch(() => setLoadingJogadores(false));
    const id = setInterval(() =>
      fetch(JOGADORES_CSV_URL).then(r => r.text()).then(csv => setJogadores(parseJogadoresCSV(csv))).catch(() => {})
    , 60000);
    return () => clearInterval(id);
  }, []);

  const gold     = colors.gold;
  const navy     = colors.navy;
  const navyMid  = colors.navyMid;
  const textMuted = colors.textMuted;
  const white    = colors.white;
  const offWhite = colors.offWhite;

  const mbappe = jogadores.find(j => j.jogador.toLowerCase().includes('mbapp')) || { gols: 0, xg: 0, assistencias: 0, golsHistoricos: 0 };
  const messi  = jogadores.find(j => j.jogador.toLowerCase().includes('messi'))  || { gols: 0, xg: 0, assistencias: 0, golsHistoricos: 0 };

  // ── Sub-componentes reutilizáveis ────────────────────────────────────────────
  const StatRow = ({ label, value, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: '11px', fontWeight: '600', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ fontSize: '18px', fontWeight: '900', color: color || white }}>{value}</span>
    </div>
  );

  const MbappeName = () => (
    <div style={{ fontSize: '22px', fontWeight: '900', textAlign: 'center', letterSpacing: '1px', lineHeight: 1.1, marginBottom: '16px' }}>
      <span style={{ color: '#0055A4' }}>Mb</span><span style={{ color: '#FFFFFF', textShadow: '0 0 8px rgba(255,255,255,0.3)' }}>ap</span><span style={{ color: '#EF4135' }}>pé</span>
    </div>
  );

  const MessiName = () => (
    <div style={{ fontSize: '22px', fontWeight: '900', textAlign: 'center', letterSpacing: '1px', lineHeight: 1.1, marginBottom: '16px' }}>
      <span style={{ color: '#74ACDF' }}>Me</span><span style={{ color: '#FFFFFF', textShadow: '0 0 8px rgba(255,255,255,0.3)' }}>ss</span><span style={{ color: '#74ACDF' }}>i</span>
    </div>
  );

  const PlayerCard = ({ name: NameComponent, data, accentColor }) => (
    <div style={{ flex: 1, background: navyMid, border: `1px solid ${accentColor}22`, borderRadius: '12px', padding: '20px 16px', boxShadow: `0 8px 28px rgba(0,0,0,0.3), inset 0 1px 0 ${accentColor}18`, minWidth: 0 }}>
      <NameComponent />
      <StatRow label="Gols nesta Copa" value={<span>{data.gols} <span style={{ fontSize: '11px', fontWeight: '600', color: textMuted }}>({data.jogosCopa} jogos)</span></span>} color={gold} />
      <StatRow label="xG"          value={data.xg?.toFixed(1) ?? '—'} color={offWhite} />
      <StatRow label="Assistências" value={data.assistencias}          color={offWhite} />
      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${accentColor}30`, textAlign: 'center' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Gols em Copas do Mundo</div>
        <div style={{ fontSize: '28px', fontWeight: '900', color: accentColor }}>
          {data.golsHistoricos}
          <span style={{ fontSize: '13px', fontWeight: '600', color: textMuted, marginLeft: '6px' }}>({data.jogos} jogos)</span>
        </div>
      </div>
    </div>
  );

  // ── ABA 1: Copa 2026 ─────────────────────────────────────────────────────────
  const TabCopa2026 = () => {
    // Recordes dinâmicos
    const todosJogos = [];
    groups.forEach(g => { g.matches.forEach(m => { if (m.s1 !== null && m.s2 !== null) todosJogos.push({ ...m, fase: `Grupo ${g.id}` }); }); });
    knockoutMatches.forEach(m => { if (m.s1 !== null && m.s2 !== null) todosJogos.push({ ...m, fase: m.fase || 'Mata-mata' }); });

    const maiorGoleada = todosJogos.length > 0 ? [...todosJogos].sort((a, b) => { const da = Math.abs(a.s1-a.s2), db = Math.abs(b.s1-b.s2); return db !== da ? db - da : (b.s1+b.s2)-(a.s1+a.s2); })[0] : null;
    const maisGols     = todosJogos.length > 0 ? [...todosJogos].sort((a,b) => (b.s1+b.s2)-(a.s1+a.s2))[0] : null;

    const golsPorSelecao = {}, golsSofridos = {}, empatesPor = {}, placarCount = {};
    todosJogos.forEach(m => {
      golsPorSelecao[m.t1] = (golsPorSelecao[m.t1]||0) + m.s1;
      golsPorSelecao[m.t2] = (golsPorSelecao[m.t2]||0) + m.s2;
      golsSofridos[m.t1]   = (golsSofridos[m.t1]||0)   + m.s2;
      golsSofridos[m.t2]   = (golsSofridos[m.t2]||0)   + m.s1;
      if (m.s1 === m.s2) { empatesPor[m.t1]=(empatesPor[m.t1]||0)+1; empatesPor[m.t2]=(empatesPor[m.t2]||0)+1; }
      const key = m.s1 >= m.s2 ? `${m.s1}×${m.s2}` : `${m.s2}×${m.s1}`;
      placarCount[key] = (placarCount[key]||0) + 1;
    });
    const [melhorAtaque, golsMelhorAtaque] = Object.entries(golsPorSelecao).sort((a,b)=>b[1]-a[1])[0] || ['—',0];
    const [melhorDefesa, golsMelhorDefesa] = Object.entries(golsSofridos).sort((a,b)=>a[1]-b[1])[0]   || ['—',0];
    const [placarFreq, qtdFreq]            = Object.entries(placarCount).sort((a,b)=>b[1]-a[1])[0]    || ['—',0];
    const maiorEmpate = todosJogos.filter(m=>m.s1===m.s2&&m.s1>0).sort((a,b)=>(b.s1+b.s2)-(a.s1+a.s2))[0]||null;
    const totalGols   = todosJogos.reduce((acc,m)=>acc+m.s1+m.s2,0);
    const mediaGols   = todosJogos.length > 0 ? (totalGols/todosJogos.length).toFixed(1) : '—';

    const RecordCard = ({ label, valor, sub }) => (
      <div style={{ background: navyMid, border: `1px solid ${gold}20`, borderLeft: `3px solid ${gold}`, borderRadius: '10px', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '9px', fontWeight: '800', color: gold, textTransform: 'uppercase', letterSpacing: '1.5px' }}>{label}</div>
        <div style={{ fontSize: '16px', fontWeight: '900', color: white, lineHeight: 1.15 }}>{valor}</div>
        {sub && <div style={{ fontSize: '10px', fontWeight: '600', color: textMuted, lineHeight: 1.4 }}>{sub}</div>}
      </div>
    );

    // Artilheiros e garçons
    const selecaoGols = {};
    groups.forEach(g => { g.matches.forEach(m => { if (m.s1!==null&&m.s2!==null) { selecaoGols[m.t1]=(selecaoGols[m.t1]||0)+m.s1; selecaoGols[m.t2]=(selecaoGols[m.t2]||0)+m.s2; } }); });
    const sorted = (arr, key) => [...arr].sort((a,b)=>{ if(b[key]!==a[key]) return b[key]-a[key]; return (selecaoGols[a.selecao]||0)-(selecaoGols[b.selecao]||0); }).slice(0,6);
    const artilheiros = sorted(jogadores,'gols');
    const garcons     = sorted(jogadores,'assistencias');

    const ListCard = ({ titulo, subtitulo, lista, valueKey, label }) => (
      <div style={{ flex:1, background:navyMid, border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'16px', minWidth:0 }}>
        <div style={{ textAlign:'center', marginBottom:'14px' }}>
          <div style={{ fontSize:'11px', fontWeight:'800', color:gold, textTransform:'uppercase', letterSpacing:'1.5px' }}>{titulo}</div>
          {subtitulo && <div style={{ fontSize:'9px', fontWeight:'600', color:textMuted, marginTop:'3px' }}>{subtitulo}</div>}
        </div>
        {lista.length===0 ? <div style={{ fontSize:'12px',color:textMuted,textAlign:'center',padding:'20px 0' }}>Sem dados</div>
        : lista.map((j,i)=>(
          <div key={j.jogador+i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 0', borderBottom:i<lista.length-1?'1px solid rgba(255,255,255,0.05)':'none' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', minWidth:0 }}>
              <span style={{ fontSize:'11px', fontWeight:'800', color:i===0?gold:textMuted, width:'16px', flexShrink:0 }}>{i+1}</span>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:'13px', fontWeight:'700', color:i===0?gold:white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{j.jogador}</div>
                <div style={{ fontSize:'10px', color:textMuted, marginTop:'1px' }}>{j.selecao}</div>
              </div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0, marginLeft:'8px' }}>
              <span style={{ fontSize:'18px', fontWeight:'900', color:i===0?gold:offWhite }}>{j[valueKey]}</span>
              <div style={{ fontSize:'9px', color:textMuted, textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>
    );

    // CR7
    const cr7Copas = [
      { ano:2006, bandeira:'DE', jogos:6,  gols:1 },
      { ano:2010, bandeira:'ZA', jogos:4,  gols:1 },
      { ano:2014, bandeira:'BR', jogos:3,  gols:1 },
      { ano:2018, bandeira:'RU', jogos:4,  gols:4 },
      { ano:2022, bandeira:'QA', jogos:5,  gols:1 },
      { ano:2026, bandeira:'US', jogos:null, gols:null },
    ];
    const accentCR7 = '#CC0000';
    const cr7atual  = jogadores.find(j=>j.jogador.toLowerCase().includes('ronaldo'));
    const totalGolsCR7  = cr7Copas.slice(0,5).reduce((acc,c)=>acc+(c.gols||0),0)+(cr7atual?.gols||0);
    const totalJogosCR7 = cr7Copas.slice(0,5).reduce((acc,c)=>acc+(c.jogos||0),0)+(cr7atual?.jogosCopa||0);

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'28px' }}>

        {/* Messi × Mbappé */}
        <div>
          <div style={{ textAlign:'center', marginBottom:'16px' }}>
            <div style={{ fontSize:'14px', fontWeight:'800', color:gold, textTransform:'uppercase', letterSpacing:'2px', marginBottom:'6px' }}>Em busca da história</div>
            <div style={{ fontSize:'12px', fontWeight:'500', color:textMuted, lineHeight:1.5 }}>Quem será o maior artilheiro de todos os tempos em Copas do Mundo?</div>
          </div>
          {loadingJogadores ? (
            <div style={{ textAlign:'center', color:textMuted, fontSize:'13px', padding:'40px 0' }}>Carregando dados...</div>
          ) : (
            <div style={{ display:'flex', alignItems:'stretch', gap:'0', width:'100%' }}>
              <PlayerCard name={MbappeName} data={mbappe} accentColor="#0055A4" />
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, width:'52px', fontSize:'20px', fontWeight:'900', color:textMuted }}>×</div>
              <PlayerCard name={MessiName}  data={messi}  accentColor="#74ACDF" />
            </div>
          )}
        </div>

        {/* CR7 */}
        {(() => {
          return (
            <div>
              <div style={{ textAlign:'center', marginBottom:'16px' }}>
                <div style={{ fontSize:'14px', fontWeight:'800', color:gold, textTransform:'uppercase', letterSpacing:'2px', marginBottom:'6px' }}>Um feito único na história</div>
                <div style={{ fontSize:'12px', fontWeight:'500', color:textMuted, lineHeight:1.5 }}>Único jogador a marcar em <span style={{ color:gold, fontWeight:'800' }}>6 Copas do Mundo</span> diferentes</div>
              </div>
              <div style={{ background:navyMid, border:`1px solid ${accentCR7}22`, borderRadius:'12px', padding:'14px 16px', boxShadow:`0 8px 28px rgba(0,0,0,0.3)` }}>
                <div style={{ fontSize:'22px', fontWeight:'900', textAlign:'center', letterSpacing:'1px', lineHeight:1.1, marginBottom:'14px' }}>
                  <span style={{ color:'#006600' }}>Cristiano</span>{' '}<span style={{ color:'#CC0000' }}>Ronaldo</span>
                </div>
                {cr7atual && (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize:'11px', fontWeight:'600', color:textMuted, textTransform:'uppercase', letterSpacing:'0.5px' }}>Gols nesta Copa</span>
                      <span style={{ fontSize:'18px', fontWeight:'900', color:gold }}>{cr7atual.gols}<span style={{ fontSize:'11px', fontWeight:'600', color:textMuted, marginLeft:'6px' }}>({cr7atual.jogosCopa} jogos)</span></span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize:'11px', fontWeight:'600', color:textMuted, textTransform:'uppercase', letterSpacing:'0.5px' }}>Assistências</span>
                      <span style={{ fontSize:'18px', fontWeight:'900', color:white }}>{cr7atual.assistencias}</span>
                    </div>
                  </>
                )}
                <div style={{ marginTop:'10px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                    <div style={{ fontSize:'10px', fontWeight:'700', color:textMuted, textTransform:'uppercase', letterSpacing:'1px' }}>Gols em Copas do Mundo</div>
                    <div><span style={{ fontSize:'28px', fontWeight:'900', color:accentCR7 }}>{totalGolsCR7}</span><span style={{ fontSize:'13px', fontWeight:'600', color:textMuted, marginLeft:'6px' }}>({totalJogosCR7} jogos)</span></div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
                    {cr7Copas.map(c => {
                      const isAtual = c.ano===2026;
                      const gols  = isAtual ? (cr7atual?.gols??null)       : c.gols;
                      const jogos = isAtual ? (cr7atual?.jogosCopa??null)   : c.jogos;
                      const pct   = gols ? Math.min((gols/4)*100,100) : 0;
                      return (
                        <div key={c.ano} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <div style={{ width:'74px', flexShrink:0, display:'flex', alignItems:'center', gap:'5px' }}>
                            <FlagIcon code={c.bandeira} size="14px" />
                            <span style={{ fontSize:'11px', fontWeight:'800', color:isAtual?gold:offWhite }}>{c.ano}</span>
                          </div>
                          <div style={{ flex:1, height:'6px', background:'rgba(255,255,255,0.06)', borderRadius:'3px', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`, background:isAtual?gold:accentCR7, borderRadius:'3px', transition:'width 0.4s ease' }} />
                          </div>
                          <div style={{ width:'90px', flexShrink:0, textAlign:'right', whiteSpace:'nowrap' }}>
                            <span style={{ fontSize:'12px', fontWeight:'900', color:isAtual?gold:(gols>1?accentCR7:offWhite) }}>{gols??'—'} <span style={{ fontSize:'9px', color:textMuted, fontWeight:'600' }}>{gols!=null?(gols===1?'gol':'gols'):''}</span></span>
                            {jogos!=null && <span style={{ fontSize:'9px', color:textMuted, fontWeight:'600', marginLeft:'4px' }}>({jogos} {jogos===1?'jogo':'jogos'})</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Artilheiros & Garçons */}
        {!loadingJogadores && (
          <div>
            <div style={{ display:'flex', gap:'16px', width:'100%', alignItems:'flex-start' }}>
              <ListCard titulo="Artilheiros" subtitulo="Jogadores com mais gols nessa Copa" lista={artilheiros} valueKey="gols"         label="gols" />
              <ListCard titulo="Garçons"     subtitulo="Jogadores com mais assistências"    lista={garcons}     valueKey="assistencias"  label="assist" />
            </div>
          </div>
        )}

        {/* Gols no Torneio */}
        {(() => {
          const teamStats = {};
          groups.forEach(g => {
            g.matches.forEach(m => {
              if (m.s1 === null || m.s2 === null) return;
              [m.t1, m.t2].forEach(name => { if (!teamStats[name]) teamStats[name] = { gf: 0, ga: 0 }; });
              teamStats[m.t1].gf += m.s1; teamStats[m.t1].ga += m.s2;
              teamStats[m.t2].gf += m.s2; teamStats[m.t2].ga += m.s1;
            });
          });
          knockoutMatches.forEach(m => {
            if (m.s1 === null || m.s2 === null) return;
            [m.t1, m.t2].forEach(name => { if (name && !teamStats[name]) teamStats[name] = { gf: 0, ga: 0 }; });
            if (m.t1 && teamStats[m.t1]) { teamStats[m.t1].gf += m.s1; teamStats[m.t1].ga += m.s2; }
            if (m.t2 && teamStats[m.t2]) { teamStats[m.t2].gf += m.s2; teamStats[m.t2].ga += m.s1; }
          });

          const allTeams = Object.entries(teamStats).map(([name, s]) => ({ name, ...s }));
          const top5Scored   = [...allTeams].sort((a, b) => b.gf - a.gf || a.ga - b.ga).slice(0, 5);
          const top5Conceded = [...allTeams].sort((a, b) => b.ga - a.ga || a.gf - b.gf).slice(0, 5);

          let totalGoals = 0, playedCount = 0;
          groups.forEach(g => g.matches.forEach(m => {
            if (m.s1 !== null && m.s2 !== null) { totalGoals += m.s1 + m.s2; playedCount++; }
          }));
          knockoutMatches.forEach(m => {
            if (m.s1 !== null && m.s2 !== null) { totalGoals += m.s1 + m.s2; playedCount++; }
          });
          const avg = playedCount > 0 ? (totalGoals / playedCount).toFixed(1) : '—';

          if (allTeams.length === 0) return null;

          const green = '#4CAF84';
          const red   = '#C41E3A';

          const sectionLabel = {
            fontSize: '11px', fontWeight: '700', letterSpacing: '2px',
            color: textMuted, textTransform: 'uppercase', marginBottom: '12px', marginTop: '6px',
          };

          const rankRow = (item, i, valueKey, accentColor, top5) => (
            <div key={item.name} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '7px 0',
              borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}>
              <div style={{ width: '20px', textAlign: 'center', fontSize: '11px', fontWeight: '800', color: i === 0 ? gold : textMuted, flexShrink: 0 }}>{i + 1}</div>
              {(() => {
                const maxVal = top5[0][valueKey];
                const pct = maxVal > 0 ? (item[valueKey] / maxVal) * 100 : 0;
                return (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', color: offWhite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px' }}>{item.name}</div>
                    <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.07)' }}>
                      <div style={{ height: '100%', borderRadius: '2px', width: `${pct}%`, background: accentColor, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                );
              })()}
              <div style={{ fontSize: '16px', fontWeight: '900', color: i === 0 ? accentColor : offWhite, minWidth: '24px', textAlign: 'right', flexShrink: 0 }}>{item[valueKey]}</div>
            </div>
          );

          return (
            <div>
              {/* Card: Total de Gols */}
              <div style={{
                background: navyMid, border: `1px solid rgba(245,197,24,0.2)`,
                borderRadius: '12px', padding: '18px 20px', marginBottom: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '2px', color: textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Gols no Torneio</div>
                  <div style={{ fontSize: '36px', fontWeight: '900', color: offWhite, lineHeight: 1 }}>
                    {totalGoals}<span style={{ fontSize: '14px', fontWeight: '600', color: textMuted, marginLeft: '8px' }}>gols</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '2px', color: textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>Média / Jogo</div>
                  <div style={{ fontSize: '36px', fontWeight: '900', color: gold, lineHeight: 1 }}>{avg}</div>
                </div>
              </div>

              {/* Cards Top 5: lado a lado */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1, background: navyMid, border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px', minWidth: 0 }}>
                  <div style={sectionLabel}>Mais Gols Marcados</div>
                  {top5Scored.length === 0
                    ? <div style={{ fontSize: '12px', color: textMuted }}>Nenhum jogo disputado</div>
                    : top5Scored.map((t, i) => rankRow(t, i, 'gf', green, top5Scored))}
                </div>
                <div style={{ flex: 1, background: navyMid, border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '16px', minWidth: 0 }}>
                  <div style={sectionLabel}>Mais Gols Sofridos</div>
                  {top5Conceded.length === 0
                    ? <div style={{ fontSize: '12px', color: textMuted }}>Nenhum jogo disputado</div>
                    : top5Conceded.map((t, i) => rankRow(t, i, 'ga', red, top5Conceded))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Seleções Invictas */}
        <UnbeatenTeams groups={groups} knockoutMatches={knockoutMatches} />

        {/* Recordes da Copa 2026 */}
        {todosJogos.length > 0 && (
          <div>
            <div style={{ textAlign:'center', marginBottom:'16px' }}>
              <div style={{ fontSize:'14px', fontWeight:'800', color:gold, textTransform:'uppercase', letterSpacing:'2px', marginBottom:'4px' }}>Recordes da Copa 2026</div>
              <div style={{ fontSize:'11px', color:textMuted, fontWeight:'500' }}>{todosJogos.length} {todosJogos.length===1?'jogo disputado':'jogos disputados'} · {totalGols} gols · média de {mediaGols} por jogo</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              {maiorGoleada && <RecordCard label="Maior goleada"         valor={`${maiorGoleada.t1} ${maiorGoleada.s1}×${maiorGoleada.s2} ${maiorGoleada.t2}`} sub={maiorGoleada.fase} />}
              {maisGols     && <RecordCard label="Jogo com mais gols"    valor={`${maisGols.s1+maisGols.s2} gols`} sub={`${maisGols.t1} ${maisGols.s1}×${maisGols.s2} ${maisGols.t2}`} />}
              <RecordCard label="Melhor ataque"      valor={melhorAtaque} sub={`${golsMelhorAtaque} gols marcados`} />
              <RecordCard label="Melhor defesa"      valor={melhorDefesa} sub={`${golsMelhorDefesa===0?'Invicta — 0':golsMelhorDefesa} gol${golsMelhorDefesa===1?'':'s'} sofrido${golsMelhorDefesa===1?'':'s'}`} />
              <RecordCard label="Placar mais comum"  valor={placarFreq}   sub={`${qtdFreq} ${qtdFreq===1?'vez':'vezes'} nessa Copa`} />
              <RecordCard label="Empate mais movimentado" valor={maiorEmpate?`${maiorEmpate.s1}×${maiorEmpate.s2}`:'—'} sub={maiorEmpate?`${maiorEmpate.t1} e ${maiorEmpate.t2}`:'Nenhum empate com gols ainda'} />
            </div>
          </div>
        )}

        {/* Recordes históricos quebrados nesta Copa */}
        {(() => {
          // ── Maior artilheiro de todas as Copas (Klose, 16 gols, até 2022) ──
          const KLOSE_RECORDE = 16;
          const messiHist  = messi.golsHistoricos  || 0;
          const mbappeHist = mbappe.golsHistoricos || 0;
          const maiorHist  = Math.max(messiHist, mbappeHist);
          const artilheiroQuebrouRecorde = maiorHist > KLOSE_RECORDE;
          let nomeArtilheiroRecorde = '';
          if (artilheiroQuebrouRecorde) {
            if (messiHist === mbappeHist) nomeArtilheiroRecorde = 'Messi e Mbappé (empatados)';
            else nomeArtilheiroRecorde = messiHist > mbappeHist ? 'Messi' : 'Mbappé';
          }

          // ── Maior invencibilidade em Copas (Brasil, 13 jogos, 1958–1966) ──
          const HOLANDA_NOMES = ['Holanda', 'Países Baixos'];
          const HOLANDA_JOGOS_ANTES_2026 = 12; // sem perder no tempo normal entre a final de 2010 e o fim da Copa de 2022
          const RECORDE_INVENCIBILIDADE_ANTERIOR = 13; // Brasil, 1958–1966

          let holandaJogos2026 = 0;
          let holandaSeguesInvicta = true;
          todosJogos.forEach(m => {
            if (!holandaSeguesInvicta) return;
            const eHolanda1 = HOLANDA_NOMES.includes(m.t1);
            const eHolanda2 = HOLANDA_NOMES.includes(m.t2);
            if (!eHolanda1 && !eHolanda2) return;
            const golsHolanda     = eHolanda1 ? m.s1 : m.s2;
            const golsAdversario  = eHolanda1 ? m.s2 : m.s1;
            if (golsHolanda < golsAdversario) { holandaSeguesInvicta = false; return; }
            holandaJogos2026++;
          });
          const holandaSequenciaTotal = HOLANDA_JOGOS_ANTES_2026 + holandaJogos2026;
          const holandaQuebrouRecorde = holandaSeguesInvicta && holandaSequenciaTotal > RECORDE_INVENCIBILIDADE_ANTERIOR;

          if (!artilheiroQuebrouRecorde && !holandaQuebrouRecorde) return null;

          return (
            <div>
              <div style={{ textAlign:'center', marginBottom:'16px' }}>
                <div style={{ fontSize:'14px', fontWeight:'800', color:gold, textTransform:'uppercase', letterSpacing:'2px', marginBottom:'4px' }}>Recordes Históricos Quebrados</div>
                <div style={{ fontSize:'11px', color:textMuted, fontWeight:'500' }}>Marcas de todas as edições da Copa do Mundo superadas em 2026</div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                {artilheiroQuebrouRecorde && (
                  <RecordCard
                    label="Maior artilheiro de todas as Copas"
                    valor={`${nomeArtilheiroRecorde} — ${maiorHist} gols`}
                    sub="Recorde anterior: Miroslav Klose — 16 gols (2002–2014)"
                  />
                )}
                {holandaQuebrouRecorde && (
                  <RecordCard
                    label="Maior invencibilidade em Copas"
                    valor={`Holanda — ${holandaSequenciaTotal} jogos sem perder`}
                    sub="Recorde anterior: Brasil — 13 jogos (1958–1966)"
                  />
                )}
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

  // ── ABA 2: História ──────────────────────────────────────────────────────────
  const TabHistoria = () => {
    const COPAS_TIMELINE = [
      { ano:1930, sede:'Uruguai',      bandeira:'UY', campeao:'Uruguai',    vice:'Argentina',    artilheiro:'Guillermo Stábile (8)',  gols:70,  jogos:18, sedes:['Montevidéu'], curiosidade:'A primeira Copa da história reuniu apenas 13 seleções. Nenhuma seleção europeia viajou de barco para participar, exceto 4 países. A França e os EUA chegaram de navio!' },
      { ano:1934, sede:'Itália',       bandeira:'IT', campeao:'Itália',     vice:'Tchecoslováquia', artilheiro:'Oldřich Nejedlý (5)', gols:70,  jogos:17, sedes:['Roma','Milão','Florença'], curiosidade:'Uruguai não participou em retaliação ao boicote europeu de 1930. A Itália venceu em casa sob o regime de Mussolini.' },
      { ano:1938, sede:'França',       bandeira:'FR', campeao:'Itália',     vice:'Hungria',      artilheiro:'Leônidas (7)',           gols:84,  jogos:18, sedes:['Paris','Marselha'], curiosidade:'Última Copa antes da 2ª Guerra Mundial. O Brasil ficou em 3º. Leônidas, o "Diamante Negro", se tornou o primeiro grande astro da Copa.' },
      { ano:1950, sede:'Brasil',       bandeira:'BR', campeao:'Uruguai',    vice:'Brasil',       artilheiro:'Ademir (9)',             gols:88,  jogos:22, sedes:['Rio de Janeiro','São Paulo'], curiosidade:'O "Maracanazo" — o Uruguai derrotou o Brasil no Maracanã diante de ~200 mil pessoas no jogo decisivo, gerando luto nacional.' },
      { ano:1954, sede:'Suíça',        bandeira:'CH', campeao:'Alemanha',   vice:'Hungria',      artilheiro:'Sándor Kocsis (11)',     gols:140, jogos:26, sedes:['Berna','Zurique','Basileia'], curiosidade:'Copa com maior média de gols da história: 5,38 gols/jogo. A Hungria era favorita e não perdeu até a final, onde perdeu para a Alemanha Ocidental.' },
      { ano:1958, sede:'Suécia',       bandeira:'SE', campeao:'Brasil',     vice:'Suécia',       artilheiro:'Just Fontaine (13)',     gols:126, jogos:35, sedes:['Estocolmo','Gotemburgo'], curiosidade:'Pelé, com 17 anos, marcou 6 gols e se tornou o jogador mais jovem a marcar numa final. Just Fontaine ainda detém o recorde de gols numa única Copa.' },
      { ano:1962, sede:'Chile',        bandeira:'CL', campeao:'Brasil',     vice:'Tchecoslováquia', artilheiro:'Garrincha (4) e outros', gols:89, jogos:32, sedes:['Santiago','Viña del Mar'], curiosidade:'Pelé se lesionou no 2º jogo e Garrincha carregou o Brasil à conquista. Considerada a Copa de Garrincha.' },
      { ano:1966, sede:'Inglaterra',   bandeira:'GB', campeao:'Inglaterra',  vice:'Alemanha',     artilheiro:'Eusébio (9)',            gols:89,  jogos:32, sedes:['Londres','Manchester','Liverpool'], curiosidade:'Única Copa da Inglaterra. Eusébio levou Portugal ao 3º lugar. O Brasil foi eliminado por Portugal 3×1 nas oitavas, encerrando a invencibilidade de 13 jogos.' },
      { ano:1970, sede:'México',       bandeira:'MX', campeao:'Brasil',     vice:'Itália',       artilheiro:'Gerd Müller (10)',       gols:95,  jogos:32, sedes:['Cidade do México','Guadalajara'], curiosidade:'Considerada a Copa mais bonita da história. O Brasil bicampeão venceu de forma avassaladora com Pelé, Rivelino, Tostão e Jairzinho, que marcou em todos os jogos.' },
      { ano:1974, sede:'Alemanha',     bandeira:'DE', campeao:'Alemanha',   vice:'Holanda',      artilheiro:'Grzegorz Lato (7)',      gols:97,  jogos:38, sedes:['Munique','Dortmund','Frankfurt'], curiosidade:'A Holanda de Johan Cruyff e o "Futebol Total" encantou o mundo mas perdeu a final em casa para a Alemanha Ocidental.' },
      { ano:1978, sede:'Argentina',    bandeira:'AR', campeao:'Argentina',  vice:'Holanda',      artilheiro:'Mario Kempes (6)',       gols:102, jogos:38, sedes:['Buenos Aires','Córdoba','Mendoza'], curiosidade:'Mario Kempes foi o único jogador do plantel que jogava no exterior. A Argentina venceu o torneio entre acusações de irregularidades políticas.' },
      { ano:1982, sede:'Espanha',      bandeira:'ES', campeao:'Itália',     vice:'Alemanha',     artilheiro:'Paolo Rossi (6)',        gols:146, jogos:52, sedes:['Barcelona','Madri','Sevilha'], curiosidade:'Itália venceu com Paolo Rossi, que voltou de suspensão por escândalo de apostas. A maior goleada da história: Hungria 10×1 El Salvador.' },
      { ano:1986, sede:'México',       bandeira:'MX', campeao:'Argentina',  vice:'Alemanha',     artilheiro:'Gary Lineker (6)',       gols:132, jogos:52, sedes:['Cidade do México','Puebla','Monterrey'], curiosidade:'A Copa de Maradona — "La Mano de Dios" e o "Gol do Século" contra a Inglaterra tornaram-se os momentos mais icônicos da história.' },
      { ano:1990, sede:'Itália',       bandeira:'IT', campeao:'Alemanha',   vice:'Argentina',    artilheiro:'Salvatore Schillaci (6)', gols:115, jogos:52, sedes:['Roma','Milão','Turim'], curiosidade:'Copa com menor média de gols (2,21). Schillaci saiu do banco e venceu artilharia e Bola de Ouro. A Alemanha derrotou a Argentina por 1×0 na final.' },
      { ano:1994, sede:'EUA',          bandeira:'US', campeao:'Brasil',     vice:'Itália',       artilheiro:'Hristo Stoichkov (6) e Oleg Salenko (6)', gols:141, jogos:52, sedes:['Nova York','Los Angeles','São Francisco'], curiosidade:'Primeira Copa nos EUA. Baggio perdeu o pênalti decisivo na final. Brasil tornou-se o primeiro tetracampeão.' },
      { ano:1998, sede:'França',       bandeira:'FR', campeao:'França',     vice:'Brasil',       artilheiro:'Davor Šuker (6)',        gols:171, jogos:64, sedes:['Paris','Marselha','Lyon'], curiosidade:'Ronaldo convulsionou horas antes da final. A França de Zidane goleou o Brasil 3×0. Zidane marcou 2 cabeçadas.' },
      { ano:2002, sede:'Coreia/Japão', bandeira:'KR', campeao:'Brasil',  vice:'Alemanha',     artilheiro:'Ronaldo (8)',            gols:161, jogos:64, sedes:['Seul','Sapporo','Yokohama'], curiosidade:'Primeira Copa na Ásia e co-sede. Ronaldo marcou os 2 gols da final e exorcizou os fantasmas de 1998. A Coreia do Sul chegou às semifinais.' },
      { ano:2006, sede:'Alemanha',     bandeira:'DE', campeao:'Itália',     vice:'França',       artilheiro:'Miroslav Klose (5)',     gols:147, jogos:64, sedes:['Berlim','Munique','Dortmund'], curiosidade:'Zidane cabeceou Materazzi e foi expulso na final, sua última partida profissional. A Itália venceu nos pênaltis.' },
      { ano:2010, sede:'África do Sul',bandeira:'ZA', campeao:'Espanha',    vice:'Holanda',      artilheiro:'Thomas Müller (5) e outros', gols:145, jogos:64, sedes:['Joanesburgo','Cidade do Cabo','Durban'], curiosidade:'Primeira Copa africana. Espanha venceu com a única geração a ganhar Euro-Copa do Mundo-Euro. A vuvuzela foi o símbolo do torneio.' },
      { ano:2014, sede:'Brasil',       bandeira:'BR', campeao:'Alemanha',   vice:'Argentina',    artilheiro:'James Rodríguez (6)',    gols:171, jogos:64, sedes:['Brasília','São Paulo','Rio de Janeiro'], curiosidade:'O "Mineirazo" — Alemanha 7×1 Brasil na semifinal chocou o mundo. A Alemanha venceu com gol de Götze na prorrogação da final.' },
      { ano:2018, sede:'Rússia',       bandeira:'RU', campeao:'França',     vice:'Croácia',      artilheiro:'Harry Kane (6)',         gols:169, jogos:64, sedes:['Moscou','São Petersburgo','Kazan'], curiosidade:'Croácia chegou à primeira final da história. A França de Mbappé (19 anos) venceu 4×2. Mbappé tornou-se o 2º jovem a marcar em final (após Pelé).' },
      { ano:2022, sede:'Qatar',        bandeira:'QA', campeao:'Argentina',  vice:'França',       artilheiro:'Kylian Mbappé (8)',      gols:172, jogos:64, sedes:['Lusail','Al Rayyan','Al Khor'], curiosidade:'Considerada por muitos a melhor final de todos os tempos: Argentina 3×3 França (4×2 pênaltis). Messi conquistou o único título que faltava.' },
    ];

    const RECORDES_HIST = [
      { label:'Maior goleada de todos os tempos', valor:'Hungria 10 × 1 El Salvador', sub:'Copa de 1982 — Espanha' },
      { label:'Jogo com mais gols',               valor:'12 gols',                     sub:'Áustria 7 × 5 Suíça — Copa de 1954' },
      { label:'Maior artilheiro em uma Copa',     valor:'Just Fontaine — 13 gols',     sub:'França, Copa de 1958 — Suécia' },
      { label:'Maior artilheiro de todos os tempos (até 2022)', valor:'Miroslav Klose — 16 gols', sub:'Alemanha · 4 Copas (2002–2014) · 24 jogos' },
      { label:'Goleiro com mais jogos sem sofrer gol', valor:'Peter Shilton — 10 jogos', sub:'Inglaterra · 3 Copas (1982, 1986, 1990)' },
      { label:'Maior invencibilidade em Copas do Mundo', valor:'Brasil — 13 jogos sem perder', sub:'1958–1966 · 11 vitórias, 2 empates · eliminado por Portugal 3 × 1 nas oitavas de 1966 (Inglaterra)' },
      { label:'Copa com mais gols por jogo',      valor:'5,38 gols/jogo',              sub:'Copa de 1954 — Suíça · 140 gols em 26 jogos' },
      { label:'Copa com menos gols por jogo',     valor:'2,21 gols/jogo',              sub:'Copa de 1990 — Itália · 115 gols em 52 jogos' },
      { label:'Primeira Copa do Mundo',           valor:'Uruguai 1930',                sub:'13 seleções · 18 jogos · Uruguai campeão na final contra a Argentina (4×2)' },
      { label:'Partida mais longa (prorrogação + pênaltis)', valor:'Bélgica 1×1 Camarões (1994)', sub:'O primeiro jogo de Copa a ser decidido por pênaltis após 120 min foi Alemanha vs França em 1982' },
    ];

    const ATUAL_CAMPEAO = {
      nome:'Argentina', bandeira:'AR', titulo:'Campeã Mundial 2022', local:'Qatar 2022',
      final:'Argentina 3 × 3 França (4 × 2 nos pênaltis)', artilheiro:'Kylian Mbappé (8 gols)', melhor:'Lionel Messi',
      curiosidade:'Primeiro título mundial de Messi, conquistado na prorrogação e pênaltis — considerada por muitos a melhor final de todos os tempos.',
      titulos:3, anos:[1978,1986,2022],
      accentColor:'#74ACDF', gradientColor:'rgba(116,172,223,0.08)', borderColor:'rgba(116,172,223,0.35)',
      stripColor:'linear-gradient(90deg, #74ACDF 0%, #FFFFFF 50%, #74ACDF 100%)',
      dividerColor:'rgba(116,172,223,0.15)', curioBg:'rgba(116,172,223,0.07)', curioBorder:'rgba(116,172,223,0.15)',
    };
    const PRIMEIRA_CAMPEA = {
      nome:'Uruguai', bandeira:'UY', local:'Uruguai 1930', final:'Uruguai 4 × 2 Argentina',
      artilheiro:'Guillermo Stábile (8 gols)', melhor:'José Nasazzi',
      curiosidade:'Primeira Copa do Mundo da história, realizada no Uruguai como parte das comemorações do centenário da independência do país.',
      titulos:2,
      accentColor:'#5EC8E5', gradientColor:'rgba(94,200,229,0.08)', borderColor:'rgba(94,200,229,0.35)',
      stripColor:'linear-gradient(90deg, #5EC8E5 0%, #FFFFFF 50%, #5EC8E5 100%)',
      dividerColor:'rgba(94,200,229,0.15)', curioBg:'rgba(94,200,229,0.07)', curioBorder:'rgba(94,200,229,0.15)',
    };
    const TOP5_CAMPEOES = [
      { nome:'Brasil',    bandeira:'BR', titulos:5, anos:[1958,1962,1970,1994,2002], cor:'#009C3B' },
      { nome:'Alemanha',  bandeira:'DE', titulos:4, anos:[1954,1974,1990,2014],       cor:'#DD0000' },
      { nome:'Itália',    bandeira:'IT', titulos:4, anos:[1934,1938,1982,2006],       cor:'#009246' },
      { nome:'Argentina', bandeira:'AR', titulos:3, anos:[1978,1986,2022],            cor:'#74ACDF' },
      { nome:'França',    bandeira:'FR', titulos:2, anos:[1998,2018],                 cor:'#002395' },
    ];

    const CampeaCard = ({ data, label }) => (
      <div style={{ flex:1, background:`linear-gradient(135deg, ${navyMid} 0%, ${data.gradientColor} 100%)`, border:`1px solid ${data.borderColor}`, borderRadius:'12px', padding:'20px 16px', boxShadow:`0 8px 28px rgba(0,0,0,0.3)`, position:'relative', overflow:'hidden', minWidth:0 }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:data.stripColor }} />
        <div style={{ fontSize:'9px', fontWeight:'800', color:textMuted, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'10px' }}>{label}</div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
          <FlagIcon code={data.bandeira} size="30px" />
          <div>
            <div style={{ fontSize:'18px', fontWeight:'900', color:white, lineHeight:1 }}>{data.nome}</div>
            <div style={{ fontSize:'10px', fontWeight:'600', color:data.accentColor, marginTop:'2px' }}>{data.local}</div>
          </div>
        </div>
        <div style={{ height:'1px', background:data.dividerColor, marginBottom:'12px' }} />
        <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
          {[{ label:'Final', value:data.final },{ label:'Artilheiro', value:data.artilheiro },{ label:'Melhor Jogador', value:data.melhor }].map(({ label:l, value }) => (
            <div key={l} style={{ display:'flex', gap:'6px', alignItems:'flex-start' }}>
              <span style={{ fontSize:'9px', fontWeight:'700', color:textMuted, textTransform:'uppercase', letterSpacing:'0.5px', minWidth:'80px', paddingTop:'2px', flexShrink:0 }}>{l}</span>
              <span style={{ fontSize:'11px', fontWeight:'600', color:offWhite, flex:1 }}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop:'12px', padding:'9px 10px', background:data.curioBg, border:`1px solid ${data.curioBorder}`, borderRadius:'8px' }}>
          <div style={{ fontSize:'10px', fontWeight:'700', color:data.accentColor, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Curiosidade</div>
          <div style={{ fontSize:'10px', fontWeight:'500', color:offWhite, lineHeight:1.6 }}>{data.curiosidade}</div>
        </div>
      </div>
    );

    const selected = COPAS_TIMELINE.find(c => c.ano === timelineSelected);

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'28px' }}>

        {/* ── Linha do Tempo Interativa ── */}
        <div>
          <div style={{ textAlign:'center', marginBottom:'16px' }}>
            <div style={{ fontSize:'14px', fontWeight:'800', color:gold, textTransform:'uppercase', letterSpacing:'2px', marginBottom:'4px' }}>Linha do Tempo</div>
            <div style={{ fontSize:'11px', color:textMuted, fontWeight:'500' }}>Todas as {COPAS_TIMELINE.length} edições da Copa do Mundo · Toque numa Copa para ver detalhes</div>
          </div>

          {/* Trilho horizontal com scroll */}
          <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', paddingBottom:'8px', marginBottom:'12px' }}>
            <div style={{ display:'flex', alignItems:'center', minWidth:'max-content', padding:'12px 8px', gap:'0', position:'relative' }}>
              {/* Linha de fundo */}
              <div style={{ position:'absolute', top:'50%', left:'24px', right:'24px', height:'2px', background:'rgba(245,197,24,0.2)', transform:'translateY(-50%)', zIndex:0 }} />

              {COPAS_TIMELINE.map((copa, i) => {
                const isSelected = timelineSelected === copa.ano;
                const isLast = i === COPAS_TIMELINE.length - 1;
                return (
                  <div key={copa.ano} style={{ display:'flex', alignItems:'center', position:'relative', zIndex:1 }}>
                    <button
                      onClick={() => setTimelineSelected(isSelected ? null : copa.ano)}
                      style={{
                        display:'flex', flexDirection:'column', alignItems:'center', gap:'6px',
                        background:'none', border:'none', cursor:'pointer', padding:'4px 8px',
                        transition:'all 0.2s ease',
                      }}
                    >
                      <div style={{
                        width: isSelected ? '20px' : '14px',
                        height: isSelected ? '20px' : '14px',
                        borderRadius:'50%',
                        background: isSelected ? gold : navyMid,
                        border: `2px solid ${isSelected ? gold : 'rgba(245,197,24,0.4)'}`,
                        boxShadow: isSelected ? `0 0 12px ${gold}80` : 'none',
                        transition:'all 0.2s ease',
                        flexShrink:0,
                      }} />
                      <span style={{
                        fontSize:'10px', fontWeight: isSelected ? '900' : '600',
                        color: isSelected ? gold : textMuted,
                        transition:'all 0.2s ease',
                        whiteSpace:'nowrap',
                      }}>{copa.ano}</span>
                      <FlagIcon code={copa.bandeira} size="14px" />
                    </button>
                    {!isLast && <div style={{ width:'16px', height:'2px', background:'rgba(245,197,24,0.2)', flexShrink:0 }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card de detalhes da Copa selecionada */}
          {selected ? (
            <div style={{ background:navyMid, border:`1px solid ${gold}30`, borderRadius:'12px', padding:'18px 16px', animation:'fadeSlideIn 0.25s ease both' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'14px', gap:'8px' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                    <FlagIcon code={selected.bandeira} size="24px" />
                    <div>
                      <div style={{ fontSize:'20px', fontWeight:'900', color:gold, lineHeight:1 }}>Copa {selected.ano}</div>
                      <div style={{ fontSize:'12px', fontWeight:'600', color:textMuted, marginTop:'2px' }}>{selected.sede}</div>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:'10px', fontWeight:'700', color:textMuted, textTransform:'uppercase', letterSpacing:'0.5px' }}>Campeão</div>
                  <div style={{ fontSize:'16px', fontWeight:'900', color:white }}>{selected.campeao}</div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px', marginBottom:'14px' }}>
                {[
                  { label:'Vice', value:selected.vice },
                  { label:'Artilheiro', value:selected.artilheiro },
                  { label:'Gols / Jogos', value:`${selected.gols} / ${selected.jogos}` },
                ].map(({ label:l, value }) => (
                  <div key={l} style={{ background:'rgba(0,0,0,0.25)', borderRadius:'8px', padding:'8px 10px' }}>
                    <div style={{ fontSize:'9px', fontWeight:'700', color:textMuted, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'3px' }}>{l}</div>
                    <div style={{ fontSize:'11px', fontWeight:'700', color:offWhite, lineHeight:1.3 }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ background:'rgba(245,197,24,0.06)', border:'1px solid rgba(245,197,24,0.15)', borderRadius:'8px', padding:'10px 12px' }}>
                <div style={{ fontSize:'9px', fontWeight:'800', color:gold, textTransform:'uppercase', letterSpacing:'1px', marginBottom:'5px' }}>Curiosidade</div>
                <div style={{ fontSize:'11px', fontWeight:'500', color:offWhite, lineHeight:1.7 }}>{selected.curiosidade}</div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:'20px', color:textMuted, fontSize:'12px', background:'rgba(255,255,255,0.02)', borderRadius:'10px', border:'1px dashed rgba(255,255,255,0.07)' }}>
              Selecione um ano na linha do tempo acima
            </div>
          )}
        </div>

        {/* ── Atual + Primeira Campeã ── */}
        <div>
          <div style={{ display:'flex', gap:'12px', alignItems:'stretch' }}>
            <CampeaCard data={ATUAL_CAMPEAO}   label="Atual Campeã" />
            <CampeaCard data={PRIMEIRA_CAMPEA} label="1ª Campeã · 1930" />
          </div>
        </div>

        {/* ── Maiores Campeões ── */}
        <div style={{ background:navyMid, border:`1px solid rgba(245,197,24,0.2)`, borderRadius:'12px', padding:'20px 18px' }}>
          <div style={{ fontSize:'11px', fontWeight:'800', color:gold, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'18px', textAlign:'center' }}>Maiores Campeões da Copa do Mundo</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
            {TOP5_CAMPEOES.map((pais, i) => (
              <div key={pais.nome} style={{ padding:'12px 0', borderBottom:i<TOP5_CAMPEOES.length-1?'1px solid rgba(255,255,255,0.05)':'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'7px' }}>
                  <span style={{ fontSize:'13px', fontWeight:'800', minWidth:'24px', textAlign:'center', color:i===0?gold:textMuted }}>{i+1}º</span>
                  <FlagIcon code={pais.bandeira} size="20px" />
                  <span style={{ flex:1, fontSize:'14px', fontWeight:'700', color:white }}>{pais.nome}</span>
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontSize:'22px', fontWeight:'900', color:i===0?gold:offWhite }}>{pais.titulos}</span>
                    <span style={{ fontSize:'10px', fontWeight:'600', color:textMuted, marginLeft:'4px' }}>{pais.titulos===1?'título':'títulos'}</span>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ flex:1, height:'4px', background:'rgba(255,255,255,0.07)', borderRadius:'2px', overflow:'hidden' }}>
                    <div style={{ width:`${(pais.titulos/5)*100}%`, height:'100%', background:i===0?gold:pais.cor, borderRadius:'2px', transition:'width 0.6s ease' }} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginTop:'7px' }}>
                  {pais.anos.map(ano => <span key={ano} style={{ fontSize:'10px', fontWeight:'700', color:textMuted, background:'rgba(255,255,255,0.05)', borderRadius:'4px', padding:'2px 7px' }}>{ano}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recordes Históricos ── */}
        <div>
          <div style={{ textAlign:'center', marginBottom:'16px' }}>
            <div style={{ fontSize:'14px', fontWeight:'800', color:gold, textTransform:'uppercase', letterSpacing:'2px', marginBottom:'4px' }}>Recordes Históricos</div>
            <div style={{ fontSize:'11px', color:textMuted, fontWeight:'500' }}>Os maiores feitos de todas as Copas do Mundo (1930 – 2022)</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {RECORDES_HIST.map((r, i) => (
              <div key={i} style={{ background:navyMid, border:`1px solid ${gold}25`, borderLeft:`3px solid ${gold}`, borderRadius:'10px', padding:'14px 16px' }}>
                <div style={{ fontSize:'9px', fontWeight:'800', color:gold, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'4px' }}>{r.label}</div>
                <div style={{ fontSize:'15px', fontWeight:'900', color:white, lineHeight:1.2, marginBottom:'4px' }}>{r.valor}</div>
                <div style={{ fontSize:'10px', fontWeight:'500', color:textMuted, lineHeight:1.5 }}>{r.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── ABA 3: Seleções ──────────────────────────────────────────────────────────
  const TabSelecoes = () => {
    const ESTREANTES = [
      { nome:'Cabo Verde',   conf:'CAF',      detalhe:'Primeira nação lusófona africana no Mundial' },
      { nome:'Curaçao',      conf:'CONCACAF', detalhe:'Menor país por população a se classificar' },
      { nome:'Jordânia',     conf:'AFC',       detalhe:'10ª seleção árabe a estrear em Copas' },
      { nome:'Uzbequistão', conf:'AFC',       detalhe:'1º país da Ásia Central no Mundial' },
    ];
    const RETORNANTES = [
      { nome:'Haiti',            ausencia:52, ultima:1974, detalhe:'Única aparição anterior' },
      { nome:'RD Congo',         ausencia:52, ultima:1974, detalhe:'Disputou como Zaire' },
      { nome:'Iraque',           ausencia:40, ultima:1986, detalhe:'Única aparição anterior' },
      { nome:'Áustria',          ausencia:28, ultima:1998, detalhe:'' },
      { nome:'Noruega',          ausencia:28, ultima:1998, detalhe:'' },
      { nome:'Escócia',          ausencia:28, ultima:1998, detalhe:'' },
      { nome:'Turquia',          ausencia:24, ultima:2002, detalhe:'3º lugar em 2002' },
      { nome:'Paraguai',         ausencia:16, ultima:2010, detalhe:'' },
      { nome:'Nova Zelândia',    ausencia:16, ultima:2010, detalhe:'Equipe mais baixa no ranking' },
      { nome:'África do Sul',    ausencia:16, ultima:2010, detalhe:'Sede de 2010' },
      { nome:'Rep. Tcheca',      ausencia:20, ultima:2006, detalhe:'' },
      { nome:'Argélia',          ausencia:12, ultima:2014, detalhe:'' },
      { nome:'Bósnia',           ausencia:12, ultima:2014, detalhe:'' },
      { nome:'Costa do Marfim',  ausencia:12, ultima:2014, detalhe:'' },
    ].sort((a,b)=>b.ausencia-a.ausencia);

    const InfoCard = ({ titulo, lista, renderItem }) => (
      <div style={{ background:navyMid, border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'16px', width:'100%', boxSizing:'border-box' }}>
        <div style={{ fontSize:'11px', fontWeight:'800', color:gold, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:'14px', textAlign:'center' }}>{titulo}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>{lista.map((item,i)=>renderItem(item,i,lista.length))}</div>
      </div>
    );

    // Distribuição de seleções por confederação (dados fixos da Copa 2026 com 48 times)
    const CONF_DATA = [
      { conf:'UEFA',     total:16, cor:'#4169E1', bandeira:'🇪🇺' },
      { conf:'CONMEBOL', total:6,  cor:'#009C3B', bandeira:'🌎' },
      { conf:'CONCACAF', total:6,  cor:'#CC0000', bandeira:'🌎' },
      { conf:'CAF',      total:9,  cor:'#FFD700', bandeira:'🌍' },
      { conf:'AFC',      total:8,  cor:'#FF6600', bandeira:'🌏' },
      { conf:'OFC',      total:1,  cor:'#00BFFF', bandeira:'🌊' },
      { conf:'Repescagem', total:2, cor:textMuted, bandeira:'🔄' },
    ];
    const maxConf = Math.max(...CONF_DATA.map(c=>c.total));

    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>

        {/* Estreantes */}
        <InfoCard
          titulo="Estreantes na Copa 2026"
          lista={ESTREANTES}
          renderItem={(item,i,total) => (
            <div key={item.nome} style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'9px 0', borderBottom:i<total-1?'1px solid rgba(255,255,255,0.05)':'none', gap:'12px' }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:'13px', fontWeight:'700', color:white }}>{item.nome}</div>
                {item.detalhe && <div style={{ fontSize:'11px', color:textMuted, marginTop:'2px' }}>{item.detalhe}</div>}
              </div>
              <span style={{ fontSize:'10px', fontWeight:'700', color:gold, background:'rgba(245,197,24,0.1)', border:'1px solid rgba(245,197,24,0.2)', borderRadius:'6px', padding:'2px 8px', flexShrink:0, whiteSpace:'nowrap' }}>{item.conf}</span>
            </div>
          )}
        />

        {/* Retornantes */}
        <InfoCard
          titulo="De Volta ao Mundial"
          lista={RETORNANTES}
          renderItem={(item,i,total) => (
            <div key={item.nome} style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', padding:'9px 0', borderBottom:i<total-1?'1px solid rgba(255,255,255,0.05)':'none', gap:'12px' }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:'13px', fontWeight:'700', color:white }}>{item.nome}</div>
                {item.detalhe && <div style={{ fontSize:'11px', color:textMuted, marginTop:'2px' }}>{item.detalhe}</div>}
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:offWhite }}>Última: {item.ultima}</div>
                <div style={{ fontSize:'10px', color:textMuted }}>{item.ausencia} anos fora</div>
              </div>
            </div>
          )}
        />
      </div>
    );
  };

  // ── Seletor de abas ──────────────────────────────────────────────────────────
  const TABS = [
    { id:'copa2026', label:'Copa 2026' },
    { id:'historia', label:'História' },
    { id:'selecoes', label:'Seleções' },
  ];

  return (
    <div className="container-wrapper page-enter" style={styles.detailWrapper}>
      {/* Header */}
      <div style={styles.detailHeader}>
        <button onClick={onBack} style={styles.backButton}>Voltar</button>
        <div style={styles.detailHeaderTitle}>Fatos & <span style={{ color:gold }}>Curiosidades</span></div>
        <div style={{ width:'80px' }} />
      </div>

      {/* Seletor de abas */}
      <div style={{ display:'flex', justifyContent:'center', gap:'8px', padding:'16px 20px 0', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding:'9px 18px',
              background: activeTab===tab.id ? gold : 'transparent',
              border: `1px solid ${activeTab===tab.id ? gold : 'rgba(255,255,255,0.12)'}`,
              borderBottom: activeTab===tab.id ? `1px solid ${gold}` : '1px solid transparent',
              borderRadius:'8px 8px 0 0',
              color: activeTab===tab.id ? navy : textMuted,
              fontSize:'12px', fontWeight:'800',
              textTransform:'uppercase', letterSpacing:'0.5px',
              cursor:'pointer', transition:'all 0.2s ease',
              marginBottom:'-1px',
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* Conteúdo da aba activa */}
      <div style={{ width:'100%', padding:'24px 20px 40px', boxSizing:'border-box', maxWidth:'700px', margin:'0 auto' }}>
        {activeTab === 'copa2026' && <TabCopa2026 />}
        {activeTab === 'historia' && <TabHistoria />}
        {activeTab === 'selecoes' && <TabSelecoes />}
      </div>
    </div>
  );
}

// ─── COMPONENTE: Landing Page ─────────────────────────────────────────────────
function LandingPage({ groups, knockoutMatches = [], onNavigate }) {
  const [hoverGrupos, setHoverGrupos] = useState(false);
  const [hoverMataMata, setHoverMataMata] = useState(false);
  const [hoverSimular, setHoverSimular] = useState(false);
  const [hoverCuriosidades, setHoverCuriosidades] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const calculateTimeLeft = () => {
    const finalDate = new Date('2026-07-19T23:59:59'); 
    const difference = +finalDate - +new Date();
    let timeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0 };
    if (difference > 0) {
      timeLeft = {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    }
    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  useEffect(() => {
    const timer = setInterval(() => { setTimeLeft(calculateTimeLeft()); }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pad = (num) => String(num).padStart(2, '0');
  let playedGames = 0;
  groups.forEach(g => { g.matches.forEach(m => { if (m.s1 !== null && m.s2 !== null) playedGames++; }); });
  knockoutMatches.forEach(m => { if (m.s1 !== null && m.s2 !== null) playedGames++; });
  const totalGames = 104;
  const remainingGames = Math.max(0, totalGames - playedGames);

  return (
    <>
      {showSearch && <TeamSearch groups={groups} onClose={() => setShowSearch(false)} />}
      <div className="container-wrapper page-enter" style={styles.homeWrapper}>
        <div style={styles.homeHeader}>
          <div style={styles.homeSub}>FIFA World Cup • 2026</div>
          <h1 className="main-title" style={styles.mainTitle}>Copa do Mundo<span style={styles.mainTitleSpan}>2026</span></h1>
          <div className="home-desc" style={styles.homeDesc}>48 seleções · 12 grupos · 104 jogos</div>
        </div>

        <div className="landing-container">
          <div className="landing-timer-box">
            <div className="landing-timer-number">{pad(timeLeft.days)}d : {pad(timeLeft.hours)}h : {pad(timeLeft.minutes)}m : {pad(timeLeft.seconds)}s</div>
            <div style={styles.landingStatLabel}>Tempo Restante até a Grande Final</div>
          </div>
          <div className="landing-stats-row">
            <div style={styles.landingStatBoxHalf}>
              <div style={styles.landingStatNumber}>{playedGames}/{totalGames}</div>
              <div style={styles.landingStatLabel}>Jogos Realizados</div>
            </div>
            <div style={styles.landingStatBoxHalf}>
              <div style={styles.landingStatNumber}>{remainingGames}</div>
              <div style={styles.landingStatLabel}>Jogos Restantes</div>
            </div>
          </div>
        </div>

        <div className="landing-buttons" style={{ animation: 'fadeSlideIn 0.5s ease 0.25s both' }}>
          <button onMouseEnter={() => setHoverGrupos(true)} onMouseLeave={() => setHoverGrupos(false)} onClick={() => onNavigate('grupos')} style={styles.landingBtnPrimary(hoverGrupos)}>Fase de Grupos</button>
          <button onMouseEnter={() => setHoverMataMata(true)} onMouseLeave={() => setHoverMataMata(false)} onClick={() => onNavigate('matamata')} style={styles.landingBtnSecondary(hoverMataMata)}>Fase Eliminatória</button>
        </div>

        {/* ── Simular Eliminatórias ── */}
        <div style={{
          width: '100%', maxWidth: '500px',
          padding: '0 16px', boxSizing: 'border-box',
          paddingTop: '8px',
          animation: 'fadeSlideIn 0.5s ease 0.28s both',
        }}>
          <button
            onMouseEnter={() => setHoverSimular(true)}
            onMouseLeave={() => setHoverSimular(false)}
            onClick={() => onNavigate('simGroups')}
            style={{
              width: '100%', padding: '12px 20px',
              background: hoverSimular ? 'rgba(245,197,24,0.06)' : 'transparent',
              border: `1px dashed ${hoverSimular ? colors.gold : 'rgba(245,197,24,0.4)'}`,
              borderRadius: '10px',
              color: colors.gold,
              fontSize: '13px', fontWeight: '700',
              letterSpacing: '1px', textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Simular Eliminatórias
          </button>
        </div>

        {/* ── Fatos & Curiosidades ── */}
        <div style={{
          width: '100%', maxWidth: '500px',
          padding: '0 16px', boxSizing: 'border-box',
          paddingTop: '8px',
          animation: 'fadeSlideIn 0.5s ease 0.31s both',
        }}>
          <button
            onMouseEnter={() => setHoverCuriosidades(true)}
            onMouseLeave={() => setHoverCuriosidades(false)}
            onClick={() => onNavigate('curiosidades')}
            style={{
              width: '100%', padding: '12px 20px',
              background: hoverCuriosidades ? 'rgba(245,197,24,0.06)' : 'transparent',
              border: `1px dashed ${hoverCuriosidades ? colors.gold : 'rgba(245,197,24,0.4)'}`,
              borderRadius: '10px',
              color: colors.gold,
              fontSize: '13px', fontWeight: '700',
              letterSpacing: '1px', textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Fatos & Curiosidades
          </button>
        </div>

        {/* ── Buscar Seleção ── */}
        <div style={{
          width: '100%', maxWidth: '560px', margin: '16px auto 0',
          padding: '0 20px', boxSizing: 'border-box',
          animation: 'fadeSlideIn 0.5s ease 0.3s both',
        }}>
          <button
            onClick={() => setShowSearch(true)}
            style={{
              width: '100%', padding: '12px 20px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              color: 'rgba(255,255,255,0.45)',
              fontSize: '14px', fontWeight: '500',
              cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: '10px',
              transition: 'background 0.2s, border 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Buscar seleção…
          </button>
        </div>

        {/* ── Jogos de Hoje / Próximos ── */}
        <div style={{ marginTop: '16px', width: '100%' }}>
          <TodayMatches groups={groups} knockoutMatches={knockoutMatches} />
          <NextMatch groups={groups} knockoutMatches={knockoutMatches} />
        </div>
      </div>
    </>
  );
}

// ─── HOOK: verifica se algum jogo de um grupo está ao vivo ───────────────────
function useGroupHasLive(matches) {
  const [hasLive, setHasLive] = useState(false);
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const live = (matches || []).some(m => {
        const start = resolveMatchStart(m.date, m.time);
        if (!start) return false;
        const end = start.getTime() + MATCH_DURATION_MINUTES * 60 * 1000;
        return now >= start.getTime() && now <= end;
      });
      setHasLive(live);
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, [matches]);
  return hasLive;
}

// ─── HELPER: verifica quais times estão matematicamente classificados ─────────
// Um time está "classificado" se, em TODOS os cenários possíveis dos jogos
// restantes, ele termina entre os top-2 do grupo (usando só pontos e saldo,
// que são os critérios determinísticos sem depender de cartões/ranking).
function getQualifiedTeams(teams, matches, extraTeamInfo = {}, allGroups = []) {
  if (!teams || !matches) return new Set();

  // Jogos já disputados e jogos pendentes
  const played  = matches.filter(m => m.s1 !== null && m.s2 !== null);
  const pending = matches.filter(m => m.s1 === null || m.s2 === null);

  // Se não há jogos pendentes, classificados são simplesmente os top-2 atuais
  if (pending.length === 0) {
    const sorted = sortedTeams(teams, matches, extraTeamInfo);
    const qualifiedSet = new Set(sorted.slice(0, 2).map(t => t.name));

    // Fase de grupos inteira encerrada (nenhum jogo pendente em NENHUM grupo)?
    // Se sim, o ranking dos 8 melhores terceiros já é definitivo — o 3º
    // colocado deste grupo também é confirmado como classificado, se estiver
    // entre eles. Enquanto ainda houver jogos pendentes em qualquer grupo,
    // esse ranking pode mudar, então o 3º colocado continua "em disputa".
    const groupStageComplete = allGroups.length > 0 &&
      allGroups.every(g => g.matches.every(m => m.s1 !== null && m.s2 !== null));
    if (groupStageComplete) {
      const bestThirds = getBestThirdPlaces(allGroups, extraTeamInfo);
      const third = sorted[2];
      if (third && bestThirds.includes(third.name)) qualifiedSet.add(third.name);
    }

    return qualifiedSet;
  }

  // Resultados possíveis para cada jogo pendente: vitória t1, empate, vitória t2
  const outcomes = [
    { ds1: 1, ds2: 0 },
    { ds1: 0, ds2: 0 },
    { ds1: 0, ds2: 1 },
  ];

  // Gera todos os cenários (3^n combinações)
  function* scenarios(idx, current) {
    if (idx === pending.length) { yield current; return; }
    for (const o of outcomes) {
      const fakeMatch = { ...pending[idx], s1: o.ds1, s2: o.ds2 };
      yield* scenarios(idx + 1, [...current, fakeMatch]);
    }
  }

  // Para cada time, verifica se em TODOS os cenários ele fica top-2
  const qualifiedSet = new Set();
  teams.forEach(name => {
    let alwaysTop2 = true;
    for (const scenario of scenarios(0, [])) {
      const allMatches = [...played, ...scenario];
      const sorted = sortedTeams(teams, allMatches, extraTeamInfo);
      const pos = sorted.findIndex(t => t.name === name);
      if (pos >= 2) { alwaysTop2 = false; break; }
    }
    if (alwaysTop2) qualifiedSet.add(name);
  });

  return qualifiedSet;
}

// ─── HELPER: verifica quais times estão matematicamente eliminados ────────────
// Um time está eliminado somente se em NENHUM cenário consegue terminar
// em 1º, 2º, ou entre os 8 melhores 3ºs colocados de todos os grupos.
function getEliminatedTeams(teams, matches, extraTeamInfo = {}, allGroups = []) {
  if (!teams || !matches) return new Set();

  const played  = matches.filter(m => m.s1 !== null && m.s2 !== null);
  const pending = matches.filter(m => m.s1 === null || m.s2 === null);

  // Identifica o índice deste grupo dentro de allGroups
  const thisGroupIdx = allGroups.findIndex(g =>
    g.teams.length === teams.length && teams.every(t => g.teams.includes(t))
  );

  const outcomes = [
    { ds1: 1, ds2: 0 },
    { ds1: 0, ds2: 0 },
    { ds1: 0, ds2: 1 },
  ];

  function* scenarios(idx, current) {
    if (idx === pending.length) { yield current; return; }
    for (const o of outcomes) {
      yield* scenarios(idx + 1, [...current, { ...pending[idx], s1: o.ds1, s2: o.ds2 }]);
    }
  }

  // Resolve melhor forma de calcular os melhores 3ºs num cenário hipotético
  const getBestThirdsForScenario = (scenarioMatches) => {
    if (allGroups.length === 0) return [];
    const groupsWithScenario = allGroups.map((g, idx) =>
      idx === thisGroupIdx ? { ...g, matches: scenarioMatches } : g
    );
    return getBestThirdPlaces(groupsWithScenario, extraTeamInfo);
  };

  if (pending.length === 0) {
    // Fase encerrada: verifica quem não se classificou em nenhuma posição
    const sorted = sortedTeams(teams, matches, extraTeamInfo);
    const eliminatedSet = new Set();
    const bestThirds = allGroups.length > 0
      ? getBestThirdPlaces(allGroups)
      : [];
    sorted.slice(2).forEach(t => {
      if (!bestThirds.includes(t.name)) eliminatedSet.add(t.name);
    });
    return eliminatedSet;
  }

  const eliminatedSet = new Set();
  teams.forEach(name => {
    let canPass = false;
    for (const scenario of scenarios(0, [])) {
      const allMatches = [...played, ...scenario];
      const sorted = sortedTeams(teams, allMatches, extraTeamInfo);
      const pos = sorted.findIndex(t => t.name === name);

      // Passa direto como 1º ou 2º
      if (pos < 2) { canPass = true; break; }

      // Pode passar como 3º se for dos 8 melhores terceiros
      if (pos === 2) {
        if (allGroups.length > 0) {
          const bestThirds = getBestThirdsForScenario(allMatches);
          if (bestThirds.includes(name)) { canPass = true; break; }
        } else {
          // Sem contexto global, considera que o 3º pode passar
          canPass = true; break;
        }
      }
    }
    if (!canPass) eliminatedSet.add(name);
  });

  return eliminatedSet;
}

// ─── COMPONENTE: GroupCard ─────────────────────────────────────────────────────
function GroupCard({ group, allGroups, onClick, activeConf }) {
  const sorted      = sortedTeams(group.teams, group.matches, group.extraTeamInfo || {});
  const top2        = sorted.slice(0, 2).map(t => t.name);
  const bestThirds  = getBestThirdPlaces(allGroups);
  const qualified   = getQualifiedTeams(group.teams, group.matches, group.extraTeamInfo || {}, allGroups);
  const eliminated  = getEliminatedTeams(group.teams, group.matches, group.extraTeamInfo || {}, allGroups);
  const [hovered, setHovered] = useState(false);
  const hasLive = useGroupHasLive(group.matches);

  const getColor = (name, idx) => {
    if (eliminated.has(name)) return colors.red;
    if (qualified.has(name)) return colors.gold;
    if (top2.includes(name)) return colors.white;
    if (idx === 2 && bestThirds.includes(name)) return colors.white;
    return colors.textMuted;
  };

  const markerColor = activeConf && activeConf !== 'TODOS' ? (CONF_COLORS[activeConf] || colors.gold) : null;

  return (
    <div onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{
      ...styles.groupCard(hovered),
      border: hasLive ? '1px solid rgba(220,38,38,0.45)' : styles.groupCard(hovered).border,
    }}>
      <div style={styles.groupCardHeader}>
        <div style={styles.groupCardTitle}>Grupo {group.id}</div>
        {hasLive && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: '#ef4444', flexShrink: 0,
              animation: 'livePulse 1.2s ease-in-out infinite',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: '9px', fontWeight: '800', color: '#f87171', letterSpacing: '1.5px', textTransform: 'uppercase' }}>ao vivo</span>
          </div>
        )}
      </div>
      <ul style={styles.groupCardList}>
        {sorted.map((t, idx) => {
          const isMatch = markerColor && TEAM_CONF[t.name] === activeConf;
          return (
            <li key={idx} style={styles.groupCardListItem}>
              <span style={{ color: getColor(t.name, idx) }}>{t.name}</span>
              {isMatch && (
                <span style={{ color: markerColor, fontSize: '13px', fontWeight: '900', lineHeight: 1, marginLeft: '2px' }}>*</span>
              )}
            </li>
          );
        })}
      </ul>

      <button onClick={e => { e.stopPropagation(); onClick(); }} style={styles.groupCardButton}>Ver grupo</button>
    </div>
  );
}

// ─── COMPONENTE: Critérios de Desempate ──────────────────────────────────────
function TiebreakerLegend({ showExternalCriteria = false }) {
  const baseCriteria = [
    { num: '1', label: 'Confronto direto' },
    { num: '2', label: 'Saldo de gols' },
    { num: '3', label: 'Gols pró' },
  ];
  const externalCriteria = [
    { num: '4', label: 'Menos cartões' },
    { num: '5', label: 'Ranking FIFA' },
  ];
  const criteria = showExternalCriteria ? [...baseCriteria, ...externalCriteria] : baseCriteria;
  return (
    <div style={{
      marginTop: '12px',
      padding: '10px 14px',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: '8px',
    }}>
      <div style={{
        fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px',
        textTransform: 'uppercase', color: colors.textMuted,
        marginBottom: '8px',
      }}>
        Critérios de desempate
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {criteria.map(c => (
          <div key={c.num} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '10px', fontWeight: '800', color: colors.gold,
              minWidth: '14px', textAlign: 'right',
            }}>{c.num}.</span>
            <span style={{ fontSize: '11px', color: colors.textMuted, fontWeight: '500' }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── COMPONENTE: StandingsTable ───────────────────────────────────────────────
function StandingsTable({ teams, matches, allGroups }) {
  const sorted = sortedTeams(teams, matches);
  const bestThirds = getBestThirdPlaces(allGroups);
  return (
    <>
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th('24px', 'left')}>#</th>
              <th style={styles.th('auto', 'left')}>Seleção</th>
              <th style={styles.th('30px', 'center')}>V</th>
              <th style={styles.th('30px', 'center')}>E</th>
              <th style={styles.th('30px', 'center')}>D</th>
              <th style={styles.th('34px', 'center')}>SG</th>
              <th style={styles.th('38px', 'center')}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => {
              const gdVal = gd(t);
              const isTop2 = i < 2;
              const isBestThird = i === 2 && bestThirds.includes(t.name);
              let borderLeftStyle = 'none';
              if (isTop2) borderLeftStyle = `3px solid ${colors.greenLight}`;
              else if (isBestThird) borderLeftStyle = `3px solid ${colors.gold}`;
              return (
                <tr key={i}>
                  <td style={styles.tdNum(borderLeftStyle)}>{i + 1}</td>
                  <td style={styles.tdName}><span style={styles.teamNameText}>{t.name}</span></td>
                  <td style={styles.tdCenter}>{t.w}</td>
                  <td style={styles.tdCenter}>{t.d}</td>
                  <td style={styles.tdCenter}>{t.l}</td>
                  <td style={styles.tdSg(gdVal)}>{gdVal > 0 ? '+' : ''}{gdVal}</td>
                  <td style={styles.tdPts}>{pts(t)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={styles.legendWrapper}>
        <div style={styles.legendItem}><div style={styles.legendBox(colors.greenLight)}></div>Classificado</div>
        <div style={styles.legendItem}><div style={styles.legendBox(colors.gold)}></div>3º colocado</div>
      </div>
      <TiebreakerLegend showExternalCriteria={true} />
    </>
  );
}

// ─── COMPONENTE: ThirdPlacesPage ──────────────────────────────────────────────
function ThirdPlacesPage({ groups, onBack }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const thirdPlacesList = groups.map(g => { const sorted = sortedTeams(g.teams, g.matches); return { ...sorted[2], groupLetter: g.id }; });
  const sortedThirds = [...thirdPlacesList].sort((a, b) => { if (pts(b) !== pts(a)) return pts(b) - pts(a); if (gd(b) !== gd(a)) return gd(b) - gd(a); return (b.gf || 0) - (a.gf || 0); });
  return (
    <div className="container-wrapper page-enter" style={styles.detailWrapper}>
      <div style={styles.detailHeader}>
        <button onClick={onBack} style={styles.backButton}>Voltar</button>
        <div style={styles.detailHeaderTitle}>Classificação Geral dos <span style={{ color: colors.gold }}>3º Colocados</span></div>
        <div style={{ width: '80px' }}></div> 
      </div>
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={styles.sectionTitle}>Ranking dos Melhores Terceiros (Avançam os 8 primeiros)</div>
        <div style={{ ...styles.tableWrapper, maxWidth: '680px', width: '100%' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th('32px', 'left')}>#</th>
                <th style={styles.th('auto', 'left')}>Seleção</th>
                <th style={styles.th('30px', 'center')}>V</th>
                <th style={styles.th('30px', 'center')}>E</th>
                <th style={styles.th('30px', 'center')}>D</th>
                <th style={styles.th('36px', 'center')}>SG</th>
                <th style={styles.th('38px', 'center')}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {sortedThirds.map((t, i) => {
                const gdVal = gd(t);
                const qualifies = i < 8; 
                const borderStyle = qualifies ? `3px solid ${colors.gold}` : `3px solid ${colors.red}`;
                return (
                  <tr key={i}>
                    <td style={styles.tdNum(borderStyle)}>{i + 1}</td>
                    <td style={styles.tdName}><span style={styles.teamNameText}>{t.name || "Carregando..."}</span></td>
                    <td style={styles.tdCenter}>{t.w || 0}</td>
                    <td style={styles.tdCenter}>{t.d || 0}</td>
                    <td style={styles.tdCenter}>{t.l || 0}</td>
                    <td style={styles.tdSg(gdVal)}>{gdVal > 0 ? '+' : ''}{gdVal}</td>
                    <td style={styles.tdPts}>{pts(t)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ maxWidth: '680px', width: '100%' }}>
          <TiebreakerLegend showExternalCriteria={true} />
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE: GroupDetail ──────────────────────────────────────────────────
function GroupDetail({ group, allGroups, onBack, onNext }) {
  const rounds = [1, 2, 3];
  const [btnHovered, setBtnHovered] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, [group]);
  return (
    <div className="container-wrapper page-enter" style={styles.detailWrapper}>
      <div style={styles.detailHeader}>
        <button onClick={onBack} style={styles.backButton}>Voltar</button>
        <div style={styles.detailHeaderTitle}>Grupo <span style={{ color: colors.gold }}>{group.id}</span></div>
        <button onMouseEnter={() => setBtnHovered(true)} onMouseLeave={() => setBtnHovered(false)} onClick={onNext} style={styles.nextButton(btnHovered)}>Grupo Seguinte</button>
      </div>
      <div className="detail-grid">
        <div style={styles.detailGridColLeft}>
          <div style={styles.sectionTitle}>Classificação</div>
          <StandingsTable teams={group.teams} matches={group.matches} allGroups={allGroups} />
        </div>
        <div style={styles.detailGridColRight}>
          <div style={styles.sectionTitle}>Jogos do Grupo</div>
          {rounds.map(r => (
            <div style={{ ...styles.roundWrapper, marginBottom: '20px' }} key={r}>
              <div style={{
                ...styles.roundHeader,
                fontFamily: 'inherit',
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
              }}>Rodada {r}<div style={styles.roundLine}></div></div>
              {group.matches.filter(m => m.r === r).map((m, i) => <MatchCard key={i} match={m} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE: Legenda dos GroupCards ──────────────────────────────────────
function GroupLegend({ groups }) {
  const hasAnyQualified = groups.some(g =>
    getQualifiedTeams(g.teams, g.matches, g.extraTeamInfo || {}, groups).size > 0
  );
  const hasAnyEliminated = groups.some(g =>
    getEliminatedTeams(g.teams, g.matches, g.extraTeamInfo || {}, groups).size > 0
  );

  return (
    <div style={{
      width: '100%',
      padding: '14px 20px 4px',
      boxSizing: 'border-box',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '16px',
      alignItems: 'center',
    }}>
      {hasAnyQualified && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: colors.gold, flexShrink: 0 }} />
          <span style={{ fontSize: '11px', color: colors.textMuted }}>Classificado matematicamente</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: colors.white, flexShrink: 0 }} />
        <span style={{ fontSize: '11px', color: colors.textMuted }}>Em zona de classificação</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: colors.textMuted, flexShrink: 0 }} />
        <span style={{ fontSize: '11px', color: colors.textMuted }}>Fora da zona</span>
      </div>
      {hasAnyEliminated && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: colors.red, flexShrink: 0 }} />
          <span style={{ fontSize: '11px', color: colors.textMuted }}>Eliminado matematicamente</span>
        </div>
      )}
    </div>
  );
}

// ─── Mapa time → confederação ─────────────────────────────────────────────────
const TEAM_CONF = {
  // CONMEBOL
  'Brasil': 'CONMEBOL', 'Argentina': 'CONMEBOL', 'Uruguai': 'CONMEBOL', 'Colômbia': 'CONMEBOL',
  'Equador': 'CONMEBOL', 'Venezuela': 'CONMEBOL', 'Peru': 'CONMEBOL', 'Bolívia': 'CONMEBOL',
  'Chile': 'CONMEBOL', 'Paraguai': 'CONMEBOL',
  // UEFA
  'França': 'UEFA', 'Alemanha': 'UEFA', 'Espanha': 'UEFA', 'Portugal': 'UEFA',
  'Inglaterra': 'UEFA', 'Itália': 'UEFA', 'Holanda': 'UEFA', 'Países Baixos': 'UEFA',
  'Bélgica': 'UEFA', 'Croácia': 'UEFA', 'Suíça': 'UEFA', 'Dinamarca': 'UEFA',
  'Áustria': 'UEFA', 'Sérvia': 'UEFA', 'Turquia': 'UEFA', 'Escócia': 'UEFA',
  'Polônia': 'UEFA', 'Ucrânia': 'UEFA', 'Rep. Tcheca': 'UEFA', 'Hungria': 'UEFA',
  'Eslovénia': 'UEFA', 'Eslováquia': 'UEFA', 'Romênia': 'UEFA', 'Albânia': 'UEFA',
  'Noruega': 'UEFA', 'Suécia': 'UEFA', 'Finlândia': 'UEFA', 'Islândia': 'UEFA',
  'País de Gales': 'UEFA', 'Irlanda': 'UEFA', 'Geórgia': 'UEFA',
  'Bósnia': 'UEFA', 'Bósnia e Herzegovina': 'UEFA',
  // CONCACAF
  'Estados Unidos': 'CONCACAF', 'México': 'CONCACAF', 'Canadá': 'CONCACAF',
  'Costa Rica': 'CONCACAF', 'Panamá': 'CONCACAF', 'Jamaica': 'CONCACAF',
  'Honduras': 'CONCACAF', 'El Salvador': 'CONCACAF', 'Guatemala': 'CONCACAF',
  'Trinidad e Tobago': 'CONCACAF', 'Cuba': 'CONCACAF', 'Haiti': 'CONCACAF',
  'Curaçao': 'CONCACAF',
  // CAF
  'Marrocos': 'CAF', 'Senegal': 'CAF', 'Egito': 'CAF', 'Nigéria': 'CAF',
  'Camarões': 'CAF', 'Costa do Marfim': 'CAF', 'Gana': 'CAF', 'Mali': 'CAF',
  'Tunísia': 'CAF', 'Argélia': 'CAF', 'África do Sul': 'CAF', 'RD Congo': 'CAF',
  'Congo': 'CAF', 'Zimbábue': 'CAF', 'Tanzânia': 'CAF', 'Uganda': 'CAF',
  'Benim': 'CAF', 'Cabo Verde': 'CAF',
  // AFC
  'Japão': 'AFC', 'Coreia do Sul': 'AFC', 'Austrália': 'AFC', 'Irã': 'AFC',
  'Arábia Saudita': 'AFC', 'Catar': 'AFC', 'China': 'AFC', 'Uzbequistão': 'AFC',
  'Jordânia': 'AFC', 'Iraque': 'AFC', 'Omã': 'AFC', 'Kuwait': 'AFC',
  'Indonésia': 'AFC', 'Tailândia': 'AFC', 'Índia': 'AFC', 'Bahrein': 'AFC',
  // OFC
  'Nova Zelândia': 'OFC', 'Fiji': 'OFC', 'Papua Nova Guiné': 'OFC',
};

const CONF_COLORS = {
  UEFA:     '#4A90D9',
  CONMEBOL: '#27AE60',
  CONCACAF: '#E67E22',
  CAF:      '#E74C3C',
  AFC:      '#9B59B6',
  OFC:      '#1ABC9C',
};

const CONF_LABEL = {
  UEFA:     'Europa',
  CONMEBOL: 'América do Sul',
  CONCACAF: 'América do Norte, Central e Caribe',
  CAF:      'África',
  AFC:      'Ásia e Oceania',
  OFC:      'Oceania',
};

// ─── COMPONENTE: GroupsPage ───────────────────────────────────────────────────
function GroupsPage({ groups, onSelectGroup, onSelectThirdPlaces, onBack }) {
  const [btnHovered, setBtnHovered] = useState(false);
  const [activeConf, setActiveConf] = useState('TODOS');

  // Descobre quais confederações existem nos grupos carregados, excluindo times sem mapeamento
  const confsPresentes = ['TODOS', ...Array.from(new Set(
    groups.flatMap(g => g.teams.map(t => TEAM_CONF[t]).filter(Boolean))
  )).sort()];

  // Filtra grupos que têm pelo menos um time da confederação selecionada
  const filteredGroups = activeConf === 'TODOS'
    ? groups
    : groups.filter(g => g.teams.some(t => TEAM_CONF[t] === activeConf));

  const confColor = CONF_COLORS[activeConf] || colors.gold;
  const confDescription = CONF_LABEL[activeConf] || activeConf;

  return (
    <div className="container-wrapper page-enter" style={styles.homeWrapper}>
      <div style={{ width: '100%', textAlign: 'left', padding: '20px 20px 0', boxSizing: 'border-box' }}>
        <button onClick={onBack} style={styles.backButton}>Voltar para o Início</button>
      </div>

      {/* ── Filtro por Confederação ── */}
      <div style={{ width: '100%', padding: '16px 20px 4px', boxSizing: 'border-box' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>
          Filtrar por Confederação
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {confsPresentes.map(conf => {
            const isActive = activeConf === conf;
            const color = conf === 'TODOS' ? colors.gold : (CONF_COLORS[conf] || colors.textMuted);
            return (
              <button
                key={conf}
                onClick={() => setActiveConf(conf)}
                style={{
                  padding: '5px 12px',
                  background: isActive ? `${color}22` : 'transparent',
                  border: `1px solid ${isActive ? color : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: '20px',
                  color: isActive ? color : colors.textMuted,
                  fontSize: '11px',
                  fontWeight: isActive ? '800' : '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  letterSpacing: '0.5px',
                }}
              >
                {conf}
              </button>
            );
          })}
        </div>
        {/* Resumo da Confederação selecionada */}
        {activeConf !== 'TODOS' && (() => {
          // Coleta todos os times da confederação e seus status
          let classif = 0, emDisputa = 0, eliminados = 0;
          const teamsInConf = [];

          groups.forEach(g => {
            const confTeams = g.teams.filter(t => TEAM_CONF[t] === activeConf);
            if (confTeams.length === 0) return;
            const qualified  = getQualifiedTeams(g.teams, g.matches, g.extraTeamInfo || {}, groups);
            const eliminated = getEliminatedTeams(g.teams, g.matches, g.extraTeamInfo || {}, groups);
            confTeams.forEach(name => {
              if (qualified.has(name))        { classif++; teamsInConf.push({ name, status: 'Q' }); }
              else if (eliminated.has(name))  { eliminados++; teamsInConf.push({ name, status: 'E' }); }
              else                            { emDisputa++; teamsInConf.push({ name, status: 'D' }); }
            });
          });

          const total = classif + emDisputa + eliminados;
          if (total === 0) return null;

          const statusConfig = [
            { key: 'Q', label: 'Classificados',    count: classif,    color: '#4CAF84',        icon: '✓' },
            { key: 'D', label: 'Em disputa',        count: emDisputa,  color: colors.gold,      icon: '◌' },
            { key: 'E', label: 'Eliminados',        count: eliminados, color: colors.red,       icon: '✕' },
          ];

          return (
            <div style={{
              marginTop: '14px',
              background: `${confColor}0F`,
              border: `1px solid ${confColor}30`,
              borderRadius: '10px',
              padding: '14px 16px',
              animation: 'fadeSlideIn 0.25s ease both',
            }}>
              {/* Cabeçalho */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontSize: '10px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', color: confColor }}>
                  {activeConf} — {confDescription}
                </div>
                <div style={{ fontSize: '10px', color: colors.textMuted, fontWeight: '600' }}>
                  {total} seleções
                </div>
              </div>

              {/* Três contadores lado a lado */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: classif + emDisputa + eliminados > 0 ? '12px' : '0' }}>
                {statusConfig.map(s => (
                  <div key={s.key} style={{
                    flex: 1,
                    background: `${s.color}12`,
                    border: `1px solid ${s.color}35`,
                    borderRadius: '8px',
                    padding: '10px 8px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '22px', fontWeight: '900', color: s.color, lineHeight: 1 }}>
                      {s.count}
                    </div>
                    <div style={{ fontSize: '9px', fontWeight: '700', color: s.color, textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: '4px', opacity: 0.85 }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Lista de times por status */}
              {['Q', 'D', 'E'].map(status => {
                const cfg = statusConfig.find(s => s.key === status);
                const names = teamsInConf.filter(t => t.status === status).map(t => t.name);
                if (names.length === 0) return null;
                return (
                  <div key={status} style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: cfg.color, textTransform: 'uppercase', letterSpacing: '1px', marginRight: '2px' }}>
                      {cfg.icon}
                    </span>
                    {names.map(name => (
                      <span key={name} style={{
                        fontSize: '10px', fontWeight: '700',
                        color: cfg.color,
                        background: `${cfg.color}15`,
                        border: `1px solid ${cfg.color}30`,
                        borderRadius: '4px',
                        padding: '2px 7px',
                      }}>
                        {name}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      <GroupLegend groups={groups} />

      <div className="responsive-grid">
        {filteredGroups.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: colors.textMuted, padding: '40px 0', fontSize: '13px' }}>
            Nenhum grupo encontrado para esta confederação.
          </div>
        ) : (
          filteredGroups.map((g, index) => <GroupCard key={index} group={g} allGroups={groups} onClick={() => onSelectGroup(g)} activeConf={activeConf} />)
        )}
      </div>

      {activeConf === 'TODOS' && (
        <div className="center-btn-container">
          <button onMouseEnter={() => setBtnHovered(true)} onMouseLeave={() => setBtnHovered(false)} onClick={onSelectThirdPlaces} style={styles.thirdPlacesBtn(btnHovered)}>
            Ver Classificação dos 3ºs Colocados
          </button>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// SIMULAÇÃO DE ELIMINATÓRIAS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Tela 1: Seleção de posições por grupo ────────────────────────────────────
function SimGroupsPage({ groups, onNext, onBack }) {
  // picks[groupId] = [1°name, 2°name, 3°name] — 4° é o restante
  const [picks, setPicks] = useState({});

  const handlePick = (groupId, teamName, allTeams) => {
    const current = picks[groupId] || [];
    // Clicou num já selecionado → remove ele e os subsequentes
    const idx = current.indexOf(teamName);
    if (idx !== -1) {
      setPicks(p => ({ ...p, [groupId]: current.slice(0, idx) }));
      return;
    }
    // Já tem 3 escolhidos (4° é automático) → ignora
    if (current.length >= 3) return;
    setPicks(p => ({ ...p, [groupId]: [...current, teamName] }));
  };

  const allDone = groups.every(g => (picks[g.id] || []).length === 3);

  // Monta os terceiros para passar adiante
  const handleNext = () => {
    const thirds = groups.map(g => {
      const chosen = picks[g.id] || [];
      return chosen[2] || null; // 3° de cada grupo
    }).filter(Boolean);
    onNext(picks, thirds);
  };

  const gold = colors.gold;
  const navy = colors.navy;
  const navyMid = colors.navyMid;
  const textMuted = colors.textMuted;
  const offWhite = colors.offWhite;
  const white = colors.white;
  const green = '#4CAF84';
  const red = '#C41E3A';

  const posLabel = (i) => ['1°', '2°', '3°', '4°'][i] || `${i+1}°`;
  const posColor = (i) => [gold, offWhite, textMuted, red][i] || textMuted;

  return (
    <div className="container-wrapper page-enter" style={{ ...styles.homeWrapper, paddingBottom: '60px' }}>
      {/* Header */}
      <div style={styles.detailHeader}>
        <button onClick={onBack} style={styles.backButton}>Voltar</button>
        <div style={styles.detailHeaderTitle}>
          Simulação • <span style={{ color: gold }}>Fase de Grupos</span>
        </div>
        <div style={{ width: '80px' }} />
      </div>

      {/* Instrução */}
      <div style={{
        textAlign: 'center', padding: '16px 20px 4px',
        fontSize: '13px', color: textMuted, lineHeight: 1.6,
      }}>
        Clique nos times de cada grupo em ordem de classificação.<br/>
        <span style={{ color: gold, fontWeight: '700' }}>1° clique = 1°, 2° clique = 2°, 3° clique = 3°</span> (4° é automático).
        <br/>Clique novamente para desfazer.
      </div>

      {/* Grid de grupos */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '16px',
        width: '100%',
        padding: '20px',
        boxSizing: 'border-box',
      }}>
        {groups.map(g => {
          const chosen = picks[g.id] || [];
          const allTeams = g.teams;
          const fourth = allTeams.find(t => !chosen.includes(t));
          const isDone = chosen.length === 3;

          return (
            <div key={g.id} style={{
              background: navyMid,
              border: `1px solid ${isDone ? 'rgba(76,175,132,0.4)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: '12px',
              padding: '16px',
              transition: 'border-color 0.2s ease',
            }}>
              {/* Título do grupo */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '12px',
              }}>
                <span style={{ fontSize: '22px', fontWeight: '900', color: gold }}>
                  Grupo {g.id}
                </span>
                {isDone && (
                  <span style={{
                    fontSize: '10px', fontWeight: '800', color: green,
                    background: 'rgba(76,175,132,0.15)', border: '1px solid rgba(76,175,132,0.3)',
                    borderRadius: '10px', padding: '2px 8px', letterSpacing: '0.5px',
                  }}>OK</span>
                )}
              </div>

              {/* Times */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {allTeams.map(teamName => {
                  const pickedIdx = chosen.indexOf(teamName);
                  const isSelected = pickedIdx !== -1;
                  const isFourth = isDone && !isSelected; // auto 4°

                  return (
                    <button
                      key={teamName}
                      onClick={() => handlePick(g.id, teamName, allTeams)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: isSelected
                          ? 'rgba(245,197,24,0.08)'
                          : isFourth ? 'rgba(196,30,58,0.06)' : 'rgba(255,255,255,0.04)',
                        border: isSelected
                          ? `1px solid rgba(245,197,24,0.35)`
                          : isFourth ? '1px solid rgba(196,30,58,0.2)' : '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '8px',
                        cursor: isFourth ? 'default' : 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{
                        fontSize: '13px', fontWeight: isSelected ? '700' : '500',
                        color: isSelected ? white : isFourth ? red : textMuted,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        flex: 1,
                      }}>{teamName}</span>
                      {(isSelected || isFourth) && (
                        <span style={{
                          fontSize: '12px', fontWeight: '800', flexShrink: 0, marginLeft: '6px',
                          color: posColor(isSelected ? pickedIdx : 3),
                        }}>
                          {isSelected ? posLabel(pickedIdx) : '4°'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Botão avançar */}
      <div style={{ padding: '0 20px 20px', width: '100%', boxSizing: 'border-box', textAlign: 'center' }}>
        <button
          onClick={handleNext}
          disabled={!allDone}
          style={{
            padding: '14px 48px',
            background: allDone ? gold : 'rgba(255,255,255,0.06)',
            border: `2px solid ${allDone ? gold : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '10px',
            color: allDone ? navy : textMuted,
            fontSize: '14px', fontWeight: '800',
            textTransform: 'uppercase', letterSpacing: '1px',
            cursor: allDone ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
          }}
        >
          {allDone ? 'Escolher 8 Melhores 3°s →' : `Faltam ${groups.filter(g => (picks[g.id] || []).length < 3).length} grupo(s)`}
        </button>
      </div>
    </div>
  );
}

// ─── Tela 2: Seleção dos 8 melhores 3° colocados ─────────────────────────────
function SimThirdsPage({ thirds, onNext, onBack }) {
  // thirds = array com o nome do 3° de cada grupo (até 12)
  const [selected, setSelected] = useState([]);

  const toggle = (name) => {
    setSelected(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : prev.length < 8 ? [...prev, name] : prev
    );
  };

  const gold = colors.gold;
  const navy = colors.navy;
  const navyMid = colors.navyMid;
  const textMuted = colors.textMuted;
  const white = colors.white;
  const green = '#4CAF84';

  return (
    <div className="container-wrapper page-enter" style={{ ...styles.homeWrapper, paddingBottom: '60px' }}>
      <div style={styles.detailHeader}>
        <button onClick={onBack} style={styles.backButton}>Voltar</button>
        <div style={styles.detailHeaderTitle}>
          Simulação • <span style={{ color: gold }}>8 Melhores 3°s</span>
        </div>
        <div style={{ width: '80px' }} />
      </div>

      <div style={{
        textAlign: 'center', padding: '16px 20px 4px',
        fontSize: '13px', color: textMuted, lineHeight: 1.6,
      }}>
        Selecione os <span style={{ color: gold, fontWeight: '700' }}>8 terceiros colocados</span> que avançam ao mata-mata.
      </div>

      {/* Contador */}
      <div style={{
        margin: '12px 0 4px',
        fontSize: '14px', fontWeight: '800',
        color: selected.length === 8 ? green : gold,
      }}>
        {selected.length} / 8 selecionados
      </div>

      {/* Lista de 3°s */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '10px',
        width: '100%', maxWidth: '480px',
        padding: '12px 20px 20px', boxSizing: 'border-box',
      }}>
        {thirds.map((name, i) => {
          const isOn = selected.includes(name);
          const disabled = !isOn && selected.length >= 8;
          return (
            <button
              key={name}
              onClick={() => toggle(name)}
              disabled={disabled}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                background: isOn ? 'rgba(245,197,24,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isOn ? 'rgba(245,197,24,0.5)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: '10px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{
                fontSize: '14px', fontWeight: isOn ? '700' : '500',
                color: isOn ? white : textMuted,
              }}>{name}</span>
              <span style={{
                fontSize: '11px', fontWeight: '800',
                color: isOn ? gold : textMuted,
                letterSpacing: '0.5px',
              }}>
                {isOn ? '✓ Avança' : '3° colocado'}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ padding: '0 20px 20px', textAlign: 'center' }}>
        <button
          onClick={() => onNext(selected)}
          disabled={selected.length !== 8}
          style={{
            padding: '14px 48px',
            background: selected.length === 8 ? gold : 'rgba(255,255,255,0.06)',
            border: `2px solid ${selected.length === 8 ? gold : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '10px',
            color: selected.length === 8 ? navy : textMuted,
            fontSize: '14px', fontWeight: '800',
            textTransform: 'uppercase', letterSpacing: '1px',
            cursor: selected.length === 8 ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
          }}
        >
          {selected.length === 8 ? 'Simular Mata-Mata →' : `Selecione mais ${8 - selected.length}`}
        </button>
      </div>
    </div>
  );
}

// ─── Tela 3: Mata-Mata da simulação ──────────────────────────────────────────
// simPicks: { [groupId]: [1°, 2°, 3°] }
// simThirds: [8 nomes dos 3°s classificados]
// knockoutMatches: jogos reais da planilha (só usamos a estrutura de confrontos)

// ─── Mapa de bandeiras: nome do time → código ISO 2 letras ───────────────────
const FLAG_MAP = {
  // América do Sul
  'Brasil': 'BR', 'Argentina': 'AR', 'Uruguai': 'UY', 'Colômbia': 'CO',
  'Equador': 'EC', 'Venezuela': 'VE', 'Peru': 'PE', 'Bolívia': 'BO',
  'Chile': 'CL', 'Paraguai': 'PY',
  // América do Norte / Central / Caribe
  'Estados Unidos': 'US', 'México': 'MX', 'Canadá': 'CA', 'Costa Rica': 'CR',
  'Panamá': 'PA', 'Jamaica': 'JM', 'Honduras': 'HN', 'El Salvador': 'SV',
  'Guatemala': 'GT', 'Trinidad e Tobago': 'TT', 'Cuba': 'CU', 'Haiti': 'HT',
  // Europa
  'França': 'FR', 'Alemanha': 'DE', 'Espanha': 'ES', 'Portugal': 'PT',
  'Inglaterra': 'GB', 'Itália': 'IT', 'Holanda': 'NL', 'Países Baixos': 'NL',
  'Bélgica': 'BE', 'Croácia': 'HR', 'Suíça': 'CH', 'Dinamarca': 'DK',
  'Áustria': 'AT', 'Sérvia': 'RS', 'Turquia': 'TR', 'Escócia': 'GB-SCT',
  'Polônia': 'PL', 'Ucrânia': 'UA', 'República Tcheca': 'CZ', 'Hungria': 'HU',
  'Eslovénia': 'SI', 'Eslováquia': 'SK', 'Romênia': 'RO', 'Albânia': 'AL',
  'Noruega': 'NO', 'Suécia': 'SE', 'Finlândia': 'FI', 'Islândia': 'IS',
  'País de Gales': 'GB-WLS', 'Irlanda': 'IE', 'Geórgia': 'GE',
  // África
  'Marrocos': 'MA', 'Senegal': 'SN', 'Egito': 'EG', 'Nigéria': 'NG',
  'Camarões': 'CM', 'Costa do Marfim': 'CI', 'Gana': 'GH', 'Mali': 'ML',
  'Tunísia': 'TN', 'Argélia': 'DZ', 'África do Sul': 'ZA', 'Congo': 'CD',
  'Zimbábue': 'ZW', 'Tanzânia': 'TZ', 'Uganda': 'UG', 'Benim': 'BJ',
  // Ásia
  'Japão': 'JP', 'Coreia do Sul': 'KR', 'Austrália': 'AU', 'Irã': 'IR',
  'Arábia Saudita': 'SA', 'Catar': 'QA', 'China': 'CN', 'Uzbequistão': 'UZ',
  'Jordânia': 'JO', 'Iraque': 'IQ', 'Omã': 'OM', 'Kuwait': 'KW',
  'Indonésia': 'ID', 'Tailândia': 'TH', 'Índia': 'IN', 'Bahrein': 'BH',
  // Oceania
  'Nova Zelândia': 'NZ', 'Fiji': 'FJ', 'Papua Nova Guiné': 'PG',
  // Nomes alternativos comuns
  'USA': 'US', 'EUA': 'US', 'Coreia': 'KR', 'Korea': 'KR',
  'Ivory Coast': 'CI', 'Netherlands': 'NL', 'England': 'GB',
  'Germany': 'DE', 'France': 'FR', 'Spain': 'ES', 'Brazil': 'BR',
  'Japan': 'JP', 'Morocco': 'MA', 'Serbia': 'RS', 'Croatia': 'HR',
  'Switzerland': 'CH', 'Denmark': 'DK', 'Austria': 'AT', 'Turkey': 'TR',
  'Poland': 'PL', 'Ukraine': 'UA', 'Portugal': 'PT', 'Mexico': 'MX',
  'Canada': 'CA', 'Colombia': 'CO', 'Ecuador': 'EC', 'Uruguay': 'UY',
  'Chile': 'CL', 'Paraguay': 'PY', 'Peru': 'PE', 'Bolivia': 'BO',
  'Venezuela': 'VE', 'Panama': 'PA', 'Jamaica': 'JM', 'Honduras': 'HN',
  'Australia': 'AU', 'Iran': 'IR', 'Saudi Arabia': 'SA', 'Qatar': 'QA',
  'Senegal': 'SN', 'Nigeria': 'NG', 'Cameroon': 'CM', 'Ghana': 'GH',
  'Tunisia': 'TN', 'Algeria': 'DZ', 'South Africa': 'ZA',
};

const getFlagCode = (name) => {
  if (!name) return null;
  return FLAG_MAP[name] || null;
};

// Componente flag-icons: renderiza bandeira via CSS (funciona em todos os sistemas, inclusive Windows)
const FlagIcon = ({ code, size = '1.4em', style: extraStyle = {} }) => {
  if (!code) return null;
  // flag-icons usa códigos em minúsculo; subdivisões (GB-SCT, GB-WLS) usam só o país (GB)
  const cssCode = code.includes('-') ? code.split('-')[0].toLowerCase() : code.toLowerCase();
  return (
    <span
      className={`fi fi-${cssCode}`}
      style={{ fontSize: size, lineHeight: 1, borderRadius: '2px', flexShrink: 0, ...extraStyle }}
    />
  );
};

function SimKnockoutPage({ groups, simPicks, simThirds, knockoutMatches, onBack }) {
  const [activePhase, setActivePhase] = useState('16avos');
  // userPicks: { [jogoNum]: 't1' | 't2' } — escolhas do usuário
  const [userPicks, setUserPicks] = useState({});

  const gold = colors.gold;
  const navy = colors.navy;
  const navyMid = colors.navyMid;
  const textMuted = colors.textMuted;
  const offWhite = colors.offWhite;
  const white = colors.white;
  const red = '#C41E3A';

  // Resolve label usando simPicks e userPicks, sem tocar nos dados reais
  const resolveSimLabel = (raw) => {
    if (!raw) return 'A definir';
    const s = raw.trim();

    // Vencedor / Perdedor de jogo anterior
    const vMatch = s.match(/^[Vv]\s*(\d+)$/);
    const pMatch = s.match(/^[Pp]\s*(\d+)$/);
    if (vMatch || pMatch) {
      const num = parseInt((vMatch || pMatch)[1]);
      const src = knockoutMatches.find(m => m.jogo === num);
      if (!src) return vMatch ? `Vencedor Jogo ${num}` : `Perdedor Jogo ${num}`;
      const pick = userPicks[num]; // 't1' | 't2' | undefined
      if (!pick) return vMatch ? `Vencedor Jogo ${num}` : `Perdedor Jogo ${num}`;
      const winner = pick === 't1' ? resolveSimLabel(src.t1) : resolveSimLabel(src.t2);
      const loser  = pick === 't1' ? resolveSimLabel(src.t2) : resolveSimLabel(src.t1);
      return vMatch ? winner : loser;
    }

    // Labels de posição em grupo: "1° A", "2° B"
    const rankMatch = s.match(/^(\d)[°ºo]\s*([A-La-l](?:\/[A-La-l])*)\s*$/i);
    if (rankMatch) {
      const rank = parseInt(rankMatch[1], 10) - 1; // 0-indexed
      const groupStr = rankMatch[2].toUpperCase();

      // 3° colocados — lê do simThirds (slot posicional da planilha)
      if (rank === 2) {
        // A planilha indica "3° X/Y/Z": usamos a ordem em que o usuário escolheu os 8
        // mapeamos por slot de jogo (os 16avos têm slots fixos para os 3°s)
        const slotMap = buildThirdSlotMap(knockoutMatches, simThirds);
        const jogoRaw = raw; // ex: "3° A/B/C/D"
        return slotMap[jogoRaw] || s;
      }

      // 1° ou 2° de um grupo
      const chosen = simPicks[groupStr] || [];
      return chosen[rank] || s;
    }

    return s;
  };

  // Distribui os 8 terceiros nos slots dos 16avos usando a estrutura da planilha
  // Retorna { "3° A/B/C/D": nome, ... }
  const buildThirdSlotMap = (matches, thirds) => {
    const slots = {};
    const sixteenMatches = matches.filter(m => m.jogo >= 73 && m.jogo <= 88);
    let thirdIdx = 0;
    sixteenMatches.forEach(m => {
      [m.t1, m.t2].forEach(raw => {
        if (!raw) return;
        const rm = raw.trim().match(/^3[°ºo]\s*/i);
        if (rm && !slots[raw.trim()] && thirdIdx < thirds.length) {
          slots[raw.trim()] = thirds[thirdIdx++];
        }
      });
    });
    return slots;
  };

  const matchByNum = {};
  knockoutMatches.forEach(m => { matchByNum[m.jogo] = m; });

  const pickWinner = (jogoNum, side) => {
    setUserPicks(prev => {
      // Se clicou no mesmo lado, desfaz
      if (prev[jogoNum] === side) {
        // Remove também todas as escolhas downstream que dependem deste jogo
        const next = { ...prev };
        delete next[jogoNum];
        // Cascata: remove picks de jogos que dependem do resultado deste
        let changed = true;
        while (changed) {
          changed = false;
          knockoutMatches.forEach(m => {
            if (next[m.jogo] === undefined) return;
            const t1dep = m.t1?.match(/^[Vv]\s*(\d+)$/);
            const t2dep = m.t2?.match(/^[Vv]\s*(\d+)$/);
            const deps = [t1dep, t2dep].filter(Boolean).map(d => parseInt(d[1]));
            if (deps.some(d => !next[d] && d !== jogoNum)) {
              delete next[m.jogo];
              changed = true;
            }
          });
        }
        return next;
      }
      return { ...prev, [jogoNum]: side };
    });
  };

  // Card interativo de jogo da simulação
  const SimBracketCard = ({ match }) => {
    const t1 = resolveSimLabel(match.t1);
    const t2 = resolveSimLabel(match.t2);
    const pick = userPicks[match.jogo];
    const isPlaceholder = (n) => !n || n === 'A definir' || n.startsWith('Vencedor') || n.startsWith('Perdedor') || /^\d[°ºo]\s*[A-L]/i.test(n);
    const canPick = !isPlaceholder(t1) && !isPlaceholder(t2);

    return (
      <div style={{
        background: navyMid,
        border: `1px solid ${pick ? 'rgba(245,197,24,0.3)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '8px', padding: '10px 12px',
        display: 'flex', flexDirection: 'column', gap: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontSize: '9px', color: gold, fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase', paddingBottom: '2px' }}>
          Jogo {match.jogo}
        </div>
        {/* Time 1 */}
        <div
          onClick={() => canPick && pickWinner(match.jogo, 't1')}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
            padding: '5px 6px', borderRadius: '5px',
            background: pick === 't1' ? 'rgba(245,197,24,0.12)' : 'transparent',
            border: pick === 't1' ? '1px solid rgba(245,197,24,0.3)' : '1px solid transparent',
            cursor: canPick ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{
            fontSize: '12px',
            fontWeight: pick === 't1' ? '700' : isPlaceholder(t1) ? '400' : '600',
            color: pick === 't1' ? gold : isPlaceholder(t1) ? textMuted : white,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px',
          }}>{t1}</span>
          {pick === 't1' && <span style={{ fontSize: '10px', color: gold, fontWeight: '800', flexShrink: 0 }}>✓</span>}
        </div>
        {/* Time 2 */}
        <div
          onClick={() => canPick && pickWinner(match.jogo, 't2')}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
            padding: '5px 6px', borderRadius: '5px',
            background: pick === 't2' ? 'rgba(245,197,24,0.12)' : 'transparent',
            border: pick === 't2' ? '1px solid rgba(245,197,24,0.3)' : '1px solid transparent',
            cursor: canPick ? 'pointer' : 'default',
            transition: 'all 0.15s ease',
          }}
        >
          <span style={{
            fontSize: '12px',
            fontWeight: pick === 't2' ? '700' : isPlaceholder(t2) ? '400' : '600',
            color: pick === 't2' ? gold : isPlaceholder(t2) ? textMuted : white,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px',
          }}>{t2}</span>
          {pick === 't2' && <span style={{ fontSize: '10px', color: gold, fontWeight: '800', flexShrink: 0 }}>✓</span>}
        </div>
      </div>
    );
  };

  const finalMatch = knockoutMatches.find(m => m.jogo === 104);
  const thirdMatch = knockoutMatches.find(m => m.jogo === 103);
  const availablePhases = PHASE_ORDER.filter(p => {
    const [mn, mx] = PHASE_RANGES[p];
    return knockoutMatches.some(m => m.jogo >= mn && m.jogo <= mx);
  });

  // ── Auto-avanço: quando todos os jogos da fase atual tiverem pick, vai pra próxima ──
  useEffect(() => {
    if (knockoutMatches.length === 0) return;
    const [mn, mx] = PHASE_RANGES[activePhase] || [73, 88];
    const phaseMs = knockoutMatches.filter(m => m.jogo >= mn && m.jogo <= mx);
    if (phaseMs.length === 0) return;
    const allPicked = phaseMs.every(m => userPicks[m.jogo] !== undefined);
    if (!allPicked) return;
    const currentIdx = availablePhases.indexOf(activePhase);
    if (currentIdx !== -1 && currentIdx < availablePhases.length - 1) {
      const timer = setTimeout(() => setActivePhase(availablePhases[currentIdx + 1]), 600);
      return () => clearTimeout(timer);
    }
  }, [userPicks, activePhase, knockoutMatches, availablePhases]);

  const [min, max] = PHASE_RANGES[activePhase] || [73, 88];
  const phaseMatches = knockoutMatches.filter(m => m.jogo >= min && m.jogo <= max);
  const pairs = pairMatchesByNextRound(phaseMatches, knockoutMatches);
  const { left: leftMatches, right: rightMatches } = splitPairsToSides(pairs, phaseMatches);

  const champion = finalMatch && userPicks[104]
    ? (userPicks[104] === 't1' ? resolveSimLabel(finalMatch.t1) : resolveSimLabel(finalMatch.t2))
    : null;
  const championFlag = champion ? getFlagCode(champion) : null;

  // ── Compartilhamento ─────────────────────────────────────────────────────────
  const [shareState, setShareState] = useState('idle'); // 'idle' | 'copied' | 'shared'

  const buildShareText = () => {
    const phaseNames = { '16avos': '16avos', oitavas: 'Oitavas', quartas: 'Quartas', semi: 'Semifinais' };
    let lines = ['Minha simulação da Copa do Mundo 2026', ''];

    PHASE_ORDER.forEach(phase => {
      const [mn, mx] = PHASE_RANGES[phase];
      const phaseMs = knockoutMatches.filter(m => m.jogo >= mn && m.jogo <= mx);
      const pickedMs = phaseMs.filter(m => userPicks[m.jogo]);
      if (pickedMs.length === 0) return;
      lines.push(`— ${phaseNames[phase]} —`);
      pickedMs.forEach(m => {
        const t1 = resolveSimLabel(m.t1);
        const t2 = resolveSimLabel(m.t2);
        const winner = userPicks[m.jogo] === 't1' ? t1 : t2;
        const loser  = userPicks[m.jogo] === 't1' ? t2 : t1;
        lines.push(`  ${winner} elimina ${loser}`);
      });
      lines.push('');
    });

    // 3º lugar
    if (thirdMatch && userPicks[103]) {
      const t1 = resolveSimLabel(thirdMatch.t1);
      const t2 = resolveSimLabel(thirdMatch.t2);
      const third = userPicks[103] === 't1' ? t1 : t2;
      lines.push(`3 lugar: ${third}`);
    }

    // Campeão
    if (champion) {
      lines.push(`Campeao: ${champion}`);
    }

    return lines.join('\n');
  };

  const handleShare = async () => {
    const text = buildShareText();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Simulação Copa 2026', text });
        setShareState('shared');
        setTimeout(() => setShareState('idle'), 2500);
      } catch (_) { /* usuário cancelou */ }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setShareState('copied');
        setTimeout(() => setShareState('idle'), 2500);
      } catch (_) {
        // fallback legado
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setShareState('copied');
        setTimeout(() => setShareState('idle'), 2500);
      }
    }
  };

  const totalPicks = Object.keys(userPicks).length;
  const canShare = totalPicks > 0;

  return (
    <div className="container-wrapper page-enter" style={styles.detailWrapper}>
      <div style={styles.detailHeader}>
        <button onClick={onBack} style={styles.backButton}>Voltar</button>
        <div style={styles.detailHeaderTitle}>
          Simulação • <span style={{ color: gold }}>Mata-Mata</span>
        </div>
        <button
          onClick={() => setUserPicks({})}
          style={{ ...styles.backButton, color: red, borderColor: 'rgba(196,30,58,0.3)' }}
        >
          Limpar
        </button>
      </div>

      {/* Campeão simulado */}
      {champion && (
        <div style={{
          textAlign: 'center', padding: '12px 20px',
          background: 'linear-gradient(90deg, transparent, rgba(245,197,24,0.08), transparent)',
          borderBottom: '1px solid rgba(245,197,24,0.12)',
        }}>
          <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '2px', color: textMuted, textTransform: 'uppercase' }}>Campeão Simulado</span>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '12px', marginTop: '4px',
          }}>
            {championFlag && <FlagIcon code={championFlag} size="28px" />}
            <span style={{ fontSize: '22px', fontWeight: '900', color: gold }}>{champion}</span>
            {championFlag && <FlagIcon code={championFlag} size="28px" />}
          </div>
          {/* Botão Compartilhar — só aparece quando há campeão escolhido */}
          <button
            onClick={handleShare}
            style={{
              marginTop: '12px',
              padding: '8px 20px',
              background: shareState !== 'idle' ? `${gold}22` : 'transparent',
              border: `1px solid ${shareState !== 'idle' ? gold : 'rgba(245,197,24,0.4)'}`,
              borderRadius: '20px',
              color: shareState !== 'idle' ? gold : colors.textMuted,
              fontSize: '11px', fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              letterSpacing: '0.5px',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}
          >
            {shareState === 'copied' ? '✓ Copiado!' : shareState === 'shared' ? '✓ Compartilhado!' : '↑ Compartilhar simulação'}
          </button>
        </div>
      )}

      {/* Botão flutuante de compartilhar quando ainda não há campeão mas já tem picks */}
      {!champion && canShare && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 20px 0' }}>
          <button
            onClick={handleShare}
            style={{
              padding: '6px 14px',
              background: 'transparent',
              border: '1px solid rgba(245,197,24,0.3)',
              borderRadius: '16px',
              color: colors.textMuted,
              fontSize: '11px', fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'inline-flex', alignItems: 'center', gap: '5px',
            }}
          >
            {shareState === 'copied' ? '✓ Copiado!' : shareState === 'shared' ? '✓ Compartilhado!' : '↑ Compartilhar parcial'}
          </button>
        </div>
      )}

      {/* Seletor de fase */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '16px 0 20px', flexWrap: 'wrap', padding: '0 20px' }}>
        {availablePhases.map(p => (
          <button key={p} onClick={() => setActivePhase(p)} style={styles.tabButton(activePhase === p)}>
            {PHASE_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="bracket-container">
        <div className="bracket-split-layout">
          {/* Chave esquerda */}
          <div className="bracket-side-column">
            <div style={{ ...styles.sectionTitle, textAlign: 'left' }}>Chave Esquerda</div>
            {(() => {
              const items = [];
              for (let i = 0; i < leftMatches.length; i += 2) {
                if (i > 0) items.push(
                  <div key={`sep-sl-${i}`} style={{ height: '1px', background: 'rgba(245,197,24,0.12)', margin: '6px 0' }} />
                );
                items.push(<SimBracketCard key={leftMatches[i].id} match={leftMatches[i]} />);
                if (leftMatches[i + 1]) items.push(<SimBracketCard key={leftMatches[i+1].id} match={leftMatches[i+1]} />);
              }
              return items;
            })()}
          </div>

          {/* Centro: Final + 3° lugar */}
          <div className="bracket-center-podium">
            <div className="final-grand-box">
              <div style={{ fontSize: '11px', fontWeight: '800', color: gold, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px', textAlign: 'center' }}>
                Grande Final
              </div>
              {finalMatch ? <SimBracketCard match={finalMatch} /> : (
                <div style={{ fontSize: '12px', color: textMuted, textAlign: 'center' }}>A definir</div>
              )}
            </div>
            <div className="final-third-box">
              <div style={{ fontSize: '9px', fontWeight: '700', color: textMuted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center' }}>
                Disputa do 3º Lugar
              </div>
              {thirdMatch ? <SimBracketCard match={thirdMatch} /> : (
                <div style={{ fontSize: '12px', color: textMuted, textAlign: 'center' }}>A definir</div>
              )}
            </div>
          </div>

          {/* Chave direita */}
          <div className="bracket-side-column">
            <div style={{ ...styles.sectionTitle, textAlign: 'right' }}>Chave Direita</div>
            {(() => {
              const items = [];
              for (let i = 0; i < rightMatches.length; i += 2) {
                if (i > 0) items.push(
                  <div key={`sep-sr-${i}`} style={{ height: '1px', background: 'rgba(245,197,24,0.12)', margin: '6px 0' }} />
                );
                items.push(<SimBracketCard key={rightMatches[i].id} match={rightMatches[i]} />);
                if (rightMatches[i + 1]) items.push(<SimBracketCard key={rightMatches[i+1].id} match={rightMatches[i+1]} />);
              }
              return items;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────

// Hierarquia de profundidade para determinar direção do slide
const VIEW_DEPTH = { landing: 0, grupos: 1, matamata: 1, curiosidades: 1, detalhes: 2, terceiros: 2, simGroups: 2, simThirds: 3, simKnockout: 3 };

export default function App() {
  const [groups, setGroups]             = useState([]);
  const [currentView, setCurrentView]   = useState('landing');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [slideDir, setSlideDir]         = useState('forward'); // 'forward' | 'back'

  // Estado da simulação — completamente isolado dos dados reais
  const [simPicks, setSimPicks]         = useState({}); // { [groupId]: [1°,2°,3°] }
  const [simThirds, setSimThirds]       = useState([]); // 8 nomes dos 3°s escolhidos
  const [knockoutMatchesCache, setKnockoutMatchesCache] = useState([]);

  const navigateTo = (nextView, groupId = null) => {
    const currentDepth = VIEW_DEPTH[currentView] ?? 0;
    const nextDepth    = VIEW_DEPTH[nextView]    ?? 0;
    setSlideDir(nextDepth >= currentDepth ? 'forward' : 'back');
    if (groupId !== null) setSelectedGroupId(groupId);
    setCurrentView(nextView);
  };

  const fetchData = () => {
    Promise.all([
      fetch(JOGOS_CSV_URL).then(res => res.text()),
      fetch(TIMES_CSV_URL).then(res => res.text())
    ])
      .then(([jogosCsv, teamsCsv]) => {
        const parsed = parseCSVToGroups(jogosCsv, teamsCsv);
        setGroups(parsed);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erro na leitura das planilhas: ", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
    const refreshInterval = setInterval(fetchData, 60000);
    return () => clearInterval(refreshInterval);
  }, []);

  // Pré-carrega os jogos do mata-mata para a simulação (sem interferir no KnockoutPage)
  useEffect(() => {
    fetch(KNOCKOUT_CSV_URL)
      .then(r => r.text())
      .then(csv => setKnockoutMatchesCache(parseKnockoutCSV(csv)))
      .catch(() => {});
    const id = setInterval(() =>
      fetch(KNOCKOUT_CSV_URL).then(r => r.text()).then(csv => setKnockoutMatchesCache(parseKnockoutCSV(csv))).catch(() => {})
    , 60000);
    return () => clearInterval(id);
  }, []);

  const handleNextGroup = () => {
    const currentIndex = groups.findIndex(g => g.id === selectedGroupId);
    const nextIndex = (currentIndex + 1) % groups.length;
    setSelectedGroupId(groups[nextIndex].id);
  };

  if (loading) return <div style={styles.loadingWrapper}>Carregando dados da Copa...</div>;

  const currentSelectedGroup = selectedGroupId ? groups.find(g => g.id === selectedGroupId) : null;
  const slideClass = `page-slide-${slideDir}`;

  if (currentView === 'matamata') return (
    <div className={slideClass}><KnockoutPage groups={groups} onBack={() => navigateTo('landing')} /></div>
  );
  if (currentView === 'terceiros') return (
    <div className={slideClass}><ThirdPlacesPage groups={groups} onBack={() => navigateTo('grupos')} /></div>
  );
  if (currentView === 'detalhes' && currentSelectedGroup) return (
    <div className={slideClass}><GroupDetail group={currentSelectedGroup} allGroups={groups} onBack={() => navigateTo('grupos')} onNext={handleNextGroup} /></div>
  );
  if (currentView === 'grupos') return (
    <div className={slideClass}><GroupsPage groups={groups} onSelectGroup={(g) => navigateTo('detalhes', g.id)} onSelectThirdPlaces={() => navigateTo('terceiros')} onBack={() => navigateTo('landing')} /></div>
  );

  // ── Simulação ──────────────────────────────────────────────────────────────
  if (currentView === 'simGroups') return (
    <div className={slideClass}>
      <SimGroupsPage
        groups={groups}
        onBack={() => navigateTo('landing')}
        onNext={(picks, thirds) => {
          setSimPicks(picks);
          // Guarda os thirds temporariamente para passar à próxima tela
          setSimThirds(thirds);
          navigateTo('simThirds');
        }}
      />
    </div>
  );
  if (currentView === 'simThirds') return (
    <div className={slideClass}>
      <SimThirdsPage
        thirds={simThirds}
        onBack={() => navigateTo('simGroups')}
        onNext={(chosen8) => {
          setSimThirds(chosen8);
          navigateTo('simKnockout');
        }}
      />
    </div>
  );
  if (currentView === 'simKnockout') return (
    <div className={slideClass}>
      <SimKnockoutPage
        groups={groups}
        simPicks={simPicks}
        simThirds={simThirds}
        knockoutMatches={knockoutMatchesCache}
        onBack={() => navigateTo('simThirds')}
      />
    </div>
  );

  if (currentView === 'curiosidades') return (
    <div className={slideClass}><CuriosidadesPage onBack={() => navigateTo('landing')} groups={groups} knockoutMatches={knockoutMatchesCache} /></div>
  );

  return (
    <div className={slideClass} style={{ background: colors.navy, minHeight: '100vh' }}>
      <LandingPage groups={groups} knockoutMatches={knockoutMatchesCache} onNavigate={(view) => navigateTo(view)} />
    </div>
  );
}