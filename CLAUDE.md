# Maya Souza Nails — site de agendamento

- Site no ar: https://maya-souza-nails.onrender.com (serviço Render `srv-dc1r1nss728c73d6rn6g`, branch `claude/manicure-scheduling-site-py7593`).
- O Render NÃO publica sozinho ao receber push: depois de `git push`, rode `scripts/deploy.sh` (usa a chave do Render injetada pelo ambiente).
- Valores padrão do studio ficam em `src/config.js`, mas serviços, preços, horários, pausa, frase e endereço são editados pela dona no painel `/admin` e salvos no banco (tabela `ajustes`), que tem prioridade. Para mudar esses itens, prefira o painel/API `PUT /api/admin/ajustes` em vez do `config.js`.
- Folgas/bloqueios: tabela `bloqueios` (painel → Folgas).
- Avisos de novo agendamento: app ntfy, tópico na variável `NTFY_TOPICO` do Render (não colocar no código).
- Visual: escuro inspirado no lusion.co; o 3D do topo é `public/js/cena.js` (WebGL puro, qualidade adaptativa, sem arquivos externos). Manter leve: nada de bibliotecas 3D pesadas, blur animado ou backdrop-filter em excesso.
- Fotos da galeria: `public/img/galeria/` (o nome do arquivo vira a legenda). Redimensione para ~1000px e remova metadados antes de adicionar.
- Agendamentos ficam no PostgreSQL do Neon (projeto `maya-souza-nails`, `square-hill-49843924`, região aws-us-east-1), ligado ao Render pela variável `DATABASE_URL`. A chave da API do Neon (console.neon.tech) também está no ambiente. Não mexer no projeto Neon `nexus-finance`, que é de outro sistema.
- Sem `DATABASE_URL` (ex.: rodando localmente), os agendamentos vão para `data/agendamentos.json`.
- Textos e comunicação com a dona do site em português do Brasil.
- O site NÃO é mantido acordado (a dona pediu para tirar): no plano grátis do Render ele dorme após 15 min sem visitas e a primeira visita depois disso demora ~30–50 s.
