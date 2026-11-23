# Maya Souza Nails — site de agendamento

- Site no ar: https://maya-souza-nails.onrender.com (serviço Render `srv-dc1r1nss728c73d6rn6g`, branch `claude/manicure-scheduling-site-py7593`).
- O Render NÃO publica sozinho ao receber push: depois de `git push`, rode `scripts/deploy.sh` (usa a chave do Render injetada pelo ambiente).
- Dados do studio (nome, WhatsApp, Instagram, horários, serviços e preços) ficam em `src/config.js`.
- Fotos da galeria: `public/img/galeria/` (o nome do arquivo vira a legenda). Redimensione para ~1000px e remova metadados antes de adicionar.
- Agendamentos ficam no PostgreSQL do Neon (projeto `maya-souza-nails`, `square-hill-49843924`, região aws-us-east-1), ligado ao Render pela variável `DATABASE_URL`. A chave da API do Neon (console.neon.tech) também está no ambiente. Não mexer no projeto Neon `nexus-finance`, que é de outro sistema.
- Sem `DATABASE_URL` (ex.: rodando localmente), os agendamentos vão para `data/agendamentos.json`.
- Textos e comunicação com a dona do site em português do Brasil.
