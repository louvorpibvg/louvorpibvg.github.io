# Plataforma do Ministério de Louvor — PIB Vila Garrido

Contexto para o Claude Code. Leia este arquivo inteiro antes de mexer no projeto.

## O que é
Site + plataforma web do Ministério de Louvor da Primeira Igreja Batista em Vila Garrido (Vila Velha/ES).
- Página de links pública: https://louvorpibvg.github.io (arquivo `index.html` na raiz)
- Plataforma (login obrigatório): https://louvorpibvg.github.io/app/ (pasta `app/`)
- Funções: escalas dos cultos, repertório do dia, catálogo de músicas, campo harmônico, diagramas de acordes (violão/teclado), progressões em graus, equipamentos recomendados, perfil e gestão de integrantes.
- Um módulo futuro para o PGM (Pequeno Grupo Multiplicador) está só em planejamento. Não implementar sem pedido explícito.

O responsável técnico é o Pedro (administrador). Ele não é programador profissional: explique em português simples, sem jargão desnecessário.

## Como responder e trabalhar
- Sempre em português brasileiro. Datas DD/MM/AAAA, horas em 24h, valores em R$.
- Seja direto e organizado. Questione premissas quando houver opção mais simples ou segura.
- Não invente dados de integrantes, músicas, tons, BPM ou arranjos.
- Não altere nem apague nada sem pedido explícito; mudanças destrutivas exigem confirmação.
- Diferencie "implementado", "testado no computador" e "testado em iPhone/Android reais".
- Compatibilidade com iPhone (Safari) e Android (Chrome) é requisito obrigatório. Não dependa de hover, clique direito, pop-ups nem APIs exclusivas do Chrome. Não declare que funciona no iOS sem teste real.

## Tecnologia (decisões já tomadas, preservar)
- HTML, CSS e JavaScript puros (módulos ES), sem build, sem framework, sem npm.
- Supabase (Postgres + RLS + login por código no e-mail) como backend.
- Hospedagem: GitHub Pages deste repositório (público, plano Free). Publicar = fazer push na branch `main`.
- Biblioteca única externa: `@supabase/supabase-js@2.45.4` via jsdelivr (ESM), importada em `app/app.js`.

## Estrutura
```
index.html                 página de links pública (Linklist próprio)
img/                       logos e ícones (identidade: azul-marinho #294657, verde #3BA285, Montserrat + Open Sans)
app/index.html             casca da plataforma (carrega estilo.css?v=N e app.js?v=N)
app/app.js                 aplicação inteira: rotas por hash, telas, diálogos, acesso ao Supabase
app/musica.js              teoria musical: campo harmônico, transposição de graus, acordes→graus, capotraste
app/diagramas.js           diagramas de violão (modo Padrão e Sem pestana) e teclado, sugestão de capotraste
app/acordes.js             dicionário de acordes: calcula posições no braço a partir das notas, variações
app/estilo.css             estilos (tema claro/escuro próprio, responsivo: celular, tablet, computador ≥1024px)
app/config.js              URL do Supabase e chave PUBLICÁVEL (pode ficar no frontend)
app/manifest.webmanifest   PWA (adicionar à tela inicial)
.github/workflows/manter-ativo.yml   ping diário para o Supabase Free não pausar
supabase/migrations/       estrutura do banco (tabelas, RLS, funções). Sem dados pessoais.
docs/                      documentação técnica e decisões
_privado/                  NÃO VAI PARA O GITHUB (está no .gitignore): dados iniciais com nomes e e-mails, histórico, identidade visual
```

## Regra de cache (importante)
O GitHub Pages guarda arquivos em cache por até 10 minutos. Toda vez que mudar um arquivo de `app/`:
1. Aumente o número `?v=` de quem importa o arquivo:
   - mudou `estilo.css` → `app/index.html` (`estilo.css?v=N`)
   - mudou `app.js` → `app/index.html` (`app.js?v=N`)
   - mudou `musica.js`, `diagramas.js` ou `acordes.js` → os `import` em `app/app.js` (e `diagramas.js` importa `musica.js`; use o MESMO número nos dois lugares) e depois `app.js?v=N` no index.
