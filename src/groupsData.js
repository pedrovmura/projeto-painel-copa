// Funções auxiliares básicas
export const pts = (t) => (t.w || 0) * 3 + (t.d || 0);
export const gd = (t) => (t.gf || 0) - (t.ga || 0);

// Ordenação aplicando TODOS os critérios de desempate solicitados
export const sortedTeams = (teamsList, matches, extraTeamInfo = {}) => {
  if (!teamsList) return [];
  const stats = {};
  
  // Inicializa cada time cruzando com os dados da aba "Times"
  teamsList.forEach(name => { 
    const info = extraTeamInfo[name] || {};
    stats[name] = { 
      name, 
      w: 0, d: 0, l: 0, gf: 0, ga: 0,
      cartoes: info.cartoes !== undefined ? info.cartoes : 999,
      ranking: info.ranking !== undefined ? info.ranking : 999
    }; 
  });

  // Calcula gols e pontos a partir da aba "Jogos"
  if (matches) {
    matches.forEach(m => {
      if (m.s1 !== null && m.s2 !== null && stats[m.t1] && stats[m.t2]) {
        stats[m.t1].gf += m.s1;
        stats[m.t1].ga += m.s2;
        stats[m.t2].gf += m.s2;
        stats[m.t2].ga += m.s1;

        if (m.s1 > m.s2) { stats[m.t1].w++; stats[m.t2].l++; }
        else if (m.s1 < m.s2) { stats[m.t2].w++; stats[m.t1].l++; }
        else { stats[m.t1].d++; stats[m.t2].d++; }
      }
    });
  }

  return Object.values(stats).sort((a, b) => {
    // 1º Critério: Pontos (Maior na frente)
    if (pts(b) !== pts(a)) return pts(b) - pts(a);
    
    // 2º Critério: Confronto Direto
    if (matches) {
      const h2h = matches.find(m => 
        m.s1 !== null && m.s2 !== null &&
        ((m.t1 === a.name && m.t2 === b.name) || (m.t1 === b.name && m.t2 === a.name))
      );
      if (h2h) {
        if (h2h.t1 === a.name && h2h.s1 !== h2h.s2) return h2h.s2 - h2h.s1;
        if (h2h.t2 === a.name && h2h.s1 !== h2h.s2) return h2h.s1 - h2h.s2;
      }
    }

    // 3º Critério: Saldo de Gols (Maior na frente)
    if (gd(b) !== gd(a)) return gd(b) - gd(a);
    
    // 4º Critério: Gols Marcados (Maior na frente)
    if ((b.gf || 0) !== (a.gf || 0)) return (b.gf || 0) - (a.gf || 0);
    
    // 5º Critério: Menos Cartões (Menor número na frente)
    if (a.cartoes !== b.cartoes) return a.cartoes - b.cartoes;
    
    // 6º Critério: Ranking da FIFA (Número menor/melhor posição na frente)
    return a.ranking - b.ranking;
  });
};

export const getBestThirdPlaces = (allGroups, extraTeamInfo = {}) => {
  if (!allGroups || allGroups.length === 0) return [];
  const thirds = allGroups.map(g => {
    const sorted = sortedTeams(g.teams, g.matches, extraTeamInfo);
    return sorted[2] ? sorted[2] : null;
  }).filter(Boolean);

  const sortedThirds = [...thirds].sort((a, b) => {
    if (pts(b) !== pts(a)) return pts(b) - pts(a);
    if (gd(b) !== gd(a)) return gd(b) - gd(a);
    if ((b.gf || 0) !== (a.gf || 0)) return (b.gf || 0) - (a.gf || 0);
    if (a.cartoes !== b.cartoes) return a.cartoes - b.cartoes;
    return a.ranking - b.ranking;
  });

  return sortedThirds.slice(0, 8).map(t => t.name);
};

