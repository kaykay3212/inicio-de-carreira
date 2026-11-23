# Maya Souza Nails — site de agendamento

- Site no ar: https://maya-souza-nails.onrender.com (serviço Render `srv-dc1r1nss728c73d6rn6g`, branch `claude/manicure-scheduling-site-py7593`).
- O Render NÃO publica sozinho ao receber push: depois de `git push`, rode `scripts/deploy.sh` (usa a chave do Render injetada pelo ambiente).
- Dados do studio (nome, WhatsApp, Instagram, horários, serviços e preços) ficam em `src/config.js`.
- Fotos da galeria: `public/img/galeria/` (o nome do arquivo vira a legenda). Redimensione para ~1000px e remova metadados antes de adicionar.
- Agendamentos ficam no PostgreSQL do Neon (projeto `maya-souza-nails`, `square-hill-49843924`, região aws-us-east-1), ligado ao Render pela variável `DATABASE_URL`. A chave da API do Neon (console.neon.tech) também está no ambiente. Não mexer no projeto Neon `nexus-finance`, que é de outro sistema.
- Sem `DATABASE_URL` (ex.: rodando localmente), os agendamentos vão para `data/agendamentos.json`.
- Textos e comunicação com a dona do site em português do Brasil.
- O servidor se mantém acordado das 07:00 às 22:00 (`manterAcordado` em `src/config.js`), visitando o próprio `/healthz` a cada 10 min. Não ampliar para 24h: a cota grátis do Render (750 h/mês) é compartilhada com o serviço `nexus-finance` da mesma conta. Não pingar o banco (Neon grátis tem cota de horas de computação).
- De manhã, a tarefa do GitHub Actions `.github/workflows/acordar-site.yml` (no branch `main`, que é onde o GitHub roda tarefas agendadas) visita o site entre 06:40 e 07:20 de Brasília para ele já estar acordado.
