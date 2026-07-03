# Gerador de Contratos de Aluguel

MVP estático para GitHub Pages. O sistema roda no navegador, gera formulário a partir dos campos presentes no template e não envia dados pessoais para servidor.

## Como usar templates

Crie um arquivo `.txt` ou `.md` com marcadores entre chaves duplas:

```txt
LOCADOR: {{locador.nome}}, CPF/CNPJ {{locador.cpf_cnpj}}
LOCATÁRIO: {{locatario.nome}}, CPF/CNPJ {{locatario.cpf_cnpj}}
IMÓVEL: {{imovel.endereco}}
VALOR: {{contrato.valor_aluguel}}
```

Ao importar o arquivo, o sistema detecta os marcadores e cria os campos do formulário automaticamente.

Campos com prefixo `locador.` podem ser salvos no navegador para reuso em vários contratos.

## Tamanho da fonte

O tamanho base fica em `styles.css`:

```css
--base-font-size: 14pt;
```

Altere esse valor para `16pt`, `18pt` ou outro tamanho se precisar.

## Publicação no GitHub Pages

O repositório já inclui um workflow em `.github/workflows/pages.yml`. No GitHub, configure Pages para usar GitHub Actions. A cada envio para a branch `main`, o conteúdo da pasta `app/` será publicado.

Como não há backend, não é necessário instalar dependências.
