# CI/CD do frontend Ctrl X

## Fluxo vigente

1. Confirme que a árvore está limpa e atualize `develop` somente por fast-forward: `git fetch origin develop`, `git switch develop` e `git pull --ff-only origin develop`.
2. Crie uma branch `feature/<nome-em-ingles-kebab-case>` a partir de `develop`; não trabalhe diretamente em `develop` ou `prod`.
3. Abra um PR da feature para `develop`. O workflow Frontend executa o check `CI` com `npm ci`, lint, TypeScript, testes e build. Novos commits cancelam o CI anterior do mesmo PR. O workflow rejeita branches fora de `feature/*` nesse destino.
4. O auto-merge pode ser ativado manualmente no PR pela interface do GitHub; ele depende de Allow auto-merge e das proteções configuradas no repositório.
5. Abra manualmente o PR `develop` → `prod`. O workflow executa CI nesse PR e valida que sua origem é `develop` no mesmo repositório.
6. Configure a aprovação humana como proteção externa de `prod`; ela não é imposta pelo YAML do workflow. Qualquer push em `prod` aciona Deploy production, portanto a proteção da branch é necessária para restringir a publicação ao fluxo de PR. Não existe workflow de promoção nem criação automática de PRs.

São duas verificações de CI ao longo do fluxo completo: uma para cada PR. Elas validam a combinação com a respectiva branch de destino. O build da Vercel usa o ambiente Production e gera o artefato prebuilt; por isso ele continua necessário mesmo com o build de CI aprovado.

## Deploy Vercel

O job usa `environment: production`, checkout, Node 22, `npm ci`, Vercel CLI 50.0.0, `vercel pull`, `vercel build --prod` e `vercel deploy --prebuilt --prod`. O projeto é `prj_vJdkGC4SQreqnD8LhiDl7rnqtPC9`.

A CLI reporta erros de autenticação/configuração/build/publicação. Foram removidos os validadores customizados de URL, projeto e API do deploy, o segundo CI e os curls pós-deploy. `PRODUCTION_URL` não é mais requisito do workflow. O script local de diagnóstico de URL e seus testes continuam disponíveis para uso manual.

A concorrência serializa os deployments sem cancelar uma publicação em andamento. Imediatamente antes de publicar, o workflow consulta o SHA de prod e ignora um commit já ultrapassado. Isso reduz publicações obsoletas; não torna a consulta e o deploy uma operação atômica. A CLI aguarda o resultado e registra SHA e URL no resumo. Falhas deixam o job vermelho.

`vercel.json` mantém Next.js, `npm ci`, `npm run build` e `git.deploymentEnabled: false`. Preserve esse arquivo nas branches e confira que não há Deploy Hooks ou outras integrações publicando separadamente. Use raiz do repositório, Node 22 e output padrão Next.js na Vercel.

## Configuração externa necessária

| Nome | Local | Finalidade |
| --- | --- | --- |
| `VERCEL_TOKEN` | GitHub → Settings → Environments → production → Environment secrets | Token autorizado a publicar no projeto/time |
| `VERCEL_ORG_ID` | Mesmo local | ID do time/proprietário do projeto |
| `API_URL` | Vercel → Project → Settings → Environment Variables → Production | URL HTTPS real do backend com `/api/v1`, usada pelo proxy do Next.js (fallback de compatibilidade: `NEXT_PUBLIC_API_URL`) |
| `CI_API_URL` | GitHub → Settings → Environments → `ci` → Environment variables | URL local sintética, como `http://127.0.0.1:8000/api/v1`, usada apenas na CI. Mantenha o ambiente sem acesso a segredos. |

Confira o ORG ID em Team Settings → General ou no `orgId` de `.vercel/project.json` obtido ao vincular o projeto correto. Nunca coloque tokens em NEXT_PUBLIC, arquivos versionados ou logs. O token só é injetado nos steps da CLI.

O domínio canônico aparece em Domains no projeto Vercel. As URLs da API devem ser reais; não invente um endereço Railway. O deploy agora não valida nem testa a API: sua conclusão não comprova que login ou funções clínicas funcionam. O backend precisa estar disponível e aceitar a origem frontend via CORS. O cookie cross-site usa `SameSite=None; Secure`; se o navegador bloquear cookies de terceiros, configure domínios próprios no mesmo site ou proxy de mesma origem. Mudanças em NEXT_PUBLIC exigem novo build.

## Proteções e auto-merge

Antes de ativar esse fluxo, configure Rulesets ativos para develop e prod: PR obrigatório, check `CI` obrigatório, bloqueio de force push e exclusão, sem bypass de administradores ou automações. O workflow de push não distingue push direto de merge; impedir pushes diretos é responsabilidade dessas regras do GitHub.

Em develop, revisão humana pode ser opcional. Em prod, exija ao menos uma aprovação humana e invalide aprovações após mudanças. Nenhum workflow aprova PRs. Confira o nome real `CI` num PR antes de selecionar o check obrigatório. Essas proteções precisam ser configuradas manualmente no GitHub; os arquivos do repositório não as ativam.

Habilite Allow auto-merge em Settings → General → Pull Requests. Ative o auto-merge em cada PR com sua conta. A automação auxiliar com GITHUB_TOKEN foi removida: eventos produzidos por esse token têm restrições de disparo de novos workflows. Não é necessário PAT nem GitHub App para este fluxo.

Prefira squash para feature → develop. Use merge commit para develop → prod, preservando a ancestralidade entre branches permanentes. Não habilite linear history em prod se usar merge commit. Se exigir branch atualizada antes do merge, sincronize mudanças da base por PR; nunca por push direto. Não habilite merge queue sem adaptar o CI a merge_group.

Plano, permissões e regras remotas não foram confirmados nem alterados nesta implementação.

## Verificação e recuperação

- Abra PR de feature para develop: espere um check CI. CI falhando deve bloquear merge.
- Abra PR develop para prod: confirme bloqueio até CI aprovado e revisão humana.
- Após merge: confirme somente Deploy production, SHA e URL no resumo e deployment Vercel correspondente.
- Confira páginas, assets, login e acesso à API com contas de teste. `/api/health` mede somente o frontend; o indicador de API consulta o backend separadamente.
- Para repetir, abra a execução em Actions e use Re-run failed jobs ou Re-run all jobs. A reexecução usa o workflow daquele SHA; correções precisam chegar a prod em novo PR. Commits obsoletos serão ignorados antes de publicar.
- Para rollback autorizado, selecione o deployment anterior saudável no painel Vercel, execute Instant Rollback e verifique a aplicação. Corrija o código pelo fluxo de PRs.

Referências: [auto-merge nativo](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-auto-merge-for-pull-requests-in-your-repository) e [restrições de eventos do GITHUB_TOKEN](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
