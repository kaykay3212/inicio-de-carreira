# Maya Souza Nails — site de agendamento

- Site no ar: https://maya-souza-nails.onrender.com (serviço Render `srv-dc1r1nss728c73d6rn6g`, branch `claude/manicure-scheduling-site-py7593`).
- O Render NÃO publica sozinho ao receber push: depois de `git push`, rode `scripts/deploy.sh` (usa a chave do Render injetada pelo ambiente).
- Dados do studio (nome, WhatsApp, Instagram, horários, serviços e preços) ficam em `src/config.js`.
- Fotos da galeria: `public/img/galeria/` (o nome do arquivo vira a legenda). Redimensione para ~1000px e remova metadados antes de adicionar.
- Sem `DATABASE_URL`, os agendamentos ficam em arquivo e se perdem a cada deploy/reinício do Render.
- Textos e comunicação com a dona do site em português do Brasil.
