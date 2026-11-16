# VILLE Imobiliário — Painel administrativo inicial

Versão 0.1: login, criação do primeiro acesso, recuperação de senha e dashboard de leitura com dados do Supabase. As tabelas já existem no banco e têm RLS ativada.

## Serviços
- GitHub: villeimobiliario-debug/villeimobiliario
- Supabase: yawwgscylcrqqbzqvfoc
- Cloudflare: Worker villeimobiliario
- Publicação: wrangler.jsonc aponta para public/ (Workers Static Assets); comando npx wrangler deploy.

## Primeiro acesso — administrador principal

1. No painel Supabase, acesse Authentication > URL Configuration.
2. Defina Site URL como https://villeimobiliario.villeimobiliario.workers.dev e adicione o mesmo endereço, incluindo a opção com barra final, em Redirect URLs.
3. Mantenha confirmação por e-mail habilitada em Authentication > Providers > Email.
4. No site, clique em Primeiro acesso, crie uma senha forte para villeimobiliario@gmail.com e confirme o e-mail.
5. Após a confirmação, conceda a função administrativa no SQL Editor do Supabase (projeto correto):

```sql
insert into app_private.platform_admins(user_id)
select id from auth.users
where lower(email) = 'villeimobiliario@gmail.com'
  and email_confirmed_at is not null
on conflict (user_id) do nothing;
```

6. Volte ao site, faça login e teste as páginas do dashboard.

O painel não libera acesso apenas pelo e-mail: o usuário precisa constar na tabela privada de administradores. Nunca compartilhar senhas nem inserir chaves secretas no frontend.

## Componentes
- public/index.html: estrutura da página
- public/app.js: telas e navegação
- public/auth.js: Supabase Auth REST
- public/config.js: URL e chave **publicável** do projeto
- public/logic.js: cálculos e formatações
- public/styles.css: identidade VILLE (azul #0E359D, coral #FF606A, branco)
- supabase/sql/: esquema e regras do banco
- tests/logic.test.js: testes unitários

## Validação e limites da versão
`npm test` — testes lógicos locais, sem dependências.

- Os dados exibidos são reais, nunca simulados.
- 7 dias de teste grátis e 5 dias de tolerância são parâmetros do banco.
- **Ainda não foram implementados**: confirmação financeira Pix, bloqueio automático, cadastro público de imobiliárias e ações de gestão completas. Estes serão módulos posteriores.
- O dashboard consulta até mil registros por coleção; serão necessárias consultas agregadas/paginadas para escalar a operação.
- Para liberar a produção comercial, testar políticas de acesso em múltiplas contas, adicionar testes de integração e backups e configurar autenticação com MFA.
