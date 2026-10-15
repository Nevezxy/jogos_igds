# Relatório de revisão dos jogos

Revisão de 14/10/2026, antes das correções. Os 15 conjuntos de testes (`npm test`) passam. Os itens marcados ✅ foram reproduzidos rodando o código. Os outros vêm da leitura do código ou das regras oficiais.

**Escopo da leitura:**
- Lidos linha a linha: as regras e os servidores de todos os jogos e a parte comum dos jogos de tabuleiro (robô, partida pela rede, tela).
- Lidos por amostragem, nesta revisão: a interface (game.js) de Click, Letras, Números, Teclado Mágico, Bingo e Desafio. Os jogos visuais foram testados no navegador na etapa D.

## Situação das correções (branch `pr/7-correcoes`)

| Item | Situação |
|---|---|
| 1 | ✅ Corrigido |
| 2 a 5 | ✅ Corrigidos |
| 6 | ⏸️ Fica para depois: não consegui confirmar o texto exato no regulamento da CBD. A regra dos 20 lances, que já existe, foi confirmada |
| 7 a 11 | ✅ Corrigidos |
| 12 | Mantido: não existe emoji de garça |
| 13 a 17 | ✅ Corrigidos |
| 18 a 22 | ✅ Corrigidos |
| Pontos de atenção | Só registrados, sem mudança |

O teste novo `test/correcoes.test.js` cobre cada bug corrigido.

---

## 🔴 Grave

### 1. O servidor cai com uma variante inválida no "Procurar adversário" ✅
- **Onde:** `src/platform/match.js` (`checkVariant`).
- **Problema:** a conferência usa `Rules.VARIANTS[v]`, e nomes como `constructor` ou `toString` passam, porque existem em todo objeto do JavaScript.
- **Como acontece:**
  1. Dois alunos, de turmas diferentes, entram na fila da Velha ou do Ligue 4 com essa variante. Isso exige uma mensagem montada à mão, não acontece pela tela.
  2. Depois de 8 s, o pareamento automático (`setInterval`) chama `Rules.initial('constructor')`.
  3. Essa chamada lança um erro.
  4. Como não há tratamento de erro, o processo Node termina e a escola toda cai.
- **Mesma causa, efeito menor:** com `bg:create`, a sala fica travada.
- **Correção:** usar `Object.prototype.hasOwnProperty.call(VARIANTS, v)` no `checkVariant` e no `initial` de cada regra. Proteger também o `pairQueue` dentro do `setInterval`.

## 🟠 Médio: dicas e conteúdos errados

### 2. A dica de "vai-um" da adição fica errada quando o vai-um não é nas unidades ✅
- **Onde:** `matematica/problems.js` (`hint`).
- **Exemplo:** 52 + 61 dá "Some as unidades: 2 + 1 = 3. Escreva 3 e **vai 1**". O vai-um, na verdade, é das dezenas.
- **Fases afetadas:** as de 2 e 3 algarismos com vai-um (`add2`, `add3`, ca5...).

### 3. A dica de "empréstimo" da subtração fica errada pelo mesmo motivo ✅
- **Exemplo:** 125 − 43 dá "**5 é menor que 3**: peça 1 dezena emprestada. 15 − 3 = 12".
- **Fases afetadas:** sub3, ca10 e as revisões.

### 4. A dica do termômetro em "Número que falta" com negativos (ng13) ✅
- **Quando falta o 1º número:** a dica manda andar para o lado errado. Para ? + 3 = −2, ela diz "comece no −2 e ande 3 para cima".
- **Quando falta o 2º número:** a dica entrega a resposta. Para −2 + ? = 3, ela diz "ande **5** para cima".
- **A dica "Menos com menos vira mais"** também mostra o número escondido. Para 4 − ? = 7, ela diz "4 − (−3)".

### 5. A Memória chama de "frutas" a cenoura 🥕 e o milho 🌽
- **Onde:** `memoria/cards.js`, tema `frutas`, usado na fase mm1b e no tema "tudo".
- **Problema:** a fase diz "Diga o nome da fruta". Trocar por frutas de verdade (🥭, 🫐, 🍈).

### 6. A Dama brasileira não tem todas as regras oficiais de empate
- **O que já existe:** só o empate de "20 lances só com damas, sem captura".
- **O que falta:**
  - os finais de 2 damas × 1, 2 × 2, 1 × 1, 1 dama × 1 dama + 1 pedra e 2 damas × 1 dama + 1 pedra, que empatam depois de 5 lances;
  - a mesma posição repetida 3 vezes.
- **Efeito:** sem essas regras, partidas que já estão empatadas se arrastam até 40 lances.
- **Antes de mudar:** confirmar o texto no regulamento da CBD.

## 🟡 Baixo: textos, dicas e detalhes

