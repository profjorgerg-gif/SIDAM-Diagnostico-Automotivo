# SIDAM – Sistema Inteligente de Diagnóstico Automotivo de Motores

Versão 1.0 · site estático para GitHub Pages, com login Google e banco de dados no Firebase.

## O que tem nesta pasta

| Arquivo | Para que serve |
|---|---|
| `index.html` | Página do sistema |
| `css/estilo.css` | Visual |
| `js/app.js` | Diagnóstico, relatórios, histórico e administração |
| `js/plataforma.js` | Login Google, banco de dados e downloads |
| `js/firebase-config.js` | **Único arquivo que você precisa editar** (passo 4) |
| `base/sidam-base-inicial.json` | Base de conhecimento original (v1.0) |
| `firestore.rules` | Regras de segurança do banco (passo 3) |

O sistema já funciona sem Firebase, em **modo local**: o diagnóstico, os relatórios e o histórico funcionam, mas o histórico fica só no navegador e a aba Administração não aparece. Com o Firebase configurado, entram o login Google, o histórico na conta de cada usuário e a administração da base.

---

## Passo 1 – Criar o projeto no Firebase

1. Acesse https://console.firebase.google.com e clique em **Adicionar projeto**.
2. Nome sugerido: `sidam-diagnostico`. O Google Analytics pode ficar desativado.

## Passo 2 – Ativar o login com Google

1. No menu lateral: **Segurança > Authentication > Vamos começar** (em versões antigas do console, fica em **Criação**).
2. Aba **Método de login > Google > Ativar**, escolha o e-mail de suporte e salve.
3. Aba **Configurações > Domínios autorizados > Adicionar domínio** e informe `SEU-USUARIO.github.io` (o seu usuário do GitHub).

## Passo 3 – Criar o banco de dados

1. Menu **Bancos de dados e armazenamento > Firestore > Criar banco de dados** (se pedir a edição, mantenha Standard).
2. Local: `southamerica-east1 (São Paulo)`. Comece no **modo de produção**.
3. Aba **Regras**: apague o conteúdo, cole todo o conteúdo do arquivo `firestore.rules` e clique em **Publicar**.
4. Aba **Dados**: crie o cadastro de administradores.
   - **Iniciar coleção**, ID da coleção: `config`
   - ID do documento: `admins`
   - Campo: `emails`, tipo **array**, e adicione seu e-mail Google em letras minúsculas (por exemplo, `profjorge.rg@gmail.com`). Para outro professor administrar a base, adicione o e-mail dele no mesmo array.

## Passo 4 – Ligar o site ao Firebase

1. No Firebase: ícone de engrenagem **> Configurações do projeto > Seus apps > ícone `</>` (Web)**.
2. Apelido: `sidam-web`. Não marque o Firebase Hosting. Clique em **Registrar app**.
3. Copie os seis valores do bloco `firebaseConfig` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
4. Abra `js/firebase-config.js` e substitua cada `COLE_AQUI` pelo valor correspondente, mantendo as aspas.

## Passo 5 – Publicar no GitHub Pages

1. Em https://github.com crie um repositório **público**, por exemplo `SIDAM-Diagnostico-Automotivo`.
2. **Add file > Upload files** e arraste **todo o conteúdo desta pasta** (incluindo as pastas `css`, `js` e `base`). Clique em **Commit changes**.
3. **Settings > Pages > Branch: main / (root) > Save**.
4. Em um ou dois minutos o sistema estará em `https://SEU-USUARIO.github.io/SIDAM-Diagnostico-Automotivo/`.

## Passo 6 – Primeiro acesso

1. Abra o site e clique em **Entrar com Google** com o e-mail cadastrado no passo 3.
2. Ao lado do seu nome deve aparecer **administrador**, e a aba **Administração** fica visível.
3. Na Administração, faça uma alteração pequena e salve. Isso grava a base completa no banco. A partir daí, todas as edições valem para todos os usuários.

---

## Perguntas frequentes

**"Entrar com Google" mostra erro de domínio.** Falta o passo 2.3: adicione `SEU-USUARIO.github.io` nos domínios autorizados.

**Entrei, mas não aparece "administrador".** Confira se o e-mail no documento `config/admins` está exatamente igual ao da conta Google, em minúsculas, e se o campo `emails` é do tipo array. Saia e entre de novo.

**O histórico de antes do login sumiu.** Sem login, o histórico fica guardado só no navegador. Depois de entrar, aparecem os diagnósticos salvos na conta.

**Como fazer backup da base?** Administração > **Exportar base (JSON)**.

**Custo.** Para uso em sala de aula e em oficinas pequenas, o plano gratuito do Firebase (Spark) é suficiente.
