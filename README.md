# Gerador de Contratos de Aluguel

MVP estático para GitHub Pages. O sistema roda no navegador e não usa backend.

## Templates

O sistema aceita templates em `.txt`, `.md` e `.docx`, desde que contenham marcadores entre chaves duplas:

```txt
LOCADOR: {{locador.nome}}, CPF/CNPJ {{locador.cpf_cnpj}}
LOCATÁRIO: {{locatario.nome}}, CPF/CNPJ {{locatario.cpf_cnpj}}
IMÓVEL: {{imovel.endereco}}
VALOR: {{contrato.valor_aluguel}}
```

Ao importar o arquivo, o sistema detecta os marcadores e cria os campos do formulário automaticamente.

## Dados salvos no navegador

O app salva temporariamente, apenas neste navegador:

- o rascunho atual do formulário;
- até 5 sugestões recentes por campo.

O botão `Limpar formulário` apaga o rascunho atual, mas mantém as sugestões recentes para facilitar novos contratos.

## Templates incluídos

- Contrato de locação de imóvel.
- Aditivo - mudança de locador.
- Aditivo - renovação de locação.

## Saída

- `Salvar .docx` gera um arquivo Word.
- `Salvar .pdf` abre a impressão do navegador mostrando somente a área do contrato.

No arquivo `.docx`, a primeira linha do contrato é gerada como título centralizado e em negrito. Os valores vindos dos campos preenchidos são sublinhados.

O nome sugerido para o arquivo gerado segue o padrão:

```txt
<tipo de documento>_<CPF do locatário>_<data de início>
```

Exemplos de tipo: `ContratoAluguel`, `AditivoAluguel` e `AditivoLocador`.

Ao salvar PDF, se o navegador mostrar cabeçalho ou rodapé automático, desative a opção `Cabeçalhos e rodapés` na janela de impressão. O sistema já imprime somente a área do documento.

Quando o contrato é editado manualmente na área final, essas mudanças valem apenas para o arquivo gerado. O template original não é modificado.

## Tamanho da fonte

O tamanho base fica em `styles.css`:

```css
--base-font-size: 12pt;
```

Altere esse valor para `13pt`, `14pt` ou outro tamanho se precisar.

## Publicação no GitHub Pages

O repositório inclui um workflow em `.github/workflows/pages.yml`. No GitHub, configure Pages para usar GitHub Actions. A cada envio para a branch `main`, o conteúdo da pasta `app/` será publicado.
