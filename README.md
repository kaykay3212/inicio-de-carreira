# 💅 Maya Souza Nails — Site de Agendamento

🌐 **No ar:** https://maya-souza-nails.onrender.com · Painel: https://maya-souza-nails.onrender.com/admin

O Render publica sozinho cada novo commit no branch `claude/manicure-scheduling-site-py7593`.

Site para manicure com:

- **Galeria** das unhas já feitas, para atrair clientes (com zoom ao tocar na foto)
- **Lista de serviços** com preço e duração
- **Agendamento online**: a cliente escolhe serviço → dia → horário → nome e WhatsApp.
  O sistema só mostra horários livres, respeita a duração de cada serviço e a pausa do almoço,
  e não deixa duas clientes marcarem o mesmo horário.
- Depois de agendar, a cliente tem um botão **"Avisar pelo WhatsApp"** com a mensagem pronta
- **Painel da manicure** em `/admin` (com senha): vê a agenda dos próximos dias, chama a cliente
  no WhatsApp e cancela horários (o horário volta a ficar livre no site)

## Como personalizar

| O quê | Onde |
|---|---|
| Nome, slogan, WhatsApp, Instagram, endereço | `src/config.js` |
| Serviços, preços e duração | `src/config.js` → `servicos` |
| Dias e horários de atendimento, almoço | `src/config.js` → `horarios` e `pausa` |
| Fotos da galeria | pasta `public/img/galeria/` |

### Colocando as fotos das unhas

1. Coloque suas fotos (`.jpg`, `.png` ou `.webp`) na pasta `public/img/galeria/` (para tirar uma foto do site, é só apagar o arquivo).
2. **O nome do arquivo vira a legenda**: `01-francesinha-rosa.jpg` aparece como "Francesinha rosa".
   O número no começo serve só para definir a ordem (as 3 primeiras aparecem também no topo do site).
3. Dica: use fotos em pé (retrato) e com até ~500 KB cada para o site ficar rápido.

## Rodando no computador

```bash
npm install
npm start
```

Abra http://localhost:3000. O painel fica em http://localhost:3000/admin (senha local: `admin123`).

## Publicando no Render

1. Entre em https://render.com e faça login com sua conta do GitHub.
2. Clique em **New → Blueprint** e escolha este repositório. O Render lê o arquivo `render.yaml`
   e cria o site sozinho.
3. Quando pedir `DATABASE_URL`, você pode deixar em branco por enquanto (veja abaixo).
4. Depois do deploy, vá em **Environment** do serviço para ver a senha gerada em `ADMIN_PASSWORD`
   (ou troque por uma senha sua).

### ⚠️ Importante: onde os agendamentos ficam salvos

- **Sem `DATABASE_URL`**: os agendamentos ficam num arquivo dentro do servidor. No plano gratuito do Render
  esse arquivo **é apagado** quando o servidor reinicia ou quando há um novo deploy. Serve para testar.
- **Com `DATABASE_URL`** (recomendado para uso real): os agendamentos ficam num banco PostgreSQL e não se perdem.
  Crie um banco em **New → PostgreSQL** no Render (ou em um serviço gratuito como Neon ou Supabase),
  copie a *connection string* e cole em `DATABASE_URL`. A tabela é criada automaticamente.

> No plano gratuito do Render, o site "dorme" depois de 15 min sem acesso e demora ~30 s para abrir
> na primeira visita seguinte.

## Estrutura

```
server.js          servidor (Express) e API
src/config.js      configurações do studio
src/store.js       salvamento dos agendamentos (arquivo JSON ou PostgreSQL)
public/            site (HTML, CSS, JS, imagens)
render.yaml        configuração de deploy no Render
```
