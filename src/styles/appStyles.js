export const colors = {
  navy: "#0A1628",
  navyMid: "#1E2D45",
  gold: "#F5C518",
  white: "#FFFFFF",
  offWhite: "#E8EDF5",
  textMuted: "#8DA3C4",
  greenLight: "#228B38",
  red: "#C41E3A",
  fontClara: "#e0e1dd"
};

export const styles = {
  groupCard: (hovered) => ({
    background: colors.navyMid,
    border: `1px solid ${hovered ? 'rgba(245,197,24,0.35)' : 'rgba(255,255,255,0.07)'}`,
    borderRadius: '12px',
    padding: '20px',
    cursor: 'pointer',
    position: 'relative',
    transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
    boxShadow: hovered ? '0 16px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(245,197,24,0.15)' : 'none',
    transition: 'all 0.2s ease'
  }),
  groupCardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' },
  groupCardTitle: { fontSize: '32px', color: colors.gold, fontWeight: 'bold' },
  groupCardList: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', padding: 0, margin: 0 },
  groupCardListItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' },
  groupCardButton: { marginTop: '14px', width: '100%', padding: '9px 0', background: 'transparent', border: `1px solid rgba(245,197,24,0.3)`, borderRadius: '6px', color: colors.gold, fontSize: '11px', fontWeight: '700', letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s ease' },
  
  tableWrapper: { width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' },
  table: { width: '100%', minWidth: '320px', borderCollapse: 'collapse', tableLayout: 'fixed' },
  th: (width, textAlign) => ({ width, textAlign, fontSize: '10px', fontWeight: '700', color: colors.textMuted, padding: '8px 4px', borderBottom: `1px solid rgba(255,255,255,0.08)` }),
  tdNum: (borderLeftStyle) => ({ padding: '10px 4px', textAlign: 'left', fontSize: '12px', color: colors.textMuted, fontWeight: '600', borderBottom: `1px solid rgba(255,255,255,0.05)`, borderLeft: borderLeftStyle }),
  tdName: { padding: '10px 4px', textAlign: 'left', borderBottom: `1px solid rgba(255,255,255,0.05)`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  teamNameText: { fontWeight: '600', fontSize: '13px', color: colors.offWhite },
  tdCenter: { padding: '10px 4px', textAlign: 'center', fontSize: '13px', color: colors.offWhite, borderBottom: `1px solid rgba(255,255,255,0.05)` },
  tdSg: (gdVal) => ({ padding: '10px 4px', textAlign: 'center', fontSize: '13px', borderBottom: `1px solid rgba(255,255,255,0.05)`, color: gdVal > 0 ? '#4CAF84' : gdVal < 0 ? colors.red : colors.textMuted, fontWeight: '700' }),
  tdPts: { padding: '10px 4px', textAlign: 'center', fontSize: '16px', color: colors.gold, fontWeight: 'bold', borderBottom: `1px solid rgba(255,255,255,0.05)` },
  legendWrapper: { marginTop: '14px', display: 'flex', gap: '12px', flexWrap: 'wrap' },
  legendItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: colors.textMuted },
  legendBox: (bg) => ({ width: '10px', height: '10px', borderRadius: '2px', background: bg }),
  
  matchCard: { background: colors.navyMid, border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px 10px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' },
  matchTeamLeft: { display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 },
  matchTeamRight: { display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0, flexDirection: 'row-reverse', textAlign: 'right' },
  matchTeamText: { fontSize: '12px', fontWeight: '600', color: colors.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  matchScoreBox: (isFutureMatch) => ({ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: isFutureMatch ? '6px 8px' : '4px 10px', textAlign: 'center', minWidth: '85px', flexShrink: 0 }),
  matchFutureBox: { display: 'flex', flexDirection: 'column', lineHeight: '1.2' },
  matchDate: { fontSize: '12px', fontWeight: '800', color: colors.gold, letterSpacing: '0.3px' },
  matchTime: { fontSize: '11px', fontWeight: '600', color: colors.textMuted, marginTop: '2px' },
  matchScoreText: { fontSize: '15px', letterSpacing: '1px', color: colors.white, fontWeight: 'bold' },
  
  homeWrapper: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 12px 40px', boxSizing: 'border-box', background: `radial-gradient(ellipse at 50% 0%, rgba(245,197,24,0.12) 0%, transparent 60%), linear-gradient(180deg, #0A1628 0%, #061020 100%)`, maxWidth: '1200px', margin: '0 auto', boxShadow: '0 0 80px rgba(0,0,0,0.6)' },
  homeHeader: { textAlign: 'center', padding: '40px 0 20px', width: '100%' },
  homeSub: { fontSize: '12px', fontWeight: '700', letterSpacing: '3px', textTransform: 'uppercase', color: colors.gold, marginBottom: '12px' },
  mainTitle: { textTransform: 'uppercase', fontWeight: '900', margin: 0, color: colors.fontClara },
  mainTitleSpan: { display: 'block', fontWeight: '950', color: colors.fontClara, marginTop: '2px' },
  homeDesc: { fontWeight: '500', marginTop: '15px', color: colors.textMuted },
  
  landingStatBoxHalf: { flex: 1, background: colors.navyMid, border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '22px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' },
  landingStatNumber: { fontSize: '32px', fontWeight: '900', color: colors.white, lineHeight: '1' },
  landingStatLabel: { fontSize: '11px', fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '1px' },
  landingBtnPrimary: (hovered) => ({ flex: 1, padding: '18px 32px', background: hovered ? colors.gold : 'transparent', border: `2px solid ${colors.gold}`, borderRadius: '10px', color: hovered ? colors.navy : colors.gold, fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.2s ease', textAlign: 'center' }),
  landingBtnSecondary: (hovered) => ({ flex: 1, padding: '18px 32px', background: hovered ? colors.gold : 'transparent', border: `2px solid ${colors.gold}`, borderRadius: '10px', color: hovered ? colors.navy : colors.gold, fontSize: '14px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.2s ease', textAlign: 'center' }),

  detailWrapper: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: colors.navy, maxWidth: '1200px', margin: '0 auto', boxShadow: '0 0 80px rgba(0,0,0,0.6)' },
  detailHeader: { background: colors.navyMid, borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' },
  backButton: { background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: colors.textMuted, padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s ease' },
  nextButton: (hovered) => ({ background: hovered ? 'rgba(245,197,24,0.1)' : 'transparent', border: `1px solid ${colors.gold}`, color: colors.gold, padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s ease' }),
  detailHeaderTitle: { fontSize: '18px', color: colors.fontClara, fontWeight: 'bold', textAlign: 'center' },
  
  // CORREÇÃO: Títulos "Classificação" e "Jogos do Grupo" descolados do topo
  sectionTitle: { fontSize: '11px', fontFamily: "'Montserrat', sans-serif", fontWeight: '700', letterSpacing: '2px', color: colors.textMuted, textTransform: 'uppercase', paddingTop: '16px', marginBottom: '14px' },

  thirdPlacesBtn: (hovered) => ({ padding: '14px 28px', background: hovered ? colors.gold : 'transparent', border: `2px solid ${colors.gold}`, borderRadius: '8px', color: hovered ? colors.navy : colors.gold, fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.2s ease' }),
  loadingWrapper: { minHeight: '100vh', background: colors.navy, color: colors.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '600' },

  tabContainer: { display: 'flex', justifyContent: 'center', gap: '12px', margin: '20px 0', padding: '0 20px' },
  tabButton: (active) => ({ padding: '10px 20px', background: active ? colors.gold : colors.navyMid, border: `1px solid ${active ? colors.gold : 'rgba(255,255,255,0.1)'}`, color: active ? colors.navy : colors.white, fontWeight: '700', fontSize: '12px', borderRadius: '20px', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 0.2s ease' }),

  bracketMatchHeader: { fontSize: '9px', color: colors.gold, fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase', paddingBottom: '2px' },
  bracketTeamText: (active) => ({ fontSize: '12px', fontWeight: active ? '700' : '500', color: active ? colors.white : colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }),
  bracketScoreField: { background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', color: colors.white },

  // CORREÇÃO: Nova regra para diminuir a largura máxima da tabela de melhores 3ºs colocados
  thirdPlacesTableContainer: {
    maxWidth: '700px',
    margin: '0 auto 30px auto',
    width: '100%',
    padding: '0 16px',
    boxSizing: 'border-box'
  },

  // CORREÇÃO: Título das rodadas com a fonte certa e margem inferior aumentada para descolar da caixa
  roundTitle: {
    fontSize: '11px',
    fontFamily: "'Montserrat', sans-serif",
    fontWeight: '800',
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    marginBottom: '16px',
    marginTop: '10px'
  }
};