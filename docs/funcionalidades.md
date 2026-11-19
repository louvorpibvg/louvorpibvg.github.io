# Funcionalidades e decisões

Situação em 19/11/2026. "Publicado" = está no ar; "testado" indica onde foi conferido.

## Publicado
| Área | O que faz | Testado |
|---|---|---|
| Login | Código de 6 dígitos por e-mail; quem não está cadastrado pede acesso e aguarda aprovação | Computador |
| Início | Próximas escalas da pessoa, próxima programação, eventos abertos, pedidos pendentes | Computador |
| Escalas | Domingos 18h e 20h (mesma equipe), eventos especiais por disponibilidade, copiar equipe entre horários, filtros | Computador |
| Repertório do dia | Lista do Cifra Club, tom previsto/tocado, capotraste com forma calculada, campo harmônico, progressão, diagramas | Computador e emulação 375px |
| Catálogo | Cerca de 93 músicas, busca, filtro por tom, edição com editor de progressões | Computador |
| Diagramas | Violão (Padrão / Sem pestana) e teclado, sugestão de capotraste para evitar pestana | Computador e emulação 375px |
| Dicionário de acordes | Tocar em um acorde abre posições no braço, teclado e variações | Emulação 375px |
| Equipamentos | Lista de recomendações com link e data de verificação | Computador |
| Perfil | Funções da pessoa com nível (titular, substituto, aprendendo) | Computador |
| Gestão | Aprovar acessos, validar funções, cadastrar integrantes e e-mails | Computador |
| Página de links | Substitui o Linklist; tema claro/escuro | Android e iPhone |

## Decisões
- Tecnologia simples (HTML/CSS/JS puros) para que voluntários consigam manter.
- Hospedagem gratuita: GitHub Pages + Supabase Free (com ping diário para não pausar).
- Login sem senha (código no e-mail) para facilitar o uso pelos integrantes.
- Autorização no banco (RLS), não só na interface.
- Escalas montadas pela liderança; nada de distribuição automática.
- Progressões guardadas em graus para transpor para qualquer tom.
- Modo "Sem pestana" como padrão no violão.

## Ainda não verificado
- Uso completo em iPhone e Android reais (login, escalas, diálogos, diagramas).
- Comportamento sem internet.
