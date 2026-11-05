// Busca as transações salvas ou inicializa uma lista vazia
let transacoes = JSON.parse(localStorage.getItem('minhas_transacoes')) || [];

// Variáveis para guardar as instâncias dos gráficos
let meuGraficoDespesas = null;
let meuGraficoReceitas = null;
let meuGraficoTemporal = null;

// Elementos do HTML
const form = document.getElementById('form-transacao');
const tabelaCorpo = document.getElementById('tabela-corpo');
const saldoTotalElemento = document.getElementById('saldo-total');
const filtroMesAno = document.getElementById('filtro-mes-ano');

// Define o mês atual como padrão no filtro (AAAA-MM)
const hoje = new Date();
const mesAtualStr = hoje.toISOString().slice(0, 7);
filtroMesAno.value = mesAtualStr;

// Escuta a mudança no seletor de mês
filtroMesAno.addEventListener('change', atualizarInterface);

// Carrega os dados na tela assim que abre a página
atualizarInterface();

// Evento de envio do formulário
form.addEventListener('submit', function(event) {
  event.preventDefault();

  const descricao = document.getElementById('descricao').value;
  const valor = parseFloat(document.getElementById('valor').value);
  const tipo = document.getElementById('tipo').value;
  const categoria = document.getElementById('categoria').value;
  const data = document.getElementById('data').value;

  const novaTransacao = {
    descricao: descricao,
    valor: valor,
    tipo: tipo,
    categoria: categoria,
    data: data
  };

  transacoes.push(novaTransacao);
  salvarNoNavegador();

  // Ajusta o filtro para o mês do item recém-cadastrado
  filtroMesAno.value = data.slice(0, 7);

  atualizarInterface();
  form.reset();
});

// Salva o array de transações no localStorage
function salvarNoNavegador() {
  localStorage.setItem('minhas_transacoes', JSON.stringify(transacoes));
}

// Atualiza a tabela, o saldo e chama a atualização dos gráficos
function atualizarInterface() {
  const mesSelecionado = filtroMesAno.value; // Ex: "2026-11"

  // 1. Filtrar lançamentos apenas do mês selecionado
  const transacoesDoMes = transacoes.filter(t => t.data.startsWith(mesSelecionado));

  // Ordenar lançamentos do mês por data (mais antigo -> mais recente)
  transacoesDoMes.sort((a, b) => new Date(a.data) - new Date(b.data));

  tabelaCorpo.innerHTML = '';
  let saldoMes = 0;

  transacoesDoMes.forEach(function(item) {
    if (item.tipo === 'RECEITA') {
      saldoMes += item.valor;
    } else {
      saldoMes -= item.valor;
    }

    // Classes de cores do CSS (valor-receita / valor-despesa)
    const classeCor = item.tipo === 'RECEITA' ? 'valor-receita' : 'valor-despesa';
    const sinal = item.tipo === 'RECEITA' ? '+' : '-';

    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>${item.data}</td>
      <td>${item.descricao}</td>
      <td>${item.tipo}</td>
      <td>${item.categoria}</td>
      <td class="${classeCor}">${sinal} R$ ${item.valor.toFixed(2)}</td>
    `;
    tabelaCorpo.appendChild(linha);
  });

  // Atualiza o valor na tela
  saldoTotalElemento.textContent = saldoMes.toFixed(2);

  // 2. Atualizar os Gráficos
  atualizarGraficos(transacoesDoMes);
}

// Função para renderizar/atualizar os 3 gráficos
function atualizarGraficos(transacoesDoMes) {
  // --- A. Pizza de Despesas do Mês ---
  const categoriasDespesas = ['Básicas', 'Provisões', 'Investimento', 'Educação', 'Outros'];
  const totaisDespesas = categoriasDespesas.map(cat => {
    return transacoesDoMes
      .filter(t => t.tipo === 'DESPESA' && t.categoria === cat)
      .reduce((soma, t) => soma + t.valor, 0);
  });

  // --- B. Pizza de Receitas do Mês ---
  const categoriasReceitas = ['Ordinária', 'Extraordinária'];
  const totaisReceitas = categoriasReceitas.map(cat => {
    return transacoesDoMes
      .filter(t => t.tipo === 'RECEITA' && t.categoria === cat)
      .reduce((soma, t) => soma + t.valor, 0);
  });

  // --- C. Temporal: Acumulado Mensal (Agrupa TODAS as transações por Mês) ---
  const acumuladoPorMes = {};

  transacoes.forEach(t => {
    const mes = t.data.slice(0, 7); // Pega o ano-mês (AAAA-MM)
    if (!acumuladoPorMes[mes]) {
      acumuladoPorMes[mes] = { receita: 0, despesa: 0 };
    }
    if (t.tipo === 'RECEITA') {
      acumuladoPorMes[mes].receita += t.valor;
    } else {
      acumuladoPorMes[mes].despesa += t.valor;
    }
  });

  // Ordena os meses em ordem cronológica para o eixo X
  const mesesOrdenados = Object.keys(acumuladoPorMes).sort();
  const dadosReceitasMensais = mesesOrdenados.map(m => acumuladoPorMes[m].receita);
  const dadosDespesasMensais = mesesOrdenados.map(m => acumuladoPorMes[m].despesa);

  // --- D. Destruir gráficos anteriores para evitar duplicação/sobreposição ---
  if (meuGraficoDespesas) meuGraficoDespesas.destroy();
  if (meuGraficoReceitas) meuGraficoReceitas.destroy();
  if (meuGraficoTemporal) meuGraficoTemporal.destroy();

  // --- E. Renderizar Pizza Despesas ---
  const ctxDespesas = document.getElementById('graficoPizzaDespesas').getContext('2d');
  meuGraficoDespesas = new Chart(ctxDespesas, {
    type: 'pie',
    data: {
      labels: categoriasDespesas,
      datasets: [{
        data: totaisDespesas,
        backgroundColor: ['#ef4444', '#3b82f6', '#a855f7', '#eab308', '#64748b']
      }]
    }
  });

  // --- F. Renderizar Pizza Receitas ---
  const ctxReceitas = document.getElementById('graficoPizzaReceitas').getContext('2d');
  meuGraficoReceitas = new Chart(ctxReceitas, {
    type: 'pie',
    data: {
      labels: categoriasReceitas,
      datasets: [{
        data: totaisReceitas,
        backgroundColor: ['#22c55e', '#f97316']
      }]
    }
  });

  // --- G. Renderizar Gráfico Temporal Mensal (Barras Comparativas) ---
  const ctxTemporal = document.getElementById('graficoTemporal').getContext('2d');
  meuGraficoTemporal = new Chart(ctxTemporal, {
    type: 'bar',
    data: {
      labels: mesesOrdenados,
      datasets: [
        {
          label: 'Total Receitas (R$)',
          data: dadosReceitasMensais,
          backgroundColor: '#22c55e'
        },
        {
          label: 'Total Despesas (R$)',
          data: dadosDespesasMensais,
          backgroundColor: '#ef4444'
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}