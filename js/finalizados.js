// Listas de atendimentos finalizados por mês (Finalizados > Ambulatório, Enfermaria e Encaminhamentos).
// Cada página chama iniciarFinalizados('<id da página>').
const LABEL_TIPO_SAIDA = { alta: 'Alta', obito: 'Óbito', transferencia: 'Transferência', encerramento: 'Encerramento' };
const CLASSE_TIPO_SAIDA = { alta: 'ok', obito: 'erro', transferencia: 'info', encerramento: 'neutro' };

const minutosEntre = (ini, fim) => (new Date(fim) - new Date(ini)) / 60000;
function fmtDuracao(min) {
  if (!isFinite(min) || min < 0) return '—';
  if (min < 60) return `${Math.round(min)} min`;
  if (min < 48 * 60) return `${(min / 60).toFixed(1).replace('.', ',')} h`;
  return `${(min / 1440).toFixed(1).replace('.', ',')} dias`;
}
const media = valores => (valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : NaN);
const entradaIso = a => `${a.data}T${a.hora || '00:00'}`;

const CONFIG_FINALIZADOS = {
  'fin-ambulatorio': {
    finalizacao: finalizacaoAmbulatorio,
    vazio: 'Nenhum atendimento finalizado no ambulatório neste mês.',
    filtros: [['todos', 'Todos'], ['alta', 'Alta'], ['internacao', 'Internação']],
    filtrar: (x, f) => f === 'todos' || x.fin.destino === f,
    selo: x => (x.fin.destino === 'alta' ? ['ok', 'Alta'] : ['info', 'Internação']),
    resumo: x => x.a.consulta.diagnostico || x.a.relato,
    stats: lista => [
      ['Finalizados', lista.length, 'blue', 'task_alt'],
      ['Altas', lista.filter(x => x.fin.destino === 'alta').length, 'green', 'directions_walk'],
      ['Para internação', lista.filter(x => x.fin.destino === 'internacao').length, 'red', 'home_health'],
      ['Tempo médio (entrada → saída)', fmtDuracao(media(lista.map(x => minutosEntre(entradaIso(x.a), x.fin.em)))), 'yellow', 'timer'],
    ],
  },
  'fin-enfermaria': {
    finalizacao: finalizacaoEnfermaria,
    documentos: true, // botões de prontuário (individual e do mês) — precisa de prontuario.js na página
    vazio: 'Nenhuma saída da enfermaria neste mês.',
    filtros: [['todos', 'Todos'], ['alta', 'Alta'], ['obito', 'Óbito'], ['transferencia', 'Transferência'], ['encerramento', 'Encerramento']],
    filtrar: (x, f) => f === 'todos' || x.fin.tipo === f,
    selo: x => [CLASSE_TIPO_SAIDA[x.fin.tipo], LABEL_TIPO_SAIDA[x.fin.tipo]],
    resumo: x => (x.fin.cid ? `${SUS.fmtCid(x.fin.cid)} · ${x.fin.cidDescricao || ''}` : x.a.consulta.diagnostico || x.a.relato),
    stats: lista => [
      ['Saídas', lista.length, 'blue', 'logout'],
      ['Altas', lista.filter(x => x.fin.tipo === 'alta').length, 'green', 'directions_walk'],
      ['Óbitos', lista.filter(x => x.fin.tipo === 'obito').length, 'red', 'heart_broken'],
      ['Permanência média', fmtDuracao(media(lista.map(x => minutosEntre(x.a.internacao.admissao?.em || x.a.internacao.admissao?.salvaEm, x.fin.em)))), 'yellow', 'calendar_month'],
    ],
  },
  encaminhamentos: {
    finalizacao: encaminhamentoRealizado,
    vazio: 'Nenhum encaminhamento para exames ou telemedicina neste mês.',
    filtros: [['todos', 'Todos'], ['exames', 'Exames (LabSUS)'], ['telemedicina', 'Telemedicina']],
    filtrar: (x, f) => f === 'todos' || x.fin.tipo === f,
    selo: x => (x.fin.tipo === 'exames' ? ['info', 'Exames (LabSUS)'] : ['ok', 'Telemedicina']),
    resumo: x => (x.fin.tipo === 'exames' ? (x.a.exames.solicitacoes || []).map(e => e.exame).join(', ') || x.a.relato : x.a.relato),
    stats: lista => [
      ['Encaminhamentos', lista.length, 'blue', 'alt_route'],
      ['Exames (LabSUS)', lista.filter(x => x.fin.tipo === 'exames').length, 'green', 'biotech'],
      ['Telemedicina', lista.filter(x => x.fin.tipo === 'telemedicina').length, 'yellow', 'video_call'],
      ['Exames solicitados', lista.reduce((s, x) => s + (x.fin.tipo === 'exames' ? (x.a.exames.solicitacoes || []).length : 0), 0), 'red', 'lab_profile'],
    ],
  },
};

