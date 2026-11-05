// =========================================================================
// 1. CONFIGURAÇÃO DO SUPABASE
// Substitua o conteúdo das aspas simples abaixo com os seus dados:
// =========================================================================
const SUPABASE_URL = 'https://rzzbqihwoyeccokslgxl.supabase.co/rest/v1/';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6emJxaWh3b3llY2Nva3NsZ3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5MTM0MDksImV4cCI6MjEwOTQ4OTQwOX0.tJZG4GtkAYlvKPkRFkd7BtRDAxY0mICwoJA_vt4efMs';


// Inicializa a conexão com a nuvem
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variáveis de estado global
let transacoes = [];

let meuGraficoDespesas = null;
let meuGraficoReceitas = null;
let meuGraficoTemporal = null;

// Elementos do HTML
const form = document.getElementById('form-transacao');
const tabelaCorpo = document.getElementById('tabela-corpo');
const saldoTotalElemento = document.getElementById('saldo-total');
const filtroMesAno = document.getElementById('filtro-mes-ano');

// Define mês atual como padrão no filtro (AAAA-MM)
const hoje = new Date();
filtroMesAno.value = hoje.toISOString().slice(0, 7);

// Escuta a mudança de mês no filtro
filtroMesAno.addEventListener('change', atualizarInterface);

// Carrega os dados da nuvem assim que a página abre
carregarDadosDoBanco();

// =========================================================================
// 2. FUNÇÕES DE BANCO DE DADOS (SUPABASE)
// =========================================================================

// A. Buscar dados diretamente da nuvem
async function carregarDadosDoBanco() {
  const { data, error } = await supabaseClient
    .from('transacoes')
    .select('*');

  if (error) {
    console.error('Erro ao buscar dados do Supabase:', error);
    alert('Erro ao carregar dados do banco de dados na nuvem.');
    return;
  }

  transacoes = data || [];
  atualizarInterface();
}

// B. Salvar um novo lançamento no banco de dados
form.addEventListener('submit', async function(event) {
  event.preventDefault();

  const novaTransacao = {
    descricao: document.getElementById('descricao').value,
    valor: parseFloat(document.getElementById('valor').value),
    tipo: document.getElementById('tipo').value,
    categoria: document.getElementById('categoria').value,
    data: document.getElementById('data').value
  };

  const { data, error } = await supabaseClient
    .from('transacoes')
    .insert([novaTransacao])
    .select();

  if (error) {
    console.error('Erro ao salvar no Supabase:', error);
    alert('Erro ao salvar lançamento no banco de dados!');
    return;
  }

  // Adiciona o item salvo à lista local e ajusta o filtro de mês
  transacoes.push(data[0]);
  filtroMesAno.value = novaTransacao.data.slice(0, 7);
  
  atualizarInterface();
  form.reset();
});

// C. Deletar lançamento do banco de dados
async function deletarTransacao(id) {
  if (!confirm('Deseja realmente apagar este lançamento?')) return;

  const { error } = await supabaseClient
    .from('transacoes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao excluir do Supabase:', error);
    alert('Erro ao apagar o registro no banco.');
    return;
  }

  transacoes = transacoes.filter(t => t.id !== id);
  atualizarInterface();
}

// =========================================================================
// 3. INTERFACE E TABELA
// =========================================================================

function atualizarInterface() {
  const mesSelecionado = filtroMesAno.value; // Ex: "2026-11"

  // Filtrar lançamentos apenas do mês selecionado
  const transacoesDoMes = transacoes.filter(t => t.data.startsWith(mesSelecionado));

  // Ordenar por data (mais antigo -> mais recente)
  transacoesDoMes.sort((a, b) => new Date(a.data) - new Date(b.data));

  tabelaCorpo.innerHTML = '';
  let saldoMes = 0;

  transacoesDoMes.forEach(function(item) {
    if (item.tipo === 'RECEITA') {
      saldoMes += item.valor;
    } else {
      saldoMes -= item.valor;
    }

    const classeCor = item.tipo === 'RECEITA' ? 'valor-receita' : 'valor-despesa';
    const sinal = item.tipo === 'RECEITA' ? '+' : '-';

    const linha = document.createElement('tr');
    linha.innerHTML = `
      <td>${item.data}</td>
      <td>${item.descricao}</td>
      <td>${item.tipo}</td>
      <td>${item.categoria}</td>
      <td class="${classeCor}">${sinal} R$ ${item.valor.toFixed(2)}</td>
      <td>
        <button onclick="deletarTransacao(${item.id})" style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;">Apagar</button>
      </td>
    `;
    tabelaCorpo.appendChild(linha);
  });

  saldoTotalElemento.textContent = saldoMes.toFixed(2);
  atualizarGraficos(transacoesDoMes);
}

// =========================================================================
// 4. GRÁFICOS (CHART.JS)
// =========================================================================

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

  // --- C. Temporal: Acumulado Mensal (Todas as Transações) ---
  const acumuladoPorMes = {};
  transacoes.forEach(t => {
    const mes = t.data.slice(0, 7);
    if (!acumuladoPorMes[mes]) {
      acumuladoPorMes[mes] = { receita: 0, despesa: 0 };
    }
    if (t.tipo === 'RECEITA') {
      acumuladoPorMes[mes].receita += t.valor;
    } else {
      acumuladoPorMes[mes].despesa += t.valor;
    }
  });

  const mesesOrdenados = Object.keys(acumuladoPorMes).sort();
  const dadosReceitasMensais = mesesOrdenados.map(m => acumuladoPorMes[m].receita);
  const dadosDespesasMensais = mesesOrdenados.map(m => acumuladoPorMes[m].despesa);

  // Destruir instâncias antigas de gráficos
  if (meuGraficoDespesas) meuGraficoDespesas.destroy();
  if (meuGraficoReceitas) meuGraficoReceitas.destroy();
  if (meuGraficoTemporal) meuGraficoTemporal.destroy();

  // Renderizar Pizza Despesas
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

  // Renderizar Pizza Receitas
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

  // Renderizar Gráfico Temporal (Barras Comparativas)
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
