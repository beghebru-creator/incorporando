# Incorporando — Leitor de protocolos (extensão do Chrome)

Serve para o botão **Consultar** dos protocolos: o app abre o site do órgão e a
extensão lê a página que abriu, devolvendo o texto ao app, que marca se teve ou
não movimentação. Ela não consulta nada sozinha e só lê as abas que ela mesma
abriu pelo botão Consultar.

## Instalar (uma vez por computador)
1. No Chrome, abra `chrome://extensions`.
2. Ligue **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e escolha esta pasta `extensao`.
4. Recarregue o Incorporando. Na janela do protocolo, o aviso "instale a extensão" some.

## Como usar
1. No protocolo (aba Protocolos ou janela da tarefa), clique em **Consultar**.
2. O site do órgão abre numa aba nova, com uma barrinha "Incorporando" embaixo.
3. Se o site pedir captcha ou formulário, preencha. Quando o número do protocolo
   aparecer e a página terminar de carregar, a extensão lê e envia ao app sozinha.
   O botão **Ler esta página** envia na hora.
4. Volte ao app: o histórico do protocolo mostra "Sem movimentação", "Teve
   movimentação" (com as linhas novas) ou "Primeira leitura".

## Preencher o site sozinho (ensinar uma vez por site)
1. Clique em Consultar num protocolo desse órgão. No site, clique em **Ensinar preenchimento** na barrinha.
2. Clique em cada campo do site e escolha o que vai nele: número completo, número sem o ano, só o ano, senha, observações ou um texto fixo (ex.: tipo de processo).
3. Clique em **Marcar botão de pesquisar** e depois no botão de pesquisar do site (ele não é enviado nessa hora).
4. Clique em **Salvar**. O molde fica guardado no Incorporando e vale para toda a equipe e para todos os protocolos desse site.
5. Nas próximas consultas, a extensão preenche e pesquisa sozinha. Se o site tiver captcha, ela só preenche: resolva o captcha e clique em pesquisar.
Se o site mudar, clique em **Ensinar de novo**. Para apagar, use "Esquecer" na janela do protocolo.

## Endereços do app aceitos
Os endereços do Incorporando ficam em `manifest.json` (content_scripts.matches) e
em `background.js` (APPS). Se o app ganhar outro endereço, acrescente nos dois e
recarregue a extensão em `chrome://extensions`.