2. Versões atuais: `estilo.css?v=8`, `app.js?v=11`, `musica.js?v=9`, `diagramas.js?v=8`, `acordes.js?v=10`.
3. Faça o push de todos os arquivos juntos e só confira o site ao vivo depois de 1 a 2 minutos.

Lição aprendida (06/11/2026): um arquivo novo chegou vazio ao GitHub e a plataforma travou em "Carregando…". Antes de publicar, confira `git diff --stat` e rode `node --check` nos arquivos JS.

## Checagens antes de publicar
```bash
for f in app/*.js; do node --input-type=module --check < "$f" || echo "ERRO em $f"; done
git status && git diff --stat
```
Se possível, teste no navegador (Playwright ou servidor local `python3 -m http.server`) nas larguras 375px e 1366px. O login exige e-mail real, então telas internas só podem ser vistas com uma sessão válida.

## Banco de dados (Supabase)
- Projeto `louvor-pibvg`, ref `hpvbnhihawrqvjbnqomb`, região São Paulo, plano Free, organização "Ministério de Louvor PIB VG".
- Login: código de 6 dígitos por e-mail (`signInWithOtp` + `verifyOtp`), SMTP do Gmail do ministério.
- Tabelas: `funcoes`, `tipos_evento`, `integrantes`, `acessos` (e-mail ↔ integrante), `integrante_funcoes` (nível titular/substituto/aprendendo + validado), `programacoes` (dia), `cultos` (horário, modo fixa/disponibilidade), `escala_posicoes`, `disponibilidades`, `musicas` (inclui `progressao` em graus), `repertorio_itens` (tom previsto/tocado, `capo`), `equipamentos`.
- Perfis: `admin`, `lider`, `membro` (+ `pode_aprovar`). A autorização é feita no banco (RLS + funções `sou_admin()`, `sou_lider()`, `sou_ministro_de()` etc.), nunca só escondendo botões.
- O banco em produção é a fonte da verdade. Os arquivos em `supabase/migrations/` refletem a estrutura de 05/11/2026. Antes de alterar o banco, confira a estrutura atual (Supabase MCP ou painel) e escreva a mudança como um novo arquivo numerado em `supabase/migrations/`.
- Nunca colocar a chave secreta (service_role/secret) nem a senha do banco no código ou no repositório. Só a chave publicável vai para o frontend.

## Convenções da parte musical
- Progressões ficam salvas em graus (`Intro: I V vi IV`), uma seção por linha, e são transpostas na hora para o tom tocado. Com capotraste, mostra-se também a "forma".
- Tons aceitos: maiores e menores com # ou b (`tomValido` em musica.js).
- Violão: o modo padrão para o usuário é "Sem pestana" (o Pedro sente dor ao fazer pestana). Ordem de preferência: aberto → fechado sem pestana → pestana pequena → pestana completa, com substitutos (F→F7M, F#m→F#m7, C#m→C#m7, B→B7, Bb→Bb7M).
- Cifra brasileira na tela: sétima maior é sempre `7M` (F7M, VI7M), nunca a forma americana `maj7`; suspensos são `4`, `2` e `7(4)` (A4, VII4), nunca `sus4`/`sus2`. O sistema ainda ACEITA `maj7`/`sus` digitados ou já salvos no banco, mas sempre MOSTRA a forma brasileira.
- Direitos autorais: guardar só acordes e links. Nunca copiar letras ou cifras completas para o banco ou o repositório.

## Segurança e privacidade (LGPD)
- O repositório é PÚBLICO e tudo nele é publicado no site. Não comitar nomes, e-mails ou qualquer dado de integrante. Esse material fica em `_privado/` (ignorado pelo git).
- Coletar só os dados necessários. Nada de dados sensíveis (saúde, aconselhamento, pedidos de oração identificáveis).
- Contas e senhas (Gmail, Supabase, GitHub) são digitadas pelo próprio Pedro. Nunca pedir que ele cole senhas no chat.

## Pendências conhecidas
- Cadastrar os e-mails dos integrantes (tela Gestão) para eles poderem entrar.
- Testar em iPhone e Android reais (até agora só emulação).
- Preencher tons, links do Cifra Club e progressões das músicas mais usadas.
- Apresentar a plataforma ao pastor.
- Opcional: botão "Entrar na plataforma" na página de links.
- Detalhes no histórico: `_privado/historico-de-atualizacoes.md` e `docs/`.
