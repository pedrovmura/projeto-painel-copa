# Painel Copa do Mundo 2026

Painel interativo para acompanhar a Copa do Mundo de 2026: classificação dos grupos, chaveamento do mata-mata, simulador de resultados e uma seção de fatos e curiosidades. Funciona no navegador e pode ser instalado no celular como app.

🔗 **Acesse:** [tab-copa26.netlify.app](https://tab-copa26.netlify.app)

---

## Funcionalidades

### Página inicial
- Contagem regressiva até a grande final
- Jogos realizados e restantes (de 104)
- **Jogos de hoje**, com destaque **"ao vivo"** calculado pelo horário de cada partida
- **Próximos jogos**, exibidos quando não há partidas no dia
- **Busca por seleção**: posição, pontos, saldo de gols e todos os jogos do time

### Fase de grupos
- Tabela dos 12 grupos com critérios de desempate: pontos, confronto direto, saldo de gols, gols pró, cartões e ranking FIFA
- Ranking dos **8 melhores terceiros colocados**
- Cálculo de **classificados e eliminados matematicamente**: o app simula todas as combinações de resultado dos jogos restantes (vitória, empate, derrota) para saber quem já garantiu vaga ou não tem mais chance
- Filtro por **confederação**, com resumo de classificados, em disputa e eliminados

### Fase eliminatória
- Chaveamento dividido em chave esquerda e direita, com final e disputa de 3º lugar ao centro
- Navegação por fase: 16avos, oitavas, quartas e semifinais
- Preenchimento automático dos confrontos ("Vencedor do Jogo 73", "1º do Grupo A") à medida que os resultados saem
- Suporte a placares com **pênaltis**

### Simulador
1. Defina a ordem de classificação de cada grupo
2. Escolha os 8 melhores terceiros
3. Clique nos vencedores de cada jogo até a final. Desfazer uma escolha limpa automaticamente as fases seguintes que dependiam dela.
4. **Compartilhe** a simulação (Web Share API no celular ou cópia para a área de transferência)

### Fatos & Curiosidades
- **Copa 2026:** Messi × Mbappé na corrida pela artilharia histórica, a trajetória de Cristiano Ronaldo em 6 Copas, artilheiros, assistências, ataques e defesas, times invictos, recordes da edição e recordes históricos quebrados
- **História:** linha do tempo interativa de 1930 a 2022, maiores campeões e recordes de todas as Copas
- **Seleções:** estreantes e seleções de volta ao Mundial

### PWA e modo offline
- Instalável na tela inicial do celular
- Service worker com cache: os arquivos do app usam *cache first*, e os dados da planilha usam *network first* com fallback para a última versão salva. Assim o painel continua funcionando sem internet.
- Avisos de nova versão disponível e de conexão perdida ou restaurada

---

## Como os dados funcionam

O projeto não tem back-end. Os dados ficam em uma planilha do **Google Sheets publicada na web como CSV**, e o app lê essa planilha direto do navegador, atualizando a cada 60 segundos. Para registrar um resultado, basta editar a planilha, sem precisar mexer no código nem fazer um novo deploy.

A planilha tem 4 abas:

| Aba | Colunas principais |
|---|---|
| **Jogos** (fase de grupos) | grupo, rodada, time1, placar1, placar2, time2, data, hora |
| **Times** | time, cartões, ranking FIFA |
| **Eliminatórias** | fase, jogo, time1, placar1, placar2, time2, data, hora |
| **Jogadores** | seleção, jogador, gols, xG, assist, jogos, gols na copa, jogos na copa |

Na aba de eliminatórias, os confrontos podem ser escritos como referências que o app resolve sozinho:
- `1° A`, `2° B`: posição em um grupo
- `3° A/B/C/D`: terceiro colocado
- `V 73` / `P 73`: vencedor ou perdedor do jogo 73
- Placar com pênaltis: `1(4)` significa 1 gol no jogo e 4 nos pênaltis

---

## Tecnologias

- [React 19](https://react.dev/)
- [Vite](https://vite.dev/)
- JavaScript (JSX)
- Google Sheets (CSV publicado) como fonte de dados
- Service Worker + Web App Manifest (PWA)
- [flag-icons](https://github.com/lipis/flag-icons) para as bandeiras
- Deploy no [Netlify](https://www.netlify.com/)

---

## Rodando localmente

Pré-requisito: [Node.js](https://nodejs.org/) instalado.

```bash
git clone https://github.com/pedrovmura/projeto-painel-copa.git
cd projeto-painel-copa
npm install
npm run dev
```

O app abre em `http://localhost:5173`.

Para testar o service worker e o modo offline, use o build de produção:

```bash
npm run build
npm run preview
```

---

## Estrutura do projeto

```
├── public/
│   ├── manifest.json      # Configuração do PWA (nome, ícones, cores)
│   └── sw.js              # Service worker (cache e modo offline)
├── src/
│   ├── App.jsx            # Telas e componentes do app
│   ├── groupsData.js      # Leitura do CSV, classificação e desempates
│   ├── main.jsx           # Ponto de entrada e registro do service worker
│   └── styles/
│       ├── appStyles.js   # Cores e estilos dos componentes
│       └── styles.css     # Estilos globais, responsividade e animações
├── index.html
└── vite.config.js
```

---

## Como foi feito

Projeto pessoal desenvolvido na semana anterior à Copa, durante o meu 1º semestre de Ciência da Computação, com o **Claude** como assistente de programação. Eu defini as funcionalidades, a estrutura, o visual e a forma de usar o Google Sheets como fonte de dados, e fui revisando e ajustando o código até a versão final.

---

Feito por [Pedro Vama Murakami](https://www.linkedin.com/in/pedro-vama-murakami) · [GitHub](https://github.com/pedrovmura)