# Ctrl X Frontend

Aplicação web responsiva para acompanhamento de saúde de pacientes e profissionais, acessível pelo navegador em desktop, tablet e celular.

O frontend é implantado na Vercel e o backend na Railway.

## Stack

- Next.js App Router, React e TypeScript 6 estrito, compatível com o parser do ESLint.
- CSS Modules e variáveis CSS em `src/styles`.
- React Hook Form, Zod e `@hookform/resolvers` para os próximos formulários.
- TanStack Query para estado remoto, com provider por instância da aplicação.
- ESLint com as configurações oficiais do Next.js.

As versões estão em `package.json` e fixadas pelo `package-lock.json`.

## Desenvolvimento no Windows

Use uma versão atualizada do Node.js 22 e npm, conforme o package.json e o CI.

O processo de release e a configuração do GitHub Actions estão em [CI-CD.md](CI-CD.md).

Antes de iniciar, crie `.env.local` se ainda não existir e configure `API_URL` para a API local (por exemplo, `http://localhost:8000/api/v1`). Preserve o arquivo e os valores locais existentes.

```powershell
npm ci
npm run dev
```

Abra http://localhost:3000.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

## Organização

- `src/app` contém rotas, layout e providers.
- `src/components` contém componentes compartilhados.
- `src/features` agrupa interfaces por domínio.
- `src/services` contém o cliente HTTP com validação da resposta.
- `src/types` contém contratos confirmados com o backend.
- `src/styles` contém tokens e estilos globais.

## Conexão com o backend

O navegador acessa a API em caminhos relativos sob `/api/v1`. O Next.js encaminha as chamadas para `API_URL`, por exemplo `https://<host-da-railway>/api/v1` em produção. A variável anterior `NEXT_PUBLIC_API_URL` continua aceita como fallback. Na Railway, inclua a origem HTTPS exata do frontend em `CORS_ORIGINS`. Para desenvolvimento HTTP, use `APP_ENV=development` e autorize `http://localhost:3000`.

Login, renovação e logout usam o JWT HttpOnly emitido pelo FastAPI. O proxy restringe o cookie ao host do frontend e ao caminho `/api/v1`, com `SameSite=Lax`. O FastAPI inclui `Secure` fora de desenvolvimento. A API recebe somente o cookie da sessão e o Origin original. Respostas do proxy usam `Cache-Control: private, no-store`. O indicador de saúde consulta `/api/v1/health`, encaminhado ao `/health` do FastAPI.

A API aceita documentos de até 10 MiB. Na Vercel, o corpo de uma requisição a uma Function tem limite padrão de 4,5 MB, incluindo o multipart. Confirme a capacidade do projeto antes de promover a alteração se o ambiente deve aceitar arquivos até 10 MiB. Consulte os [limites de Functions](https://vercel.com/docs/functions/limitations#request-body-size).

Para executar a regressão, rode `npx playwright install chromium webkit`, `npm run build` e `npm run test:e2e`. A suíte inicia o build local e uma API simulada em loopback.

Para validar em um iPhone, use um ambiente HTTPS aprovado e uma conta de teste. Mantenha a prevenção de rastreamento ativada. Em Safari, Chrome e Edge, entre pela tela de login, confirme o dashboard, recarregue a página, navegue para outra tela protegida e volte ao dashboard. Saia e tente abrir a área protegida novamente. No inspetor, confira somente host, caminho e status. Login e `/api/v1/auth/me` devem retornar 200 na origem do frontend durante a sessão. Após sair, `/api/v1/auth/me` deve retornar 401. Evite exportar headers ou corpos de requisição.

O endpoint local `/api/health` mede somente a disponibilidade do frontend Next.js e não depende
do backend.

## Escopo desta etapa

A fundação inclui página inicial acessível e responsiva e verificação de conexão.
Autenticação, áreas de paciente/profissional e funcionalidades clínicas ficam para os próximos marcos.
Registros e tokens de pacientes devem seguir os contratos do backend e as regras de privacidade de
`AGENTS.md`.

## Dependências de desenvolvimento

O ESLint 9 atende aos intervalos de compatibilidade dos plugins incluídos pelo Next.js.
O npm informa que essa série está depreciada. A migração depende da compatibilidade desses plugins.
A auditoria inicial apontou oito alertas moderados na cadeia de `minimatch` usada pelo
`typescript-eslint`. `npm audit fix` foi executado. Os alertas restantes exigem acompanhamento
das atualizações dessa cadeia. Execute `npm audit` para consultar a situação atual.
