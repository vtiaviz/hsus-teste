// Prontuário do paciente para impressão (ou "Salvar como PDF" no navegador).
// Documento oficial: reproduz só o que foi registrado no sistema, em ordem cronológica, com data, hora e
// identificação do profissional de cada registro (Res. CFM 1.638/2002 art. 5º; Res. COFEN 429/2012 e 545/2017).
// Usa: clinbot.js, sus/sus.js (formatação de CID/procedimento) e admissao-campos.js.

// ---------- textos ----------
const ORIGEM_LABEL = a => (a.origem === 'transferencia'
  ? `Transferência${a.destinoTransf ? ' — ' + (TRANSF_LABELS[a.destinoTransf] || a.destinoTransf) : ''}` : 'Demanda espontânea (novo)');
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const SEM_AUTORIA = 'Profissional e horário do registro não gravados pelo sistema (registro anterior à identificação automática)';

// idade na data do atendimento (não na data de emissão)
function idadeEm(nasc, data) {
  if (!nasc || !data) return null;
  const [y, m, d] = nasc.split('-').map(Number);
  const [ry, rm, rd] = data.slice(0, 10).split('-').map(Number);
  return ry - y - (rm < m || (rm === m && rd < d) ? 1 : 0);
}
const duracao = (ini, fim) => {
  const h = (new Date(fim) - new Date(ini)) / 3600000;
  if (!isFinite(h) || h < 0) return '';
  if (h < 24) return `${Math.round(h)} h`;
  const dias = Math.floor(h / 24), resto = Math.round(h % 24);
  return `${dias} dia${dias > 1 ? 's' : ''}${resto ? ` e ${resto} h` : ''}`;
};
const capitalizar = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
const doseLabel = h => (h === 'DU' ? 'dose única' : h === 'SN' ? 'se necessário' : `horário ${h}`);

// ---------- blocos de HTML ----------
const ic = nome => `<span class="ms">${nome}</span>`;
const NAO_INFORMADO = '<em class="nao-inf">Não informado</em>';

// campo rótulo/valor; "sempre" mostra "Não informado" em vez de omitir (usado na identificação)
function campoDoc(rotulo, valor, { sempre = false, largo = false, html = false } = {}) {
  const tem = valor || valor === 0;
  if (!tem && !sempre) return '';
  return `<div class="cp${largo ? ' largo' : ''}"><span>${esc(rotulo)}</span><div>${tem ? (html ? valor : esc(valor)) : NAO_INFORMADO}</div></div>`;
}
const camposDoc = itens => { const h = itens.filter(Boolean).join(''); return h ? `<div class="cps">${h}</div>` : ''; };
const textoLivre = (rotulo, valor) => (valor ? `<div class="tx"><span>${esc(rotulo)}</span><p>${esc(valor)}</p></div>` : '');
const subtitulo = (titulo, corpo) => (corpo ? `<h4>${esc(titulo)}</h4>${corpo}` : '');

