# Formulário de presente

Páginas: `/presente` (alunos) e `/respostas` (consulta com senha). Não há links para elas na página inicial. O site original não foi alterado.

## Ativar na Vercel

1. Adicione estes arquivos ao repositório, mantendo as pastas `assets`, `api`, `presente` e `respostas`, além de `vercel.json`. Não configure uma pasta de saída diferente da raiz. Projeto estático, preset Other; não exige build nem pacotes npm.
2. Crie um banco Redis persistente no Upstash (ou conecte a integração Upstash ao projeto Vercel). Não use banco temporário.
3. Em Settings → Environment Variables do projeto Vercel, configure para Production:
   - `KV_REST_API_URL`: endpoint HTTPS REST do banco.
   - `KV_REST_API_TOKEN`: token com leitura e escrita.
   - `PRESENTE_ADMIN_USER`: usuário de acesso.
   - `PRESENTE_ADMIN_PASSWORD`: senha exclusiva com pelo menos 16 caracteres; use um gerenciador de senhas.
4. Faça um novo deploy para carregar as variáveis. Nunca coloque tokens ou senha nos arquivos do GitHub ou no HTML.
5. Abra `/presente`, envie uma resposta de teste e confira em `/respostas` com sua senha, inclusive em outro dispositivo. Só compartilhe o formulário após essa conferência.

A API fica indisponível até as quatro variáveis serem configuradas. Nunca confirma um envio sem o banco responder. Respostas ficam no hash `presentes:2026:respostas`, sem expiração. O mesmo envio reenviado após falha de conexão usa a mesma chave e não duplica. Um preenchimento novo após recarregar a página é uma nova resposta (nomes iguais não são bloqueados).

A consulta usa cookie HttpOnly, Secure e SameSite=Strict por 8 horas. Há validação no servidor e limites de tentativas. Alterar a senha invalida sessões existentes. Não há senha padrão. Banco usado apenas pela API; o navegador não recebe tokens. Não é necessário Google Sheets.

## Validação local

`node --test tests/presente.test.cjs`

Os testes usam banco simulado: não comprovam conexão com o banco real ou deploy. Para validar a integração completa, use um deploy Preview com banco separado e as variáveis também configuradas em Preview.

Referências: https://upstash.com/docs/redis/features/restapi e https://vercel.com/docs/functions/runtimes/node-js