7. **Memória, letras (mm3c):** a fase tem o **I** maiúsculo e o **l** minúsculo. Na fonte Baloo 2 os dois podem ficar iguais (falta conferir na tela). Se ficarem, tirar o I ou o L da lista.
8. **Memória, letras (mm3b):** a dica fala em "p e q", mas a fase não tem a letra P.
9. **Dama, dica do "Robô Guloso":** a dica diz que ele "captura sempre que pode". Na dama todo mundo é obrigado a capturar, então isso não descreve o robô.
10. **Dicas que prometem profundidade:** "pensa 8 lances à frente" (Dama dm5, Ligue 4 l4f). O limite de tempo pode parar o robô antes, sobretudo em aparelhos lentos.
11. **Dinheiro, "Quanto tem aqui?":** o valor mínimo da fase é ignorado. A fase dm1b, "Notas até R$ 50", com mínimo R$ 7, pode mostrar R$ 4.
12. **Dinheiro, nota de R$ 5:** usa 🦩 (flamingo), mas o bicho da nota é a garça. Não existe emoji de garça, então pode ficar como está ou trocar por 🕊️.
13. **Conta Comigo, voz:** os colchetes [ ] são lidos como "abre parênteses".
14. **Conta Comigo, dica da ng10:** escreve "−3 × −4". A tela mostra −3 × (−4), que é a forma correta.
15. **Teclado Mágico, lista "maiúsculas com acento":** tem a palavra "Índio". Hoje as escolas usam "indígena". Sugestão: trocar por "Ícone" ou "Ímpar".
16. **Balança, dica da bl2a:** diz "Ponha 3 do lado do objeto", mas não existe peso de 3. É preciso juntar 1 + 2.
17. **Tabuleiro, botão "Desfazer":** fica ativo quando o robô fez só o 1º lance, e nesse caso não faz nada.
18. **Tabuleiro, resultado na hora errada:** quem sai de uma partida e começa outra em menos de 1 s pode ver o resultado da partida anterior.
19. **Partida pela rede, os dois caem:** o primeiro que "vence por abandono" também estava desconectado.
20. **Bingo, desfazer sorteio:** desfazer um sorteio depois de um bingo tira a vitória da tela, mas o registro dela continua no banco.
21. **Xadrez, repetição:** a contagem de 3 repetições considera a casa de en passant mesmo quando ninguém pode capturar. O empate pode demorar um lance a mais. É muito raro.
22. **Teclado Mágico, erros por tecla:** a lista de erros por tecla (`keyErrors`) não tem limite e cresce um pouco a cada rodada.

## 🔵 Pontos de atenção (não são bugs)

- **O navegador manda os lances do adversário:** nas partidas contra o robô (tabuleiro e Memória contra o robô), o navegador manda também os lances do robô. O servidor confere as regras, mas não sabe se foi mesmo o robô que jogou. Um aluno que saiba programar poderia forjar uma vitória. Resolver isso exigiria o robô rodando no servidor, e não vale a pena para uma escola.
- **Teclado Mágico:** o servidor confere a velocidade, mas aceita a precisão que o navegador informa.
- **Quebra-cabeça:** o servidor confere só a lista de peças e o tempo, porque a montagem não tem como ser refeita.
- **Fases abertas:** todas as fases ficam liberadas em todos os jogos. É uma escolha de projeto, só para registrar.
- **Sem tratamento global de erro:** o servidor não tem `process.on('uncaughtException')`. Qualquer erro inesperado num timer derruba tudo, como no item 1. Vale ter um gerenciador (pm2, ou o serviço do Windows) que reinicie o servidor sozinho.

## ✅ Conferido e correto

- **Velha e Ligue 4:** linhas, vitória, empate e o robô imbatível do 3 × 3.
- **Xadrez:** as regras completas (o gerador de lances confere com os números de referência em 5 posições). As 9 posições do "Fim de partida" são mate de verdade.
- **Dama:** lei da maioria, dama voadora, captura para trás, peça capturada que não é pulada duas vezes e coroação só no fim da captura.
- **Hanói:** os mínimos de movimentos e as dicas de 63, 127 e 25 movimentos (com 4 pinos) estão certos.
- **Labirinto:** sempre tem solução, as chaves ficam antes das portas e seguir a parede da direita funciona.
- **Dinheiro:** as cores e os bichos das notas (exceto o item 12) e o "menor número de notas", que com as notas do Real dá sempre o resultado certo.
- **Balança, Pixel Art, Diferenças e Carrinhos:** o servidor refaz a partida inteira.
- **Bingo:** só deixa marcar o que foi sorteado.
- **Desafio:** o servidor confere cada tecla.
- **Banco de palavras do Teclado Mágico e do Letras:** sem erros de ortografia, hífens corretos pelo Acordo e crase correta.