function tabela(cabecalho, linhas, { html = [] } = {}) {
  if (!linhas.length) return '';
  return `<table><thead><tr>${cabecalho.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${linhas.map(l => `<tr>${l.map((v, i) => `<td>${html.includes(i) ? v ?? '' : esc(v ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

const UNIDADES = [['pa', 'PA', ' mmHg'], ['temp', 'Temp.', ' °C'], ['fc', 'FC', ' bpm'], ['fr', 'FR', ' irpm'], ['spo2', 'SpO₂', '%'], ['glicemia', 'HGT', ' mg/dL'], ['peso', 'Peso', ' kg']];
function sinaisVitais(s) {
  const itens = UNIDADES.filter(([k]) => s?.[k]).map(([k, l, u]) => `<span class="sv"><small>${l}</small>${esc(s[k])}${u}</span>`);
  return itens.length ? `<div class="svs">${itens.join('')}</div>` : '';
}

// "Helena Rocha · Médico clínico · CRM-PA 23456"
const identificacao = p => [`<strong>${esc(p.nome)}</strong>`, p.cargo && esc(p.cargo), p.conselho && esc(p.conselho)].filter(Boolean).join(' · ');

// linha de autoria de um registro
function autoriaLinha(por, em, rotulo = 'Registrado por') {
  if (!por) return `<div class="autoria sem">${ic('help')} ${SEM_AUTORIA}${em ? ` · horário do registro: ${esc(fmtDataHora(em))}` : ''}</div>`;
  return `<div class="autoria">${ic('verified_user')} <span>${rotulo} ${identificacao(por)}${em ? ` — em ${esc(fmtDataHora(em))}` : ''}</span></div>`;
}
// autoria de um bloco (quem registrou e cada alteração posterior)
function autoriaBloco(reg) {
  if (!reg?.criado) return autoriaLinha(null);
  return autoriaLinha(reg.criado.por, reg.criado.em) +
    (reg.alteracoes || []).map(x => autoriaLinha(x.por, x.em, 'Alterado por')).join('');
}

// seção numerada do documento
function secao(numero, icone, titulo, corpo, extra = '') {
  return `<section class="sec">
    <h2><span class="sec-ic">${ic(icone)}</span><span class="sec-n">${numero}.</span> ${esc(titulo)}${extra ? `<span class="sec-extra">${extra}</span>` : ''}</h2>
    <div class="sec-corpo">${corpo}</div>
  </section>`;
}
// registro datado dentro de uma seção (linha do tempo)
function registro({ icone = 'edit_note', tipo = '', classe = '', titulo, quando, corpo, rodape }) {
  return `<div class="reg ${classe}">
    <div class="reg-dot">${ic(icone)}</div>
    <div class="reg-corpo">
      <div class="reg-cab"><span>${tipo ? `<span class="tag ${classe}">${esc(tipo)}</span>` : ''}<strong>${esc(titulo)}</strong></span>${quando ? `<span class="reg-quando">${esc(quando)}</span>` : ''}</div>
      ${corpo || ''}
      ${rodape || ''}
    </div>
  </div>`;
}
const semRegistro = msg => `<p class="sem-reg">${ic('do_not_disturb_on')} ${esc(msg)}</p>`;

// situação de um check-in (administração/coleta) como foi gravado
function situacaoCheckin(ck, verbo) {
  if (ck?.administrado) return { html: `<span class="selo ok">${verbo} às ${esc(ck.hora)}</span>`, por: ck.por, em: ck.em, gravado: true };
  if (ck?.desfeito) return { html: `<span class="selo alerta">Registro das ${esc(ck.desfeito.hora || '—')} desfeito</span>`, por: ck.desfeito.por, em: ck.desfeito.em, gravado: true };
  return { html: '<span class="selo neutro">Sem registro</span>', gravado: false };
}
const quemQuando = (por, em) => (por ? `${identificacao(por)}${em ? `<br><small>${esc(fmtDataHora(em))}</small>` : ''}` : '<em class="nao-inf">Não gravado</em>');
const responsavelCheckin = st => (st.gravado ? quemQuando(st.por, st.em) : '—');

function cabecalhoHospital() {
  const h = Hospital.get();
  const endereco = [[h.logradouro, h.numero].filter(Boolean).join(', '), h.bairro, [h.cidade, h.uf].filter(Boolean).join('/'), h.cep && `CEP ${h.cep}`].filter(Boolean).join(' · ');
  return `<div class="hosp">
    <img src="${new URL('images/logo.png', location.href).href}" alt="">
    <div class="hosp-dados"><strong>${esc(h.nome || 'Estabelecimento de saúde')}</strong><small>CNES ${esc(h.cnes || 'não informado')}${endereco ? ' · ' + esc(endereco) : ''}</small></div>
  </div>`;
}

// ---------- equipe que registrou (para a folha de assinaturas) ----------
function novaEquipe() {
  const mapa = new Map();
  const chave = p => (p.id != null ? `id:${p.id}` : `nome:${p.nome}`);
  return {
    // autor gravado no registro (retrato do cadastro na hora)
    autor(por, atuacao) {
      if (!por) return;
      const k = chave(por);
      if (!mapa.has(k)) mapa.set(k, { ...por, atuacoes: new Set() });
      mapa.get(k).atuacoes.add(atuacao);
    },
    // profissional escolhido como responsável (médico da consulta, da evolução, da saída...)
    responsavel(id, texto, atuacao) {
      if (id == null && !texto) return;
      const p = id != null ? Profissionais.get(id) : null;
      this.autor(p ? { id: p.id, nome: p.nome, cargo: p.cargo, conselho: conselhoLabel(p) } : { nome: texto, cargo: '', conselho: '' }, atuacao);
    },
    lista: () => [...mapa.values()],
  };
}

// ---------- prontuário de um atendimento ----------
function prontuarioHtml(a, emissao = '') {
  const i = a.ident || {}, t = a.triagem || {}, c = a.consulta || {}, o = a.observacao, int = a.internacao || {};
  const adm = int.admissao?.salvaEm ? int.admissao : null;
  const s = int.saida;
  const etapas = stagesOf(a);
  const equipe = novaEquipe();
  const idade = idadeEm(i.nasc, a.data);
  const entradaEm = `${a.data}T${a.hora}`;
  const partes = [];
  let n = 0;

  // ===== Identificação =====
  const tipoLog = capitalizar(i.tipoLogradouro);
  const endereco = [[tipoLog, i.logradouro].filter(Boolean).join(' '), i.numero && `nº ${i.numero}`, i.bairro, i.municipio, i.cep && `CEP ${i.cep}`].filter(Boolean).join(', ');
  equipe.autor(i.reg?.criado?.por, 'Identificação do paciente');
  partes.push(secao(++n, 'badge', 'Identificação do paciente',
    camposDoc([
      campoDoc('Nome completo', a.nome, { sempre: true, largo: true }),
      campoDoc('Data de nascimento', i.nasc ? `${fmtData(i.nasc)}${idade !== null ? ` · ${idade} anos na entrada` : ''}` : '', { sempre: true }),
      campoDoc('Nome da mãe', i.mae, { sempre: true, largo: true }),
      campoDoc('Sexo', SEXOS[i.sexo], { sempre: true }),
      campoDoc('Raça/cor', RACAS[i.raca], { sempre: true }),
      campoDoc('Naturalidade', i.naturalidade, { sempre: true }),
      campoDoc('Telefone', i.telefone, { sempre: true }),
      campoDoc('Cartão Nacional de Saúde (CNS)', i.cns, { sempre: true }),
      campoDoc('CPF', i.cpf, { sempre: true }),
      campoDoc('Nº do prontuário', i.prontuario, { sempre: true }),
      campoDoc('Endereço completo', endereco, { sempre: true, largo: true }),
    ]) + autoriaBloco(i.reg)));

  // ===== Resumo do atendimento =====
  const fimEntradas = encaminhamentoRealizado(a);
  const desfecho = s ? motivoLabel(s.motivo)
    : o?.encaminhamento === 'alta' ? 'Alta da observação'
    : fimEntradas ? (fimEntradas.tipo === 'exames' ? 'Enviado ao LabSUS' : 'Telemedicina registrada')
    : c.encaminhamento === 'alta' && isConcluido(a) ? 'Alta na consulta' : 'Sem saída registrada';
  const fimEm = s?.em || (o?.encaminhamento === 'alta' ? o.encaminhadoEm : '') || fimEntradas?.em || '';
  const resumo = [
    ['login', 'Entrada', fmtDataHora(entradaEm), ORIGEM_LABEL(a), ''],
    adm && ['king_bed', 'Admissão', fmtDataHora(adm.em || adm.salvaEm), leitoLabel(adm.leito), ''],
    ['logout', 'Saída', fimEm ? fmtDataHora(fimEm) : '—', desfecho, s ? tipoSaida(s.motivo) : ''],
    fimEm && ['schedule', 'Permanência', duracao(entradaEm, fimEm), adm ? `internação: ${duracao(adm.em || adm.salvaEm, fimEm)}` : 'total na unidade', ''],
  ].filter(Boolean);
  partes.push(secao(++n, 'summarize', 'Resumo do atendimento',
    `<div class="resumo">${resumo.map(([icone, rotulo, valor, detalhe, tipo]) => `
      <div class="res ${tipo ? 'res-' + tipo : ''}">
        <span class="res-ic">${ic(icone)}</span>
        <div><small>${rotulo}</small><strong>${esc(valor)}</strong>${detalhe ? `<em>${esc(detalhe)}</em>` : ''}</div>
      </div>`).join('')}</div>` +
    camposDoc([
      campoDoc('Diagnóstico de entrada', c.diagnostico),
      s?.cid && campoDoc('CID-10 principal (saída)', `${SUS.fmtCid(s.cid)} — ${s.cidDescricao || ''}`),
      s?.procCodigo && campoDoc('Procedimento SUS realizado', `${SUS.fmtProc(s.procCodigo)} — ${s.procDescricao || ''}`),
      etapas.includes('triagem') && t.risco && campoDoc('Alergias (triagem)', t.alergias?.length ? t.alergias.join(', ') : 'Nenhuma registrada'),
    ])));

  // ===== Entrada e atendimento inicial (recepção, triagem, consulta) =====
  const regsEntrada = [];
  equipe.autor(a.reg?.criado?.por, 'Registro da entrada');
  regsEntrada.push(registro({ icone: 'login', titulo: 'Entrada na unidade', quando: fmtDataHora(entradaEm),
    corpo: camposDoc([campoDoc('Origem', ORIGEM_LABEL(a))]) + textoLivre('Relato / motivo da procura', a.relato),
    rodape: autoriaBloco(a.reg) }));

  if (etapas.includes('triagem')) {
    const r = RISCOS[t.risco];
    const temTriagem = t.risco || t.queixa || sinaisVitais(t);
    equipe.autor(t.reg?.criado?.por, 'Triagem / classificação de risco');
    regsEntrada.push(registro({ icone: 'vital_signs', titulo: 'Triagem — classificação de risco', quando: t.reg?.criado ? fmtDataHora(t.reg.criado.em) : '',
      corpo: temTriagem
        ? camposDoc([
            r && campoDoc('Classificação de risco', `<span class="risco" style="--cor:${r.cor}"><i></i>${esc(r.nome)} (${esc(r.label)})</span>`, { html: true }),
            campoDoc('Alergias', t.alergias?.length ? t.alergias.join(', ') : 'Nenhuma registrada'),
          ]) + sinaisVitais(t) + textoLivre('Queixa principal', t.queixa)
        : semRegistro('Triagem não registrada no sistema.'),
      rodape: temTriagem ? autoriaBloco(t.reg) : '' }));
  }

  if (etapas.includes('consulta')) {
    const temConsulta = c.medico || c.diagnostico || c.plano;
    equipe.autor(c.reg?.criado?.por, 'Consulta médica');
    equipe.responsavel(c.medicoId ?? null, c.medico, 'Consulta médica');
    const receita = c.prescricao?.length && c.receitaTipo ? `Receita ${c.receitaTipo === 'controle' ? 'de controle especial' : 'simples'}` : '';
    regsEntrada.push(registro({ icone: 'stethoscope', titulo: 'Consulta médica', quando: c.reg?.criado ? fmtDataHora(c.reg.criado.em) : '',
      corpo: temConsulta
        ? camposDoc([
            campoDoc('Médico responsável', c.medico),
            campoDoc('Encaminhamento', a.origem === 'transferencia'
              ? `${ENCAMINHAMENTOS[c.encaminhamento] || TRANSF_LABELS[a.destinoTransf] || ''} (destino da transferência)` : ENCAMINHAMENTOS[c.encaminhamento]),
          ]) + textoLivre('Diagnóstico / hipótese diagnóstica', c.diagnostico) + textoLivre('Plano de cuidado', c.plano)
          + subtitulo('Prescrição de medicamentos', tabela(['Medicamento', 'Posologia'], (c.prescricao || []).map(p => [p.med, p.pos || '—'])))
          + subtitulo('Exames solicitados', tabela(['Exame', 'Observação'], (c.exames || []).map(e => [e.exame, e.obs || '—'])))
          + camposDoc([campoDoc('Receita', receita), c.atestadoDias && campoDoc('Atestado', `${c.atestadoDias} dia(s) a partir de ${fmtData(c.atestadoInicio || a.data)}`)])
          + textoLivre('Orientações da receita', c.receitaObs) + textoLivre('Observações do atestado', c.atestadoObs)
        : semRegistro('Consulta não registrada no sistema.'),
      rodape: temConsulta ? autoriaBloco(c.reg) : '' }));
  }

  if (etapas.includes('exames')) {
    const ex = a.exames || {};
    equipe.autor(ex.reg?.criado?.por, 'Solicitação de exames (LabSUS)');
    regsEntrada.push(registro({ icone: 'biotech', titulo: 'Exames — envio ao LabSUS', quando: ex.enviadoEm ? fmtDataHora(ex.enviadoEm) : '',
      corpo: tabela(['Exame', 'Observação'], (ex.solicitacoes || []).map(e => [e.exame, e.obs || '—'])) || semRegistro('Nenhum exame registrado.'),
      rodape: ex.enviadoEm ? autoriaBloco(ex.reg) : '' }));
  }
  if (etapas.includes('telemedicina')) {
    const tm = a.telemedicina || {};
    equipe.autor(tm.reg?.criado?.por, 'Telemedicina');
    regsEntrada.push(registro({ icone: 'video_call', titulo: 'Telemedicina', quando: tm.registradoEm ? fmtDataHora(tm.registradoEm) : '',
      corpo: tm.registradoEm ? '' : semRegistro('Telemedicina não registrada.'), rodape: tm.registradoEm ? autoriaBloco(tm.reg) : '' }));
  }
  partes.push(secao(++n, 'how_to_reg', 'Entrada e atendimento inicial', `<div class="linha-tempo">${regsEntrada.join('')}</div>`));

  // ===== Observação ambulatorial (quando o paciente passou por ela) =====
  if (c.encaminhamento === 'ambulatorio' && isConcluido(a)) {
    const obs = o || {};
    const linhasCk = (c.prescricao || []).map((p, k) => {
      const st = situacaoCheckin(obs.checkins?.[k], 'Administrado');
      if (st.gravado) equipe.autor(st.por, 'Administração de medicamentos (observação)');
      return [esc(p.med), esc(p.pos || '—'), st.html, responsavelCheckin(st)];
    });
    (obs.procedimentos || []).forEach(p => equipe.autor(p.por, 'Procedimentos (observação)'));
    const regsObs = (obs.anotacoes || []).map(nt => {
      equipe.autor(nt.por, 'Anotação de enfermagem (observação)');
      return { em: nt.em, html: registro({ icone: 'edit_note', tipo: 'Enfermagem', classe: 'enf', titulo: 'Anotação de enfermagem', quando: fmtDataHora(nt.em),
        corpo: `<p class="anot">${esc(nt.texto)}</p>`, rodape: autoriaLinha(nt.por, nt.por ? nt.em : '') }) };
    });
    if (obs.encaminhamento) {
      equipe.autor(obs.encaminhadoPor, 'Encaminhamento da observação');
      const alta = obs.encaminhamento === 'alta';
      regsObs.push({ em: obs.encaminhadoEm, html: registro({ icone: alta ? 'directions_walk' : 'king_bed', classe: alta ? 'ok' : '',
        titulo: alta ? 'Alta da observação' : 'Encaminhado para internação', quando: fmtDataHora(obs.encaminhadoEm),
        rodape: autoriaLinha(obs.encaminhadoPor, obs.encaminhadoPor ? obs.encaminhadoEm : '') }) });
    }
    regsObs.sort((x, y) => (x.em || '').localeCompare(y.em || ''));
    partes.push(secao(++n, 'visibility', 'Observação ambulatorial',
      subtitulo('Medicamentos prescritos na consulta — administração', tabela(['Medicamento', 'Posologia', 'Situação', 'Responsável pelo registro'], linhasCk, { html: [0, 1, 2, 3] })
        || semRegistro('Nenhum medicamento prescrito na consulta.'))
      + subtitulo('Procedimentos realizados', tabela(['Procedimento', 'Hora', 'Responsável pelo registro'],
          (obs.procedimentos || []).map(p => [esc(p.proc), esc(p.hora || '—'), quemQuando(p.por, p.em)]), { html: [0, 1, 2] }))
      + (regsObs.length ? subtitulo('Anotações e encaminhamento', `<div class="linha-tempo">${regsObs.map(x => x.html).join('')}</div>`)
        : semRegistro('Nenhuma anotação ou encaminhamento registrado na observação.'))));
  }

  // ===== Internação =====
  const encaminhadoInternacao = (isConcluido(a) && c.encaminhamento === 'enfermaria') || o?.encaminhamento === 'internacao';
  if (encaminhadoInternacao && !adm) partes.push(secao(++n, 'home_health', 'Internação', semRegistro('Admissão não registrada no sistema.')));
  if (encaminhadoInternacao && adm) {
    const cpAdm = adm.campos || {};
    equipe.autor(adm.reg?.criado?.por, 'Admissão de enfermagem');
    (adm.reg?.alteracoes || []).forEach(x => equipe.autor(x.por, 'Alteração da admissão'));

    // grupos da admissão: só o que foi marcado ou preenchido
    const conhecidos = new Set(['anotacao']);
    const grupos = CAMPOS_ADMISSAO.filter(g => g.campos[0][0] !== 'anotacao').map(g => {
      g.campos.forEach(([nome]) => conhecidos.add(nome));
      const itens = g.campos.filter(([nome]) => cpAdm[nome] !== undefined && cpAdm[nome] !== '' && cpAdm[nome] !== false)
        .map(([nome, rotulo, opcoes]) => campoDoc(rotulo, cpAdm[nome] === true ? 'Sim' : (opcoes?.[cpAdm[nome]] || cpAdm[nome])));
      return itens.length ? subtitulo(g.titulo, camposDoc(itens)) : '';
    }).join('');
    const exameFisico = Object.entries(REGIOES).map(([key, r]) => {
      conhecidos.add(`ef_${key}_obs`);
      const achados = r.grupos.map(gr => {
        const marcados = gr.campos.filter(cp => { conhecidos.add(`ef_${key}_${cp.nome}`); return cpAdm[`ef_${key}_${cp.nome}`]; }).map(cp =>
          cp.tipo === 'check' ? cp.label : `${cp.label}: ${cp.opcoes.find(op => slug(op) === cpAdm[`ef_${key}_${cp.nome}`]) || cpAdm[`ef_${key}_${cp.nome}`]}`);
        return marcados.length ? `${gr.titulo}: ${marcados.join('; ')}` : '';
      }).filter(Boolean);
      if (cpAdm[`ef_${key}_obs`]) achados.push(`Observações: ${cpAdm[`ef_${key}_obs`]}`);
      return achados.length ? textoLivre(r.titulo, achados.join('\n')) : '';
    }).join('');
    // campo gravado que não está no formulário atual também sai no documento
    const outros = Object.entries(cpAdm).filter(([k, v]) => !conhecidos.has(k) && v !== '' && v !== false).map(([k, v]) => campoDoc(k, v === true ? 'Sim' : v));

    const ckMed = (c.prescricao || []).map((p, k) => {
      const st = situacaoCheckin(adm.checkinsMed?.[k], 'Administrado');
      if (st.gravado) equipe.autor(st.por, 'Administração de medicamentos (admissão)');
      return [esc(p.med), esc(p.pos || '—'), st.html, responsavelCheckin(st)];
    });
    const ckExa = (c.exames || []).map((e, k) => {
      const st = situacaoCheckin(adm.checkinsExame?.[k], 'Coletado');
      if (st.gravado) equipe.autor(st.por, 'Coleta de exames (admissão)');
      return [esc(e.exame), st.html, responsavelCheckin(st)];
    });

    partes.push(secao(++n, 'home_health', 'Internação — admissão de enfermagem',
      camposDoc([
        campoDoc('Data/hora da admissão', fmtDataHora(adm.em || adm.salvaEm)),
        campoDoc('Leito', leitoLabel(adm.leito)),
        campoDoc('Caráter da internação', adm.carater ? `${adm.carater} — ${CARATER_INTERNACAO[adm.carater] || ''}` : ''),
        campoDoc('Diagnóstico principal (consulta)', c.diagnostico, { largo: true }),
      ])
      + subtitulo('Medicamentos prescritos na consulta — check-in na admissão', tabela(['Medicamento', 'Posologia', 'Situação', 'Responsável pelo registro'], ckMed, { html: [0, 1, 2, 3] }))
      + subtitulo('Exames solicitados na consulta — coleta na admissão', tabela(['Exame', 'Situação', 'Responsável pelo registro'], ckExa, { html: [0, 1, 2] }))
      + grupos
      + subtitulo('Exame físico', exameFisico)
      + subtitulo('Procedimentos', tabela(['Procedimento', 'Hora'], (adm.procedimentos || []).map(p => [p.proc, p.hora || '—'])))
      + subtitulo('Outros registros da admissão', camposDoc(outros))
      + textoLivre('Anotação de enfermagem da admissão', cpAdm.anotacao)
      + (Object.keys(cpAdm).length ? '' : semRegistro('Nenhum dado de anamnese ou exame físico registrado na admissão.'))
      + autoriaBloco(adm.reg)));

    // ----- aprazamento -----
    const prescricoes = [...(c.prescricao || []), ...evolucoesValidas(int.evolucoesMed).flatMap(e => e.prescricao || [])];
    const aprazLinhas = Object.entries(int.aprazamentos || {}).map(([med, ap]) => {
      equipe.autor(ap.por, 'Aprazamento de medicamentos');
      const pos = prescricoes.find(p => p.med === med)?.pos || '—';
      const intervalo = APRAZAMENTO[ap.intervalo]?.label || APRAZ_ESPECIAIS[ap.intervalo] || 'Sem intervalo definido';
      const horarios = APRAZAMENTO[ap.intervalo] && ap.inicio != null ? horariosAprazamento(ap.intervalo, ap.inicio).map(fmtHorario).join(' · ') : '—';
      const quem = ap.por ? `${identificacao(ap.por)}${ap.em ? `<br><small>${esc(fmtDataHora(ap.em))}${ap.padrao ? ' · padrão da tabela' : ''}</small>` : ''}` : '<em class="nao-inf">Não gravado</em>';
      return [esc(med), esc(pos), esc(intervalo), esc(horarios), quem];
    });
    if (aprazLinhas.length) {
      partes.push(secao(++n, 'schedule', 'Aprazamento de medicamentos',
        tabela(['Medicamento', 'Posologia prescrita', 'Intervalo', 'Horários', 'Definido por'], aprazLinhas, { html: [0, 1, 2, 3, 4] })));
    }

    // ----- evolução diária (enfermagem, médica e permanências intercaladas) -----
    const diaAdm = (adm.em || adm.salvaEm).slice(0, 10);
    const evolucoes = [
      ...(int.evolucoesEnf || []).map((e, k) => ({ ...e, tipo: 'enf', n: k + 1 })),
      ...(int.evolucoesMed || []).map((e, k) => ({ ...e, tipo: 'med', n: k + 1 })),
      ...(int.permanencias || []).map(p => ({ ...p, tipo: 'perm' })),
    ].sort((x, y) => x.em.localeCompare(y.em));
    // registro feito depois do horário informado (lançamento tardio) fica explícito
    const lancamento = e => (e.salvoEm && e.salvoEm.slice(0, 16) !== e.em.slice(0, 16)
      ? `<div class="autoria lanc">${ic('history')} <span>Lançado no sistema em ${esc(fmtDataHora(e.salvoEm))}</span></div>` : '');
    // retificações (quem, quando, motivo e o que mudou) e exclusão: a evolução nunca some do prontuário
    const historicoEvo = (e, nome) => {
      const r = e.retificacoes || [];
      const retif = r.map((x, i) => {
        equipe.autor(x.por, `Retificação de ${nome}`);
        const difs = diferencasEvolucao(x.anterior, r[i + 1]?.anterior || e, e.tipo);
        return `<div class="autoria retif">${ic('edit_note')} <span>Retificado por ${x.por ? identificacao(x.por) : SEM_AUTORIA} — em ${esc(fmtDataHora(x.em))}${x.motivo ? ` — motivo: ${esc(x.motivo)}` : ''}</span></div>`
          + tabela(['Campo alterado', 'Registro anterior', 'Registro retificado'], difs.map(([l, antes, depois]) => [l, antes || '—', depois || '—']));
      }).join('');
      if (!e.anulada) return retif;
      equipe.autor(e.anulada.por, `Exclusão de ${nome}`);
      return retif + `<div class="autoria anul">${ic('delete')} <span>Evolução excluída por ${e.anulada.por ? identificacao(e.anulada.por) : SEM_AUTORIA} — em ${esc(fmtDataHora(e.anulada.em))} — motivo: ${esc(e.anulada.motivo || '')}</span></div>`;
    };
    const tituloEvo = (nome, e) => `${nome} nº ${e.n}${e.anulada ? ' — EXCLUÍDA' : e.retificacoes?.length ? ' — retificada' : ''}`;
    const htmlEvo = e => {
      if (e.tipo === 'enf') {
        equipe.autor(e.por, 'Evolução de enfermagem');
        equipe.responsavel(e.profissionalId ?? null, e.profissional, 'Evolução de enfermagem');
        const estado = Object.entries(ESTADO_ENF).filter(([k]) => e.estado?.[k]).map(([, l]) => l).join(', ');
        return registro({ icone: 'medical_services', tipo: 'Enfermagem', classe: `enf${e.anulada ? ' anulada' : ''}`, titulo: tituloEvo('Evolução de enfermagem', e), quando: e.em.slice(11, 16),
          corpo: camposDoc([campoDoc('Profissional responsável', e.profissional), campoDoc('Acompanhamento', ACOMP_LABELS[e.acompanhamento]), campoDoc('Estado do paciente', estado)])
            + sinaisVitais(e.ssvv)
            + subtitulo('Medicamentos administrados', tabela(['Medicamento', 'Dose aprazada', 'Hora do registro'],
                (e.administracoes || []).map(d => [d.med, doseLabel(d.horario), d.registradoEm || '—'])))
            + camposDoc([campoDoc('Exames coletados', (e.examesColetados || []).join(', '))])
            + textoLivre('Anotação de enfermagem', e.anotacao),
          rodape: autoriaLinha(e.por, e.por ? e.salvoEm || e.em : '') + lancamento(e) + historicoEvo(e, 'evolução de enfermagem') });
      }
      if (e.tipo === 'med') {
        equipe.autor(e.por, 'Evolução médica');
        equipe.responsavel(e.medicoId ?? null, e.medico, 'Evolução médica');
        return registro({ icone: 'stethoscope', tipo: 'Médica', classe: `med${e.anulada ? ' anulada' : ''}`, titulo: tituloEvo('Evolução médica', e), quando: e.em.slice(11, 16),
          corpo: camposDoc([campoDoc('Médico responsável', e.medico)]) + sinaisVitais(e.ssvv)
            + textoLivre('Hipótese diagnóstica', e.diagnostico) + textoLivre('Estado do paciente', e.estadoPaciente)
            + textoLivre('Plano de cuidado', e.plano) + textoLivre('Anotações', e.anotacoes)
            + subtitulo('Prescrição', tabela(['Medicamento', 'Posologia'], (e.prescricao || []).map(p => [p.med, p.pos || '—'])))
            + subtitulo('Exames solicitados', tabela(['Exame', 'Observação'], (e.exames || []).map(x => [x.exame, x.obs || '—']))),
          rodape: autoriaLinha(e.por, e.por ? e.salvoEm || e.em : '') + lancamento(e) + historicoEvo(e, 'evolução médica') });
      }
      equipe.autor(e.por, 'Permanência');
      equipe.responsavel(e.medicoId ?? null, e.medico, 'Permanência');
      return registro({ icone: 'push_pin', tipo: 'Permanência', classe: 'perm', titulo: `${e.motivo} — ${motivoLabel(e.motivo)}`, quando: e.em.slice(11, 16),
        corpo: camposDoc([campoDoc('Médico responsável', e.medico),
          e.cid && campoDoc('CID-10', `${SUS.fmtCid(e.cid)} — ${e.cidDescricao || ''}`), e.procCodigo && campoDoc('Procedimento SUS', `${SUS.fmtProc(e.procCodigo)} — ${e.procDescricao || ''}`)]),
        rodape: autoriaLinha(e.por, e.por ? e.em : '') });
    };
    const porDia = evolucoes.reduce((m, e) => { const d = e.em.slice(0, 10); (m[d] = m[d] || []).push(e); return m; }, {});
    const diasHtml = Object.entries(porDia).map(([dia, lista]) => {
      const nDia = Math.round((new Date(dia + 'T12:00') - new Date(diaAdm + 'T12:00')) / 86400000) + 1;
      return `<div class="dia"><div class="dia-cab">${ic('calendar_today')} ${fmtData(dia)} · ${DIAS_SEMANA[new Date(dia + 'T12:00').getDay()]}<span>${nDia >= 1 ? `${nDia}º dia de internação` : 'antes da admissão'}</span></div>
        <div class="linha-tempo">${lista.map(htmlEvo).join('')}</div></div>`;
    }).join('');
    const nEnf = evolucoesValidas(int.evolucoesEnf).length, nMed = evolucoesValidas(int.evolucoesMed).length;
    const nExc = [...(int.evolucoesEnf || []), ...(int.evolucoesMed || [])].filter(e => e.anulada).length;
    partes.push(secao(++n, 'clinical_notes', 'Evolução diária',
      diasHtml || semRegistro('Nenhuma evolução registrada durante a internação.'),
      `${nEnf} de enfermagem · ${nMed} médica${nMed === 1 ? '' : 's'}${nExc ? ` · ${nExc} excluída${nExc > 1 ? 's' : ''}` : ''}`));

    // ----- saída -----
    if (s) {
      equipe.autor(s.por, 'Saída da internação');
      equipe.responsavel(s.medicoId ?? null, s.medico, 'Saída da internação');
      const seloTipo = { alta: 'ok', obito: 'erro', transferencia: 'info', encerramento: 'neutro' }[tipoSaida(s.motivo)];
      partes.push(secao(++n, 'logout', 'Saída da internação',
        camposDoc([
          campoDoc('Data/hora da saída', fmtDataHora(s.em)),
          campoDoc('Motivo', `<span class="selo ${seloTipo}">${esc(s.motivo)} — ${esc(motivoLabel(s.motivo))}</span>`, { html: true, largo: true }),
          campoDoc('Médico responsável', s.medico),
          campoDoc('Tempo de internação', duracao(adm.em || adm.salvaEm, s.em)),
          campoDoc('CID-10 principal', s.cid ? `${SUS.fmtCid(s.cid)} — ${s.cidDescricao || ''}` : '', { sempre: true, largo: true }),
          campoDoc('Procedimento SUS realizado', s.procCodigo ? `${SUS.fmtProc(s.procCodigo)} — ${s.procDescricao || ''}` : '', { sempre: true, largo: true }),
        ]) + autoriaLinha(s.por, s.por ? s.em : '')));
    }
  }

  // ===== Profissionais e assinaturas =====
  const lista = equipe.lista();
  partes.push(secao(++n, 'draw', 'Profissionais responsáveis pelos registros',
    (lista.length ? tabela(['Profissional', 'Conselho', 'Atuação neste atendimento', 'Assinatura'],
      lista.map(p => [`<strong>${esc(p.nome)}</strong>${p.cargo ? `<br><small>${esc(p.cargo)}</small>` : ''}`, esc(p.conselho || '—'),
        esc([...p.atuacoes].join('; ')), '<span class="linha-ass"></span>']), { html: [0, 1, 2, 3] })
      : semRegistro('Nenhum profissional identificado nos registros.'))
    + `<p class="nota">A identificação de cada profissional foi gravada pelo sistema no momento do registro. A cópia impressa deve ser
       assinada pelos profissionais acima (Res. CFM 1.638/2002, art. 5º; Res. COFEN 429/2012).</p>`));

  return `<article class="prontuario">
    <table class="folha">
      <thead><tr><td>
        <div class="topo">
          ${cabecalhoHospital()}
          <div class="doc-id"><strong>Prontuário do paciente</strong><span>Atendimento nº ${a.id}${i.prontuario ? ` · Prontuário nº ${esc(i.prontuario)}` : ''}</span></div>
        </div>
        <div class="faixa-pac">
          <strong>${esc(a.nome)}</strong>
          <span>${i.nasc ? `Nasc. ${fmtData(i.nasc)}${idade !== null ? ` (${idade} anos)` : ''}` : 'Nasc. não informado'}</span>
          <span>${esc(SEXOS[i.sexo] || 'Sexo não informado')}</span>
          <span>CNS ${esc(i.cns || 'não informado')}</span>
          <span>Mãe: ${esc(i.mae || 'não informado')}</span>
        </div>
      </td></tr></thead>
      <tbody><tr><td>${partes.join('')}</td></tr></tbody>
      <tfoot><tr><td>
        <div class="rodape">
          <span>${ic('lock')} Documento sigiloso, protegido pelo sigilo profissional. Reproduz os registros do sistema H-SUS; campos não preenchidos não são exibidos.</span>
          <span>${esc(emissao)}</span>
        </div>
      </td></tr></tfoot>
    </table>
  </article>`;
}

// ---------- janela de impressão ----------
const ESTILO_PRONTUARIO = `
  @page { size: A4; margin: 10mm 11mm 12mm;
    @bottom-right { content: "Página " counter(page) " de " counter(pages); font-family: 'DM Sans', sans-serif; font-size: 7.5pt; color: #8a9ab5; } }
  :root { --primary: #3a7bd5; --primary-light: #e8f0fd; --accent: #00c9a7; --danger: #ff6b6b; --text: #2d3748; --muted: #8a9ab5; --border: #e8edf5; --bg: #f4f6fb; --navy: #1a2540; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'DM Sans', Arial, sans-serif; color: var(--text); font-size: 9.6pt; line-height: 1.45; margin: 0; background: var(--bg); }
  .ms { font-family: 'Material Symbols Outlined'; font-weight: normal; font-style: normal; font-size: 1.15em; line-height: 1; vertical-align: -.2em;
        display: inline-block; letter-spacing: normal; text-transform: none; white-space: nowrap; direction: ltr; font-feature-settings: 'liga'; }

  /* barra de ações (só na tela) */
  .barra { position: sticky; top: 0; z-index: 5; background: var(--navy); color: #fff; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 10pt; }
  .barra button { display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, var(--primary), #5a9bf5); color: #fff; border: 0; border-radius: 10px;
                  padding: 8px 16px; font: 700 10pt 'DM Sans', sans-serif; cursor: pointer; white-space: nowrap; }
  main { max-width: 210mm; margin: 0 auto; padding: 18px 0 40px; }
  article.prontuario, .indice { background: #fff; padding: 12mm 11mm; margin-bottom: 18px; border-radius: 6px; box-shadow: 0 4px 24px rgba(58,123,213,.12); }
  article.prontuario + article.prontuario, .indice + article.prontuario { break-before: page; }

  /* folha: cabeçalho (com o nome do paciente) e rodapé repetem em cada página impressa */
  table.folha { width: 100%; border-collapse: collapse; }
  table.folha > thead > tr > td, table.folha > tbody > tr > td, table.folha > tfoot > tr > td { padding: 0; border: 0; }
  .topo { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 2.5px solid var(--primary); }
  .hosp { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .hosp img { height: 34px; }
  .hosp-dados strong { display: block; font-size: 11pt; color: var(--navy); }
  .hosp-dados small { display: block; color: var(--muted); font-size: 7.6pt; }
  .doc-id { text-align: right; flex-shrink: 0; }
  .doc-id strong { display: block; font-size: 12pt; letter-spacing: .6px; text-transform: uppercase; color: var(--primary); }
  .doc-id span { font-size: 8pt; color: var(--muted); font-weight: 600; }
  .faixa-pac { display: flex; flex-wrap: wrap; gap: 3px 14px; align-items: baseline; background: var(--primary-light); border-radius: 8px; padding: 6px 10px; margin: 8px 0 12px; font-size: 8.4pt; }
  .faixa-pac strong { font-size: 10pt; color: var(--navy); margin-right: 2px; }
  .faixa-pac span { color: #4a5a78; }
  .rodape { display: flex; justify-content: space-between; gap: 14px; border-top: 1px solid var(--border); margin-top: 12px; padding-top: 6px; font-size: 7.4pt; color: var(--muted); }
  .rodape span:last-child { text-align: right; flex-shrink: 0; max-width: 45%; }

  /* seções */
  .sec { margin-bottom: 14px; }
  .sec h2 { display: flex; align-items: center; gap: 8px; font-size: 10.5pt; color: var(--navy); margin: 0 0 8px; break-after: avoid; }
  .sec-ic { width: 26px; height: 26px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sec-n { color: var(--primary); }
  .sec-extra { margin-left: auto; font-size: 8pt; font-weight: 600; color: var(--muted); }
  .sec-corpo { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; }
  h4 { font-size: 8.2pt; text-transform: uppercase; letter-spacing: .4px; color: var(--primary); margin: 10px 0 5px; break-after: avoid; }

  /* campos */
  .cps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 16px; margin: 2px 0 6px; }
  .cp { min-width: 0; break-inside: avoid; }
  .cp.largo { grid-column: span 2; }
  .cp > span, .tx > span { display: block; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
  .cp > div { font-weight: 600; overflow-wrap: anywhere; }
  .tx { margin: 5px 0; break-inside: avoid; }
  .tx p { margin: 1px 0 0; white-space: pre-wrap; }
  .nao-inf { color: #a0aec0; font-weight: 500; font-style: italic; }
  .svs { display: flex; flex-wrap: wrap; gap: 4px; margin: 4px 0 6px; }
  .sv { border: 1px solid var(--border); background: #fafbfe; border-radius: 6px; padding: 1px 7px; font-weight: 600; font-size: 8.6pt; }
  .sv small { color: var(--muted); font-weight: 700; margin-right: 4px; font-size: 7pt; text-transform: uppercase; }
  .risco { display: inline-flex; align-items: center; gap: 6px; }
  .risco i { width: 10px; height: 10px; border-radius: 50%; background: var(--cor); display: inline-block; }

  /* resumo */
  .resumo { display: grid; grid-template-columns: repeat(auto-fit, minmax(38mm, 1fr)); gap: 8px; margin-bottom: 8px; }
  .res { display: flex; gap: 8px; align-items: flex-start; border: 1px solid var(--border); border-top: 3px solid var(--primary); border-radius: 8px; padding: 7px 9px; break-inside: avoid; }
  .res.res-alta { border-top-color: var(--accent); } .res.res-obito { border-top-color: var(--danger); } .res.res-transferencia { border-top-color: #a78bfa; }
  .res-ic { color: var(--primary); }
  .res small { display: block; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); }
  .res strong { display: block; font-size: 9pt; }
  .res em { display: block; font-style: normal; font-size: 7.8pt; color: #4a5a78; }

  /* linha do tempo de registros */
  .reg { display: flex; gap: 10px; position: relative; padding-bottom: 10px; break-inside: avoid; }
  .reg:not(:last-child)::before { content: ''; position: absolute; left: 12px; top: 26px; bottom: 0; width: 2px; background: var(--border); }
  .reg-dot { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; }
  .reg.enf .reg-dot, .reg.ok .reg-dot { background: rgba(0,201,167,.13); color: #00a688; }
  .reg.perm .reg-dot { background: rgba(255,217,61,.25); color: #8a6500; }
  .reg-corpo { flex: 1; min-width: 0; padding-top: 3px; }
  .reg-cab { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; font-size: 9.6pt; }
  .reg-cab > span { display: inline-flex; align-items: center; gap: 6px; }
  .reg-quando { font-size: 8.4pt; font-weight: 700; color: var(--muted); white-space: nowrap; }
  .tag { font-size: 6.8pt; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; border-radius: 20px; padding: 1px 7px; background: var(--primary-light); color: var(--primary); }
  .tag.enf { background: rgba(0,201,167,.13); color: #00a688; } .tag.perm { background: rgba(255,217,61,.25); color: #8a6500; }
  .anot { margin: 0; white-space: pre-wrap; }
  .dia { margin-bottom: 6px; }
  .dia-cab { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 9pt; color: var(--navy); background: var(--bg); border-radius: 6px; padding: 4px 8px; margin: 2px 0 8px; break-after: avoid; }
  .dia-cab span { margin-left: auto; color: var(--muted); font-size: 8pt; }

  /* autoria */
  .autoria { display: flex; gap: 5px; align-items: baseline; font-size: 7.8pt; color: #4a5a78; background: #fafbfe; border-left: 2px solid var(--primary); border-radius: 0 6px 6px 0; padding: 3px 8px; margin-top: 4px; break-inside: avoid; }
  .autoria .ms { color: var(--primary); }
  .autoria.sem { border-left-color: #f0b400; color: #8a6500; background: rgba(255,217,61,.12); }
  .autoria.sem .ms { color: #c79100; }
  .autoria.lanc { border-left-color: var(--muted); }
  .autoria.lanc .ms { color: var(--muted); }
  .autoria.retif { border-left-color: #f0b400; }
  .autoria.retif .ms { color: #c79100; }
  .autoria.anul { border-left-color: #e04545; color: #b02a2a; background: rgba(255,107,107,.08); font-weight: 700; }
  .autoria.anul .ms { color: #e04545; }
  .reg.anulada > .reg-corpo > :not(.autoria):not(.reg-cab) { opacity: .55; }
  .reg.anulada .reg-cab strong { color: #b02a2a; }
  .sem-reg { color: var(--muted); font-style: italic; margin: 2px 0; }

  /* tabelas e selos */
  table:not(.folha) { width: 100%; border-collapse: collapse; margin: 2px 0 8px; font-size: 8.6pt; }
  table:not(.folha) th { background: var(--bg); color: #4a5a78; font-size: 7pt; text-transform: uppercase; letter-spacing: .4px; text-align: left; padding: 4px 7px; border-bottom: 1px solid var(--border); }
  table:not(.folha) td { padding: 4px 7px; border-bottom: 1px solid var(--border); vertical-align: top; }
  table:not(.folha) tr { break-inside: avoid; }
  td small { color: var(--muted); }
  .selo { display: inline-flex; padding: 1px 8px; border-radius: 20px; font-size: 7.6pt; font-weight: 700; white-space: nowrap; }
  .selo.ok { background: rgba(0,201,167,.13); color: #00a688; } .selo.neutro { background: #eef1f6; color: var(--muted); }
  .selo.alerta { background: rgba(255,217,61,.25); color: #8a6500; } .selo.erro { background: rgba(255,107,107,.15); color: #e04545; }
  .selo.info { background: var(--primary-light); color: var(--primary); }
  .linha-ass { display: block; border-bottom: 1px solid var(--text); height: 26px; min-width: 42mm; }
  .nota { font-size: 7.8pt; color: var(--muted); margin: 6px 0 0; }

  /* índice do lote */
  .indice .topo { margin-bottom: 12px; }
  .indice h1 { font-size: 15pt; color: var(--navy); margin: 0 0 2px; }
  .indice p { color: var(--muted); margin: 0 0 12px; }

  @media screen and (max-width: 800px) {
    main { padding: 0; } article.prontuario, .indice { padding: 16px; border-radius: 0; }
    .cps { grid-template-columns: 1fr 1fr; } .topo { flex-wrap: wrap; } .doc-id { text-align: left; }
  }
  @media print {
    body { background: #fff; }
    .barra { display: none; }
    main { max-width: none; padding: 0; }
    article.prontuario, .indice { padding: 0; margin: 0; box-shadow: none; border-radius: 0; }
  }
`;

// abre um ou vários prontuários num documento só (com índice quando há mais de um)
function abrirProntuarios(lista, { titulo, subtitulo } = {}) {
  if (!lista.length) { showToast('⚠️ Nenhum atendimento para gerar o prontuário'); return; }
  const w = window.open('', '_blank');
  if (!w) { showToast('⚠️ Libere os pop-ups para gerar o documento'); return; }
  const autor = autorAtual();
  const emissao = `Emitido em ${fmtDataHora(agora())}${autor ? ` por ${autor.nome}${autor.conselho ? ' (' + autor.conselho + ')' : ''}` : ''}`;
  const indice = lista.length > 1 ? `<section class="indice">
      <div class="topo">${cabecalhoHospital()}<div class="doc-id"><strong>Índice</strong><span>${lista.length} prontuários</span></div></div>
      <h1>${esc(titulo || 'Prontuários')}</h1>
      <p>${esc([subtitulo, emissao].filter(Boolean).join(' · '))}</p>
      ${tabela(['Nº', 'Paciente', 'CNS', 'Entrada', 'Saída', 'Motivo da saída'], lista.map(a => [a.id, a.nome, a.ident?.cns || '—', fmtDataHora(`${a.data}T${a.hora}`),
        a.internacao?.saida ? fmtDataHora(a.internacao.saida.em) : '—', a.internacao?.saida ? motivoLabel(a.internacao.saida.motivo) : '—']))}
    </section>` : '';
  w.document.write(`<!DOCTYPE html><html lang="pt-br"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(lista.length > 1 ? titulo || 'Prontuários' : `Prontuário — ${lista[0].nome}`)}</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200">
    <style>${ESTILO_PRONTUARIO}</style></head><body>
    <div class="barra"><span>${lista.length > 1 ? `${lista.length} prontuários` : esc(lista[0].nome)} · ${esc(emissao)}</span>
      <button onclick="window.print()"><span class="ms">print</span> Imprimir / salvar PDF</button></div>
    <main>${indice}${lista.map(a => prontuarioHtml(a, emissao)).join('')}</main>
    <script>
      // imprime depois que as fontes (texto e ícones) carregarem, para o PDF sair com o visual certo
      window.addEventListener('load', () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(() => window.print(), 250)));
    <\/script>
    </body></html>`);
  w.document.close();
}