let cfgFin = null;
let filtroFin = 'todos';
let buscaFin = '';
let selecionadoFin = null;

const mesAtual = () => isoDate(new Date()).slice(0, 7);
function nomeMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  const txt = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

// atendimentos finalizados no mês escolhido, mais recentes primeiro
function finalizadosDoMes() {
  const mes = document.getElementById('mesFin').value || mesAtual();
  return Store.all()
    .map(a => ({ a, fin: cfgFin.finalizacao(a) }))
    .filter(x => x.fin?.em && x.fin.em.slice(0, 7) === mes)
    .sort((x, y) => y.fin.em.localeCompare(x.fin.em));
}

function renderFinalizados() {
  const mes = document.getElementById('mesFin').value || mesAtual();
  document.getElementById('mesNome').textContent = nomeMes(mes);
  document.getElementById('mesProximo').disabled = mes >= mesAtual();

  const doMes = finalizadosDoMes();
  document.getElementById('statsFin').innerHTML = cfgFin.stats(doMes).map(([label, valor, cor, icone]) => `
    <div class="stat-card">
      <div class="stat-icon ${cor}"><span class="material-symbols-outlined">${icone}</span></div>
      <div class="stat-info"><p>${label}</p><h4>${valor}</h4></div>
    </div>`).join('');

  const q = (buscaFin || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const qd = buscaFin.replace(/\D/g, '');
  const lista = doMes
    .filter(x => cfgFin.filtrar(x, filtroFin))
    .filter(x => !q || x.a.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q)
      || (qd && [x.a.ident.cns, x.a.ident.cpf].some(v => (v || '').replace(/\D/g, '').includes(qd))));

  document.getElementById('contFin').textContent = `${lista.length} de ${doMes.length}`;
  document.querySelectorAll('.doc-mes').forEach(btn => {
    btn.disabled = !doMes.length;
    btn.querySelector('.qtd').textContent = doMes.length;
  });
  // AIHs só depois que todos os finalizados do mês tiverem número; "Gerar AIHs" enquanto faltar algum
  const semNumero = doMes.filter(x => !x.a.internacao?.aih?.numero).length;
  const btnAihs = document.getElementById('btnAihsMes');
  if (btnAihs) {
    btnAihs.disabled = !doMes.length || semNumero > 0;
    btnAihs.title = semNumero ? 'Disponível depois de gerar as numerações em "Gerar AIHs"' : 'Gerar as AIHs de todas as saídas do mês';
  }
  const btnGerar = document.getElementById('btnGerarAihs');
  if (btnGerar) {
    btnGerar.disabled = !semNumero;
    btnGerar.querySelector('.qtd').textContent = semNumero;
    btnGerar.title = semNumero ? `Gerar o número de AIH de ${semNumero} atendimento${semNumero > 1 ? 's' : ''} sem numeração` : 'Todos os atendimentos do mês já têm número de AIH';
  }
  const btnExp = document.getElementById('btnExportarProducao');
  if (btnExp) {
    btnExp.disabled = !doMes.length || semNumero > 0;
    btnExp.title = !doMes.length ? 'Nenhuma saída no mês' : semNumero ? 'Disponível depois de gerar as numerações em "Gerar AIHs"' : 'Baixar o arquivo CSV com a produção das AIHs do mês';
  }
  document.getElementById('vazioFin').style.display = lista.length ? 'none' : 'block';
  document.getElementById('vazioFin').querySelector('p').textContent = doMes.length ? 'Nenhum atendimento com esse filtro.' : cfgFin.vazio;
  document.getElementById('listaFin').innerHTML = lista.map(x => {
    const [classe, texto] = cfgFin.selo(x);
    return `<div class="patient-item ${selecionadoFin === x.a.id ? 'selected' : ''}" onclick="selecionarFin(${x.a.id})">
      <div class="pat-avatar" style="background:${x.a.color}">${esc(iniciais(x.a.nome))}</div>
      <div class="pat-info">
        <h6>${esc(x.a.nome)}</h6>
        <p>🕒 ${esc(fmtDataHora(x.fin.em))} &nbsp;·&nbsp; entrada ${esc(fmtData(x.a.data))}</p>
        <p style="margin-top:1px;font-size:.69rem">${esc(cfgFin.resumo(x) || '')}</p>
      </div>
      <div class="pat-meta"><span class="selo ${classe}">${esc(texto)}</span></div>
    </div>`;
  }).join('');

  // o selecionado pode ter saído do mês/filtro
  if (selecionadoFin && !lista.some(x => x.a.id === selecionadoFin)) limparDetalheFin();
}