export const parseCSVToGroups = (jogosCsv, teamsCsv) => {
  const groupMap = {};
  const extraTeamInfo = {};
  
  const cleanLines = (csvText) => {
    return csvText.replace(/\r/g, "").split("\n").map(line => line.trim()).filter(Boolean);
  };

  // 1. LEITURA DA ABA 'TIMES' (Cartões e Ranking FIFA)
  const teamLines = cleanLines(teamsCsv);
  if (teamLines.length > 0) {
    const teamSep = teamLines[0].includes(";") ? ";" : ",";
    const teamHeaders = teamLines[0].split(teamSep).map(s => s.trim().toLowerCase());
    
    const idxTime = teamHeaders.indexOf("time");
    const idxCartoes = teamHeaders.indexOf("cartões") !== -1 ? teamHeaders.indexOf("cartões") : teamHeaders.indexOf("cartoes");
    const idxRanking = teamHeaders.indexOf("rankingfifa") !== -1 ? teamHeaders.indexOf("rankingfifa") : teamHeaders.indexOf("ranking fifa");

    teamLines.slice(1).forEach(line => {
      const cols = line.split(teamSep).map(s => s.trim());
      const name = cols[idxTime];
      if (name) {
        extraTeamInfo[name] = {
          cartoes: parseInt(cols[idxCartoes], 10) || 0,
          ranking: parseInt(cols[idxRanking], 10) || 999
        };
      }
    });
  }

  // 2. LEITURA DA ABA 'JOGOS'
  const matchLines = cleanLines(jogosCsv);
  if (matchLines.length === 0) return [];

  const separator = matchLines[0].includes(";") ? ";" : ",";
  const matchHeaders = matchLines[0].split(separator).map(s => s.trim().toLowerCase());
  
  const idxGrupo = matchHeaders.indexOf("grupo");
  const idxRodada = matchHeaders.indexOf("rodada");
  const idxTime1 = matchHeaders.indexOf("time1");
  const idxPlacar1 = matchHeaders.indexOf("placar1");
  const idxPlacar2 = matchHeaders.indexOf("placar2");
  const idxTime2 = matchHeaders.indexOf("time 2") !== -1 ? matchHeaders.indexOf("time 2") : matchHeaders.indexOf("time2");
  const idxData = matchHeaders.indexOf("data");
  const idxHora = matchHeaders.indexOf("hora");

  matchLines.slice(1).forEach((line, index) => {
    const columns = line.split(separator).map(s => s.trim());
    
    let rawGrp = columns[idxGrupo] || "";
    let grp = rawGrp.replace(/grupo/i, "").trim(); 

    let rawRound = columns[idxRodada] || "";
    let round = parseInt(rawRound.replace(/\D/g, ""), 10) || 1;

    const t1 = columns[idxTime1];
    const t2 = columns[idxTime2];
    const s1Str = columns[idxPlacar1];
    const s2Str = columns[idxPlacar2];
    const date = columns[idxData] || "";
    const time = columns[idxHora] || "";

    if (grp && t1 && t2) {
      if (!groupMap[grp]) {
        groupMap[grp] = { id: grp, teams: [], matches: [], extraTeamInfo };
      }

      if (!groupMap[grp].teams.includes(t1)) groupMap[grp].teams.push(t1);
      if (!groupMap[grp].teams.includes(t2)) groupMap[grp].teams.push(t2);

      const s1 = (s1Str === undefined || s1Str === "" || isNaN(s1Str)) ? null : parseInt(s1Str, 10);
      const s2 = (s2Str === undefined || s2Str === "" || isNaN(s2Str)) ? null : parseInt(s2Str, 10);
      
      groupMap[grp].matches.push({ 
        id: `jogo-${index}`, 
        r: round, 
        date, 
        time, 
        t1, 
        t2, 
        s1, 
        s2 
      });
    }
  });

  return Object.values(groupMap).sort((a, b) => a.id.localeCompare(b.id));
};