function mudarMes(delta) {
  const input = document.getElementById('mesFin');
  const [y, m] = (input.value || mesAtual()).split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  input.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  renderFinalizados();
}

function setFiltroFin(f, el) {
  document.querySelectorAll('#filtrosFin .chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  filtroFin = f;
  renderFinalizados();
}

// ===== DETALHE =====
function limparDetalheFin() {
  selecionadoFin = null;
  document.getElementById('detalheVazio').style.display = 'block';
  document.getElementById('detalheFin').style.display = 'none';
}

function itemLinha(icone, titulo, quando, corpo) {
  return `<div class="tl-item">
    <span class="tl-dot"><span class="material-symbols-outlined">${icone}</span></span>
    <div class="tl-body">
      <div class="tl-titulo">${titulo}${quando ? `<span class="tl-quando">${esc(quando)}</span>` : ''}</div>
      ${corpo}
    </div>
  </div>`;
}
const campo = (label, valor) => (valor ? `<p><span class="lbl">${label}</span>${esc(valor)}</p>` : '');

function selecionarFin(id) {
  const a = Store.all().find(x => x.id === id);
  const fin = a && cfgFin.finalizacao(a);
  if (!fin) return;
  selecionadoFin = id;
  const i = a.ident, t = a.triagem, c = a.consulta, o = a.observacao, int = a.internacao;
  const idade = calcAge(i.nasc);
  const [classe, texto] = cfgFin.selo({ a, fin });

  document.getElementById('detNome').textContent = a.nome;
  document.getElementById('detSub').textContent = `Finalizado em ${fmtDataHora(fin.em)}`;

  const blocos = [];
  blocos.push(itemLinha('login', 'Entrada', `${fmtData(a.data)} às ${a.hora}`,
    campo('Origem', a.origem === 'transferencia' ? `Transferência${a.destinoTransf ? ' · ' + (TRANSF_LABELS[a.destinoTransf] || a.destinoTransf) : ''}` : 'Novo')
    + campo('Relato', a.relato)));

  if (t?.risco) {
    const r = RISCOS[t.risco];
    const sv = [t.pa && `PA ${t.pa}`, t.temp && `${t.temp} °C`, t.fc && `FC ${t.fc}`, t.spo2 && `SpO₂ ${t.spo2}%`].filter(Boolean).join(' · ');
    blocos.push(itemLinha('monitor_heart', 'Triagem', '',
      `<p><span class="risk-badge" style="--rc:${r.cor}">${r.nome}</span></p>` + campo('Sinais vitais', sv) + campo('Queixa principal', t.queixa)
      + campo('Alergias', t.alergias?.length ? t.alergias.join(', ') : 'Nenhuma')));
  }

  if (c?.medico || c?.diagnostico) {
    blocos.push(itemLinha('stethoscope', 'Consulta', '',
      campo('Médico', c.medico) + campo('Diagnóstico', c.diagnostico) + campo('Plano de cuidado', c.plano)
      + campo('Prescrição', (c.prescricao || []).map(p => `${p.med}${p.pos ? ' (' + p.pos + ')' : ''}`).join('; '))));
  }

  if (o?.encaminhamento) {
    const meds = c.prescricao || [];
    const dadas = meds.filter((_, k) => o.checkins?.[k]?.administrado).length;
    blocos.push(itemLinha('eye_tracking', 'Observação', fmtDataHora(o.encaminhadoEm),
      campo('Medicações administradas', meds.length ? `${dadas} de ${meds.length}` : 'Nenhuma prescrita')
      + campo('Procedimentos', (o.procedimentos || []).map(p => `${p.proc} (${p.hora})`).join('; '))
      + (o.anotacoes || []).map(n => campo(`Anotação ${fmtDataHora(n.em)}`, n.texto)).join('')
      + campo('Encaminhamento', o.encaminhamento === 'alta' ? 'Alta' : 'Internação')));
  }

  if (int?.admissao?.salvaEm) {
    const adm = int.admissao;
    blocos.push(itemLinha('home_health', 'Internação', fmtDataHora(adm.em || adm.salvaEm),
      campo('Leito', leitoLabel(adm.leito)) + campo('Evoluções', `${evolucoesValidas(int.evolucoesEnf).length} de enfermagem · ${evolucoesValidas(int.evolucoesMed).length} médicas`)));
    if (int.saida) {
      const s = int.saida;
      blocos.push(itemLinha('logout', 'Saída da enfermaria', fmtDataHora(s.em),
        `<p><span class="selo ${CLASSE_TIPO_SAIDA[tipoSaida(s.motivo)]}">${esc(s.motivo)} - ${esc(motivoLabel(s.motivo))}</span></p>`
        + campo('CID', s.cid ? `${SUS.fmtCid(s.cid)} — ${s.cidDescricao || ''}` : '')
        + campo('Procedimento', s.procCodigo ? `${SUS.fmtProc(s.procCodigo)} — ${s.procDescricao || ''}` : '')
        + campo('Médico', s.medico)
        + campo('Permanência', fmtDuracao(minutosEntre(adm.em || adm.salvaEm, s.em)))));
    }
    if (cfgFin.documentos && int.saida) {
      const canceladas = (int.aihCanceladas || []).map(x =>
        campo(`Cancelada em ${fmtDataHora(x.canceladoEm)}`, `${x.numero} — ${x.motivo}${x.canceladoPor ? ' (' + x.canceladoPor.nome + ')' : ''}`)).join('');
      blocos.push(itemLinha('confirmation_number', 'AIH', int.aih ? fmtDataHora(int.aih.geradoEm || int.aih.reservadoEm) : '',
        (int.aih ? `<div class="aih-num"><span class="selo info faixa-num">Nº ${esc(int.aih.numero)}</span>
            <button type="button" class="btn-link-perigo" onclick="abrirCancelarAih()" title="Cancelar este número de AIH"><span class="material-symbols-outlined">block</span> Cancelar AIH</button></div>`
          : '<p class="field-hint" style="margin:0">Número ainda não gerado: use "Gerar AIHs" em Documentos do mês.</p>')
        + canceladas));
    }
  }

  if (a.destinoTransf === 'exames' && a.exames?.enviadoEm) {
    blocos.push(itemLinha('biotech', 'Enviado ao LabSUS', fmtDataHora(a.exames.enviadoEm),
      `<ul class="tl-lista">${(a.exames.solicitacoes || []).map(e => `<li>${esc(e.exame)}${e.obs ? ` <span class="tl-quando">${esc(e.obs)}</span>` : ''}</li>`).join('')}</ul>`));
  }
  if (a.destinoTransf === 'telemedicina' && a.telemedicina?.registradoEm) {
    blocos.push(itemLinha('video_call', 'Telemedicina registrada', fmtDataHora(a.telemedicina.registradoEm), ''));
  }

  document.getElementById('detResumo').innerHTML = `
    <div class="ps-grid" style="margin-bottom:8px">
      <div class="ps-item"><span class="ps-label">Sexo</span><span class="ps-value">${esc(SEXOS[i.sexo] || '—')}</span></div>
      <div class="ps-item"><span class="ps-label">Idade</span><span class="ps-value">${idade !== null ? idade + ' anos' : '—'}</span></div>
      <div class="ps-item"><span class="ps-label">CNS</span><span class="ps-value">${esc(i.cns || '—')}</span></div>
      <div class="ps-item"><span class="ps-label">Situação</span><span class="selo ${classe}">${esc(texto)}</span></div>
    </div>`;
  document.getElementById('detLinha').innerHTML = blocos.join('');
  const btnAih = document.getElementById('btnAihAtend');
  if (btnAih) {
    btnAih.disabled = !int?.aih?.numero;
    btnAih.title = int?.aih?.numero ? `AIH nº ${int.aih.numero}` : 'Disponível depois de gerar a numeração em "Gerar AIHs"';
  }
  document.getElementById('detalheVazio').style.display = 'none';
  document.getElementById('detalheFin').style.display = 'block';
  renderFinalizados();
  if (window.innerWidth <= 1100) document.getElementById('detalheCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== PRONTUÁRIOS (Enfermaria) =====
function prontuarioSelecionado() {
  const a = Store.all().find(x => x.id === selecionadoFin);
  if (a) abrirProntuarios([a]);
}

// todos os atendimentos finalizados no mês escolhido (independe do filtro e da busca), na ordem das saídas
function prontuariosDoMes() {
  const mes = document.getElementById('mesFin').value || mesAtual();
  const lista = finalizadosDoMes().sort((x, y) => x.fin.em.localeCompare(y.fin.em)).map(x => x.a);
  abrirProntuarios(lista, { titulo: 'Prontuários — Enfermaria', subtitulo: `Saídas de ${nomeMes(mes).toLowerCase()}` });
}

// ===== LAUDOS DE AIH (Enfermaria) =====
function laudoAihSelecionado() {
  const a = Store.all().find(x => x.id === selecionadoFin);
  if (!a) return;
  abrirLaudosAih([a]);
  selecionarFin(a.id); // mostra o número de AIH gerado
}

function laudosAihDoMes() {
  const mes = document.getElementById('mesFin').value || mesAtual();
  const lista = finalizadosDoMes().sort((x, y) => x.fin.em.localeCompare(y.fin.em)).map(x => x.a);
  abrirLaudosAih(lista, { titulo: `Laudos de AIH — saídas de ${nomeMes(mes).toLowerCase()}` });
  if (selecionadoFin) selecionarFin(selecionadoFin);
}

// ===== AIH (Enfermaria) =====
function aihSelecionada() {
  const a = Store.all().find(x => x.id === selecionadoFin);
  if (a?.internacao?.aih?.numero) abrirAihs([a]);
}

function aihsDoMes() {
  const mes = document.getElementById('mesFin').value || mesAtual();
  const lista = finalizadosDoMes().sort((x, y) => x.fin.em.localeCompare(y.fin.em)).map(x => x.a);
  abrirAihs(lista, { titulo: `AIHs — saídas de ${nomeMes(mes).toLowerCase()}` });
}

// gera a numeração dos finalizados do mês sem AIH, na ordem das saídas
// (primeiro os números cancelados, depois os seguintes da faixa vigente)
const semNumeroDoMes = () => finalizadosDoMes().sort((x, y) => x.fin.em.localeCompare(y.fin.em)).map(x => x.a).filter(a => !a.internacao?.aih?.numero);
function abrirGerarAihs() {
  const pendentes = semNumeroDoMes();
  if (!pendentes.length) { showToast('Todos os atendimentos do mês já têm número de AIH'); return; }
  const mes = document.getElementById('mesFin').value || mesAtual();
  const liberados = AihsLiberadas.get().length;
  const faixa = FaixasAih.all().find(f => faixaStatus(f) === 'vigente');
  const disponiveis = liberados + (faixa ? faixaDisponiveis(faixa) : 0);
  document.getElementById('gerarAihsTexto').innerHTML = `${pendentes.length} atendimento${pendentes.length > 1 ? 's' : ''} finalizado${pendentes.length > 1 ? 's' : ''} em
    ${esc(nomeMes(mes).toLowerCase())} sem número de AIH: ${pendentes.map(a => esc(a.nome)).join(', ')}.<br>
    ${disponiveis ? `Números disponíveis: ${disponiveis}${liberados ? ` (${liberados} cancelado${liberados > 1 ? 's' : ''} a reaproveitar)` : ''}.`
      : '<strong>Não há faixa de AIH vigente com números disponíveis.</strong>'}`;
  document.getElementById('btnConfirmarGerar').disabled = !disponiveis;
  document.getElementById('modalGerarAihs').classList.add('open');
}
function fecharGerarAihs() { document.getElementById('modalGerarAihs').classList.remove('open'); }
function confirmarGerarAihs() {
  const pendentes = semNumeroDoMes();
  let gerados = 0;
  for (const a of pendentes) {
    if (!garantirNumeroAih(a)) break;
    gerados++;
  }
  fecharGerarAihs();
  renderFinalizados();
  if (selecionadoFin) selecionarFin(selecionadoFin);
  showToast(gerados === pendentes.length
    ? `✅ ${gerados} número${gerados > 1 ? 's' : ''} de AIH gerado${gerados > 1 ? 's' : ''}`
    : `⚠️ Faixa de AIH esgotada: ${gerados} de ${pendentes.length} gerados. Cadastre uma nova faixa.`);
}

// produção do mês em CSV (só com todas as AIHs numeradas)
function exportarProducao() {
  const lista = finalizadosDoMes().map(x => x.a);
  if (!lista.length || lista.some(a => !a.internacao?.aih?.numero)) { showToast('⚠️ Gere as numerações em "Gerar AIHs" antes de exportar a produção'); return; }
  const mes = document.getElementById('mesFin').value || mesAtual();
  const { csv, incompletos } = producaoCsv(lista);
  baixarArquivo(`producao-aih-${mes}.csv`, csv, 'text/csv;charset=utf-8');
  showToast(incompletos.length
    ? `⚠️ Produção exportada (${lista.length} AIHs), mas ${incompletos.length} com campos obrigatórios em branco: ${incompletos.map(x => `${x.nome} (${x.faltam.join(', ')})`).join('; ')}`
    : `✅ Produção de ${nomeMes(mes).toLowerCase()} exportada: ${lista.length} AIH${lista.length > 1 ? 's' : ''}`);
}

// cancelar: o número volta para ser reaproveitado na próxima AIH gerada
function abrirCancelarAih() {
  const a = Store.all().find(x => x.id === selecionadoFin);
  if (!a?.internacao?.aih) return;
  document.getElementById('cancAihNumero').textContent = a.internacao.aih.numero;
  document.getElementById('cancAihMotivo').value = '';
  document.getElementById('cancAihMotivo').classList.remove('error');
  document.getElementById('modalCancAih').classList.add('open');
  document.getElementById('cancAihMotivo').focus();
}
function fecharCancelarAih() { document.getElementById('modalCancAih').classList.remove('open'); }
function confirmarCancelarAih() {
  const motivo = document.getElementById('cancAihMotivo').value.trim();
  if (!motivo) { document.getElementById('cancAihMotivo').classList.add('error'); showToast('⚠️ Informe o motivo do cancelamento'); return; }
  const numero = Store.all().find(x => x.id === selecionadoFin)?.internacao?.aih?.numero;
  if (!cancelarAih(selecionadoFin, motivo)) return;
  fecharCancelarAih();
  showToast(`🗑️ AIH ${numero} cancelada — o número será reaproveitado`);
  selecionarFin(selecionadoFin);
}

function montarBotoesDocumentos() {
  // documentos de todas as saídas do mês: faixa logo abaixo do cabeçalho da lista
  const docMes = (id, acao, icone, rotulo, dica) => `
    <button type="button" class="doc-mes" id="${id}" onclick="${acao}()" title="${dica}">
      <span class="material-symbols-outlined">${icone}</span><span class="doc-mes-txt">${rotulo}</span><span class="qtd">0</span>
    </button>`;
  document.querySelector('.list-card-header').insertAdjacentHTML('afterend', `
    <div class="docs-mes">
      <div class="docs-mes-topo">
        <span class="docs-mes-lbl"><span class="material-symbols-outlined">print</span> Documentos do mês</span>
        <div class="docs-mes-acoes">
          <button type="button" class="btn-gerar-aihs" id="btnGerarAihs" onclick="abrirGerarAihs()">
            <span class="material-symbols-outlined">pin</span> Gerar AIHs <span class="qtd">0</span>
          </button>
          <button type="button" class="btn-gerar-aihs btn-exportar" id="btnExportarProducao" onclick="exportarProducao()">
            <span class="material-symbols-outlined">download</span> Exportar Produção
          </button>
        </div>
      </div>
      <div class="docs-mes-grid">
        ${docMes('btnProntMes', 'prontuariosDoMes', 'description', 'Prontuários', 'Gerar os prontuários de todas as saídas do mês')}
        ${docMes('btnAihMes', 'laudosAihDoMes', 'assignment', 'Laudos de AIH', 'Gerar os laudos de AIH de todas as saídas do mês')}
        ${docMes('btnAihsMes', 'aihsDoMes', 'confirmation_number', 'AIHs', 'Gerar as AIHs de todas as saídas do mês')}
      </div>
    </div>`);
  // documentos do atendimento selecionado: seção própria, antes da linha do tempo
  const docAtend = (acao, icone, rotulo) => `
    <button type="button" class="doc-atend" onclick="${acao}()"${acao === 'aihSelecionada' ? ' id="btnAihAtend"' : ''}><span class="material-symbols-outlined">${icone}</span>${rotulo}</button>`;
  document.getElementById('detResumo').insertAdjacentHTML('afterend', `
    <div class="form-section">
      <div class="section-label"><span class="material-symbols-outlined">print</span> Documentos</div>
      <div class="docs-atend">
        ${docAtend('prontuarioSelecionado', 'description', 'Prontuário')}
        ${docAtend('laudoAihSelecionado', 'assignment', 'Laudo de AIH')}
        ${docAtend('aihSelecionada', 'confirmation_number', 'AIH')}
      </div>
    </div>`);
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="modalGerarAihs" onclick="if (event.target === this) fecharGerarAihs()">
      <div class="modal-box">
        <div class="modal-icon modal-icon-info"><span class="material-symbols-outlined">pin</span></div>
        <h5>Gerar números de AIH?</h5>
        <p id="gerarAihsTexto"></p>
        <div class="modal-actions">
          <button type="button" class="btn-mc" onclick="fecharGerarAihs()">Voltar</button>
          <button type="button" class="btn-md btn-md-info" id="btnConfirmarGerar" onclick="confirmarGerarAihs()"><span class="material-symbols-outlined" style="font-size:1rem">pin</span> Gerar</button>
        </div>
      </div>
    </div>
    <div class="modal-overlay" id="modalCancAih" onclick="if (event.target === this) fecharCancelarAih()">
      <div class="modal-box">
        <div class="modal-icon"><span class="material-symbols-outlined">block</span></div>
        <h5>Cancelar AIH nº <span id="cancAihNumero" class="faixa-num"></span>?</h5>
        <p>O número volta para a numeração e será o primeiro reaproveitado na próxima AIH gerada. O cancelamento fica registrado no atendimento.</p>
        <textarea class="field-textarea" id="cancAihMotivo" placeholder="Motivo do cancelamento" style="margin-bottom:16px;text-align:left" oninput="this.classList.remove('error')"></textarea>
        <div class="modal-actions">
          <button type="button" class="btn-mc" onclick="fecharCancelarAih()">Voltar</button>
          <button type="button" class="btn-md" onclick="confirmarCancelarAih()"><span class="material-symbols-outlined" style="font-size:1rem">block</span> Cancelar AIH</button>
        </div>
      </div>
    </div>`);
}

// ===== INIT =====
function iniciarFinalizados(pagina) {
  if (!iniciarPagina(pagina)) return;
  cfgFin = CONFIG_FINALIZADOS[pagina];
  if (cfgFin.documentos) montarBotoesDocumentos();
  document.getElementById('mesFin').value = mesAtual();
  document.getElementById('mesFin').max = mesAtual();
  document.getElementById('filtrosFin').innerHTML = cfgFin.filtros.map(([k, l], idx) =>
    `<button class="chip ${idx ? '' : 'active'}" onclick="setFiltroFin('${k}', this)">${l}</button>`).join('');
  renderFinalizados();
  Store.onChange(renderFinalizados);
}
