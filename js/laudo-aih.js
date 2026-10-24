// Laudo para Solicitação de Autorização de Internação Hospitalar (AIH) para impressão (ou "Salvar como PDF").
// Reproduz o formulário oficial em SVG, com as mesmas posições (em pontos, página A4 de 595,28 × 841,89) e fonte do modelo.
// Usa: clinbot.js e sus/sus.js.

const AIH_FONTES = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/';
const AIH_CINZA = '#808080';   // contorno das caixas
const AIH_VALOR = '#555555';   // texto preenchido

// clínica (campo 37), deduzida da ala e do procedimento SUS realizado
const CLINICAS_AIH = { '01': 'Cirúrgica', '02': 'Obstétrica', '03': 'Clínica Médica', '07': 'Pediatria' };
function clinicaAih(a) {
  const adm = a.internacao?.admissao || {};
  const proc = a.internacao?.saida?.procCodigo || '';
  const ala = enfermarias()[(adm.leito || '').split('-')[0]];
  let cod = '03';
  if (ala?.publico === 'pediatrico') cod = '07';
  else if (proc.startsWith('0310') || proc.startsWith('0411')) cod = '02';
  else if (proc.startsWith('04')) cod = '01';
  return `${cod} - ${CLINICAS_AIH[cod]}`;
}

// médico que solicitou a internação: quem encaminhou da observação (se médico) ou o da consulta
function solicitanteAih(a) {
  const enc = a.observacao?.encaminhamento === 'internacao' ? a.observacao.encaminhadoPor : null;
  const pEnc = enc?.id != null ? Profissionais.get(enc.id) : null;
  if (pEnc?.nivel === 'medico') return pEnc;
  const c = a.consulta || {};
  const p = c.medicoId != null ? Profissionais.get(c.medicoId) : null;
  if (p) return p;
  return c.medico ? { nome: c.medico.split(' — ')[0], cns: '', cbo: '' } : null;
}

const soDigitos = v => (v || '').replace(/\D/g, '');

// valores do laudo a partir do que foi registrado no atendimento
function dadosLaudoAih(a) {
  const h = Hospital.get(), cfg = responsaveisAih();
  const i = a.ident || {}, t = a.triagem || {}, c = a.consulta || {}, int = a.internacao || {};
  const adm = int.admissao || {}, cp = adm.campos || {}, s = int.saida || {};
  const dataInt = (adm.em || adm.salvaEm || '').slice(0, 10);
  const [ala, leito] = (adm.leito || '').split('-');
  const tipoLog = i.tipoLogradouro ? i.tipoLogradouro.charAt(0).toUpperCase() + i.tipoLogradouro.slice(1) : '';

  // documento (17-19): CPF do paciente; senão o documento do acompanhante; senão ignorado
  let docTipo = 'ignorado', titular = '', docNumero = '';
  if (i.cpf) { docTipo = 'cpf'; titular = 'paciente'; docNumero = i.cpf; }
  else if (cp.ac_doc_numero && ['rg', 'cpf'].includes(cp.ac_doc_tipo)) { docTipo = cp.ac_doc_tipo; titular = 'responsavel'; docNumero = cp.ac_doc_numero; }

  // 28: relato, queixa e sinais vitais da triagem (ou da admissão, quando não houve triagem)
  const sv = t.risco ? { temp: t.temp, pa: t.pa, fc: t.fc, spo2: t.spo2 } : { temp: cp.ssvv_temp, pa: cp.ssvv_pa, fc: cp.ssvv_fc, spo2: cp.ssvv_spo2 };
  const sinais = [sv.temp && `Temperatura: ${sv.temp} °C`, sv.pa && `Pressão Arterial: ${sv.pa} mmHg`, sv.fc && `Pulso: ${sv.fc} bpm`, sv.spo2 && `Saturação: ${sv.spo2}%`]
    .filter(Boolean).map(x => `• ${x}`).join(' ');
  const sintomas = [a.relato, t.queixa].filter(Boolean).map(x => x.trim().replace(/[.\s]+$/, '')).join('. ');

  // 30: exames registrados (o sistema não guarda resultados)
  const solicitados = [...(c.exames || []), ...evolucoesValidas(int.evolucoesMed).flatMap(e => e.exames || [])].map(e => e.exame);
  const coletados = [
    ...(c.exames || []).filter((e, k) => adm.checkinsExame?.[k]?.administrado).map(e => e.exame),
    ...evolucoesValidas(int.evolucoesEnf).flatMap(e => e.examesColetados || []),
  ];
  const exames = [solicitados.length && `Exames solicitados: ${[...new Set(solicitados)].join(', ')}.`,
    coletados.length && `Exames coletados: ${[...new Set(coletados)].join(', ')}.`].filter(Boolean).join(' ');

  const med = solicitanteAih(a);
  const fim = s.em ? s.em.slice(0, 10) : '';
  return {
    competencia: fim ? `${fim.slice(5, 7)}/${fim.slice(0, 4)}` : '',
    estabelecimento: h.nome || '', cnes: h.cnes || '',
    nome: a.nome, prontuario: i.prontuario || '', cns: soDigitos(i.cns), nasc: fmtData(i.nasc),
    idade: i.nasc && dataInt ? String(idadeAih(i.nasc, dataInt)) : '', sexo: i.sexo || '', raca: RACAS[i.raca] || '',
    mae: i.mae || '', telefone: i.telefone || '', responsavel: cp.ac_nome || '',
    enfermaria: enfermarias()[ala]?.nome || ala || '', leito: leito ? String(leito).padStart(2, '0') : '',
    docTipo, titular, docNumero,
    endereco: [[tipoLog, i.logradouro].filter(Boolean).join(' '), i.numero, i.bairro].filter(Boolean).join(', '),
    dataInternacao: fmtData(dataInt), dataAlta: fmtData(fim),
    municipio: i.municipio || '', ibge: i.ibge || '', uf: i.uf || '', cep: i.cep || '',
    sintomas, sinais,
    condicoes: [c.diagnostico, c.plano].filter(Boolean).map(x => x.trim().replace(/[.\s]+$/, '')).join('. ') + (c.diagnostico || c.plano ? '.' : ''),
    exames,
    diagnostico: c.diagnostico || '', cid: s.cid || '',
    procDescricao: s.procDescricao || '', procCodigo: s.procCodigo || '',
    clinica: clinicaAih(a), carater: adm.carater ? `${adm.carater} - ${CARATER_INTERNACAO[adm.carater] || ''}` : '',
    dataSolicitacao: fmtData(dataInt), alta: s.motivo ? motivoLabel(s.motivo) : '',
    solicitante: med?.nome || '', solicitanteCns: soDigitos(med?.cns), cbo: med?.cbo || '',
    diretorDoc: cfg.diretorDocTipo === 'cpf' ? cfg.diretorDoc : soDigitos(cfg.diretorDoc),
    // acidentes de trabalho vêm do caráter da internação (03 = no local de trabalho, 04 = no trajeto)
    acidTrabalho: ['03', '04'].includes(adm.carater), acidTipico: adm.carater === '03', acidTrajeto: adm.carater === '04',
    // 61/62: o CNS do autorizador quando cadastrado; senão o CPF
    autorizador: cfg.autorizador, orgao: cfg.orgao,
    autDocTipo: cfg.autCns ? 'cns' : cfg.autCpf ? 'cpf' : '', autDoc: cfg.autCns ? soDigitos(cfg.autCns) : cfg.autCpf || '',
    dataAutorizacao: fmtData(dataInt),
  };
}
function idadeAih(nasc, data) {
  const [y, m, d] = nasc.split('-').map(Number), [ry, rm, rd] = data.split('-').map(Number);
  return ry - y - (rm < m || (rm === m && rd < d) ? 1 : 0);
}

// ---------- desenho do formulário (coordenadas do modelo, em pontos) ----------
function laudoAihSvg(d) {
  const partes = [];
  const txt = (x, y, s, cls, extra = '') => partes.push(`<text x="${x}" y="${y}" class="${cls}"${extra}>${esc(s)}</text>`);
  const caixa = (x, y, w, h) => partes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.6" class="cx"/>`);
  const marca = (x, y, on) => partes.push(`<rect x="${x}" y="${y}" width="6.9" height="6.9" class="ck"/>` +
    (on ? `<path d="M${x} ${y}L${x + 6.9} ${y + 6.9}M${x + 6.9} ${y}L${x} ${y + 6.9}" class="ckx"/>` : ''));
  // campo: rótulo acima da caixa e valor numa linha (comprimido se não couber)
  const campo = (rotulo, x, y, w, valor = '', h = 15.2, lx = x) => {
    txt(lx, +(y - 1.7).toFixed(1), rotulo, 'lb');
    caixa(x, y, w, h);
    if (valor) txt(+(x + 8.3).toFixed(1), +(y + 10.2).toFixed(1), valor, 'vl', ` data-w="${(w - 12).toFixed(1)}"`);
  };
  // campo de várias linhas: texto em HTML dentro da caixa, com a fonte reduzida se precisar
  const bloco = (rotulo, x, y, w, h, html) => {
    txt(x, +(y - 1.7).toFixed(1), rotulo, 'lb');
    caixa(x, y, w, h);
    if (html) partes.push(`<foreignObject x="${x + 7}" y="${y + 2.4}" width="${w - 13}" height="${h - 3.6}"><div xmlns="http://www.w3.org/1999/xhtml" class="multi">${html}</div></foreignObject>`);
  };
  const grupo = (y0, y1) => partes.push(`<rect x="19.2" y="${y0 + 0.8}" width="556.4" height="${(y1 - y0 - 1.6).toFixed(1)}" rx="7" class="gr"/>`);
  const titulo = (s, y, cx) => (cx ? txt(cx, y, s, 'tt', ' text-anchor="middle"') : txt(32.9, y, s, 'tt'));

  // cabeçalho
  txt(19.4, 24.5, `Competência:${d.competencia ? ' ' + d.competencia : ''}`, 'hd');
  txt(284.9, 24.5, 'Via:', 'hd');
  txt(520.1, 24.5, 'Formulário: 1/ 1', 'hd');
  partes.push(`<rect x="12.1" y="27.4" width="571.1" height="782.6" class="borda"/>`);
  partes.push(`<rect x="18.85" y="34.2" width="189.4" height="46.5" class="borda"/>`);
  partes.push(`<image href="${new URL('images/logo-sus-ms.jpg', location.href).href}" x="19.4" y="34.4" width="188.25" height="45.5" preserveAspectRatio="none"/>`);
  partes.push(`<rect x="213.1" y="34.2" width="362.6" height="46.6" class="borda"/>`);
  txt(394.35, 56.7, 'LAUDO PARA SOLICITAÇÃO DE AUTORIZAÇÃO', 'tl', ' text-anchor="middle"');
  txt(394.35, 69.7, 'DE INTERNAÇÃO HOSPITALAR', 'tl', ' text-anchor="middle"');

  // estabelecimento
  titulo('Identificação do Estabelecimento de Saúde', 90.8);
  grupo(93.8, 147.3);
  campo('1 - NOME DO ESTABELECIMENTO SOLICITANTE', 23.9, 103.5, 364.5, d.estabelecimento);
  campo('2 - CNES', 393.7, 103.5, 176.7, d.cnes);
  campo('3 - NOME DO ESTABELECIMENTO EXECUTANTE', 23.9, 128, 364.5, d.estabelecimento);
  campo('4 - CNES', 393.7, 128, 176.7, d.cnes);

  // paciente
  titulo('Identificação do Paciente', 157.6);
  grupo(160.6, 336.6);
  campo('5 - NOME DO PACIENTE', 23.9, 170.3, 364.5, d.nome);
  campo('6 - Nº DO PRONTUÁRIO', 393.7, 170.3, 176.7, d.prontuario);
  campo('7 - CARTÃO NACIONAL DE SAÚDE (CNS)', 23.9, 194.8, 176.7, d.cns);
  campo('8 - DATA DO NASCIMENTO', 205.9, 194.8, 88.4, d.nasc);
  campo('9 - IDADE', 299.5, 194.8, 44.2, d.idade);
  campo('10 - SEXO', 349, 194.8, 127, '', 15.1);
  marca(358.7, 199.3, d.sexo === 'M'); txt(368.6, 204.5, '1 MASCULINO', 'op');
  marca(408.2, 199.3, d.sexo === 'F'); txt(418.1, 204.5, '2 FEMININO', 'op');
  campo('11 - RAÇA/COR', 481.2, 194.8, 88.4, d.raca);
  campo('12 - NOME DA MÃE', 23.9, 219.3, 364.5, d.mae);
  campo('13 - TELEFONE DE CONTATO', 393.7, 219.3, 176.7, d.telefone, 15);
  campo('14 - NOME DO RESPONSAVEL', 23.9, 243.8, 364.5, d.responsavel);
  campo('15 - ENFERMARIA', 393.7, 243.8, 88.4, d.enfermaria);
  campo('16 - LEITO', 487.3, 243.8, 82.8, d.leito);
  campo('17 - TIPO DE DOCUMENTO', 23.9, 268.2, 230.1, '', 15.1);
  [['rg', 33.6, 43.6, 'RG'], ['cpf', 53.9, 63.8, 'CPF'], ['rn', 76.8, 86.8, 'RN'], ['pis', 97.4, 107.3, 'PIS/PASEP'], ['ignorado', 136.6, 146.6, 'IGNORADO']]
    .forEach(([k, xc, xt, l]) => { marca(xc, 272.7, d.docTipo === k); txt(xt, 278, l, 'op'); });
  campo('18 - TITULAR', 259.3, 268.2, 127, '', 15.1);
  marca(269, 272.7, d.titular === 'paciente'); txt(278.9, 278, 'PACIENTE', 'op');
  marca(308.2, 272.7, d.titular === 'responsavel'); txt(318.1, 278, 'RESPONSAVEL', 'op');
  campo('19 - Nº DO DOCUMENTO', 391.6, 268.2, 88.4, d.docNumero);
  campo('20 - SISPRENATAL', 485.2, 268.2, 82.8, '', 15);
  campo('21 - ENDEREÇO (RUA, Nº, BAIRRO)', 23.9, 292.7, 259.6, d.endereco);
  campo('22 - DATA INTERNAÇÃO', 288.7, 292.7, 138.1, d.dataInternacao);
  campo('23 - DATA DE ALTA', 432.1, 292.7, 138.1, d.dataAlta);
  campo('24 - MUNICIPIO DE RESIDENCIA', 23.9, 317.2, 259.6, d.municipio);
  campo('25 - CODIGO IBGE', 288.7, 317.2, 99.4, d.ibge);
  campo('26 - UF', 393.4, 317.2, 88.4, d.uf);
  campo('27 - CEP', 487, 317.2, 82.8, d.cep);

  // justificativa
  titulo('JUSTIFICATIVA DA INTERNAÇÃO', 346.9, 304.95);
  grupo(349.9, 487.8);
  bloco('28 - PRINCIPAIS SINAIS E SINTOMAS CLÍNICOS', 23.9, 359.5, 546.8, 40.4,
    [d.sintomas && `<p>${esc(d.sintomas)}</p>`, d.sinais && `<p class="sv">${esc(d.sinais)}</p>`].filter(Boolean).join(''));
  bloco('29 - CONDIÇÕES QUE JUSTIFICAM A INTERNAÇÃO', 23.9, 409.2, 546.8, 15.2, d.condicoes && `<p>${esc(d.condicoes)}</p>`);
  bloco('30 - PRINCIPAIS RESULTADOS DE PROVAS DIAGNÓSTICAS (RESULTADOS DE EXAMES REALIZADOS)', 23.9, 433.7, 546.8, 25.5, d.exames && `<p>${esc(d.exames)}</p>`);
  campo('31 - DIAGNÓSTICO INICIAL', 23.9, 468.5, 259.6, d.diagnostico);
  campo('32 - CID 10 PRINCIPAL', 288.7, 468.5, 99.4, d.cid);
  campo('33 - CID 10 SECUNDARIO', 393.4, 468.5, 88.4, '', 15);
  campo('34 - CID 10 ASSOCIADO', 487, 468.5, 82.8, '', 15);

  // procedimento
  titulo('PROCEDIMENTO SOLICITADO', 498.1, 304.9);
  grupo(501.1, 628.1);
  campo('35 - DESCRIÇÃO DO PROCEDIMENTO', 23.9, 510.8, 364.5, d.procDescricao);
  campo('36 - CÓDIGO DO PROCEDIMENTO', 393.7, 510.8, 176.7, d.procCodigo);
  campo('37 - CLÍNICA', 23.9, 535.3, 104.9, d.clinica);
  campo('38 - CARÁTER INTERNAÇÃO', 134.1, 535.3, 127, d.carater);
  campo('39 - DATA SOLICITAÇÃO', 266.4, 535.3, 77.3, d.dataSolicitacao);
  campo('40 - ALTA', 349, 535.3, 138.1, d.alta);
  campo('41 - NASCIDO VIVO', 492.3, 535.3, 77.3, '', 15);
  campo('42 - NOME DO PROFISSIONAL SOLICITANTE', 23.9, 559.8, 270.6, d.solicitante);
  campo('43 - CARTÃO NACIONAL DE SAÚDE (CNS)', 299.8, 559.8, 270.6, d.solicitanteCns);
  campo('44 - ASSINATURA E CARIMBO DO PROFISSIONAL (N° REGISTRO DO CONSELHO)', 23.9, 584.3, 364.5, '', 15);
  campo('45 - CBO', 393.7, 584.3, 176.7, d.cbo);
  campo('46 - DOCUMENTO (CNS/CPF) DIRETOR CLINICO', 23.9, 608.8, 364.5, d.diretorDoc);
  campo('47 - ASSINATURA E CARIMBO (REGISTRO DO CONSELHO)', 393.7, 608.8, 176.7, '', 15);

  // causas externas
  titulo('PREENCHER EM CASO DE CAUSAS EXTERNAS (ACIDENTES OU VIOLÊNCIAS)', 638.4, 304.9);
  grupo(641.4, 712.2);
  caixa(23.9, 648.8, 127, 36.8);
  const x = on => (on ? 'X' : ' ');
  txt(32.2, 661.9, `48 - (${x(d.acidTrabalho)}) ACIDENTE DE TRABALHO`, 'ac');
  txt(32.2, 669.4, `49 - (${x(d.acidTipico)}) ACIDENTE TRABALHO TIPICO`, 'ac');
  txt(32.2, 676.9, `50 - (${x(d.acidTrajeto)}) ACIDENTE TRABALHO TRAJETO`, 'ac');
  campo('51 - CNPJ DA SEGURADORA', 156.2, 648.8, 230.1, '', 15);
  campo('52 - Nº DO BILHETE', 392.3, 648.8, 99.4, '', 15);
  campo('53 - SÉRIE', 497.7, 648.8, 71.8, '', 15);
  campo('54 - CNPJ EMPRESA', 156.2, 670.8, 230.1, '', 15);
  campo('55 - CNAE DA EMPRESA', 392.3, 670.8, 99.4, '', 15);
  campo('56 - CBOR', 497.7, 670.8, 71.8, '', 15);
  // no modelo a última opção passa da caixa e sai cortada; aqui as seis foram deslocadas para caberem inteiras
  campo('57 - VINCULO COM A PREVIDÊNCIA', 23.9, 692.9, 546.8);
  [[36.9, 56.6, 'EMPREGADO'], [124, 143.8, 'EMPREGADOR'], [216.2, 236, 'AUTÔNOMO'], [300.3, 320, 'DESEMPREGADO'], [402.4, 422.1, 'APOSENTADO'], [492.6, 512.4, 'NÃO_SEGURADO']]
    .forEach(([xa, xb, l]) => { txt(xa, 703.1, '(', 'vo'); txt(xb, 703.1, `)${l}`, 'vo'); });

  // autorização
  titulo('AUTORIZAÇÃO', 722.5, 306.3);
  grupo(725.5, 803.5);
  campo('58 - NOME DO PROFISSIONAL AUTORIZADOR', 23.9, 735.2, 230.3, d.autorizador);
  campo('59 - CÓDIGO DO ORGÃO AUTORIZADOR', 259.5, 735.2, 127.1, d.orgao, 15);
  campo('60 - Nº AUTORIZAÇÃO DE INTERNAÇÃO HOSPITALAR', 395.3, 735.2, 175.7, '', 63);
  campo('61 - DOCUMENTO', 23.9, 759.7, 127.1);
  marca(33.6, 764.1, d.autDocTipo === 'cns'); txt(43.6, 769.4, 'CNS', 'op');
  marca(57.5, 764.1, d.autDocTipo === 'cpf'); txt(67.4, 769.4, 'CPF', 'op');
  campo('62 - Nº DO DOCUMENTO (CNS/CPF) DO PROFISSIONAL AUTORIZADOR', 156.3, 759.7, 230.3, d.autDoc);
  campo('63 - DATA DA AUTORIZAÇÃO', 23.9, 784.1, 127.1, d.dataAutorizacao);
  campo('64 - ASSINATURA E CARIMBO N° DO REGISTRO DO CONSELHO)', 156.3, 784.1, 230.3, '', 15);

  return `<svg class="aih" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 595.28 841.89" width="210mm" height="297mm">${partes.join('')}</svg>`;
}

// ---------- janela de impressão ----------
const ESTILO_LAUDO_AIH = `
  @font-face { font-family: 'DejaVu Serif Condensed'; src: url('${AIH_FONTES}DejaVuSerifCondensed.ttf') format('truetype'); font-weight: 400; }
  @font-face { font-family: 'DejaVu Serif Condensed'; src: url('${AIH_FONTES}DejaVuSerifCondensed-Bold.ttf') format('truetype'); font-weight: 700; }
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: #f4f6fb; font-family: 'DM Sans', Arial, sans-serif; }
  .barra { position: sticky; top: 0; z-index: 5; background: #1a2540; color: #fff; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 13px; }
  .barra button { background: linear-gradient(135deg, #3a7bd5, #5a9bf5); color: #fff; border: 0; border-radius: 10px; padding: 8px 16px; font: 700 13px 'DM Sans', Arial, sans-serif; cursor: pointer; white-space: nowrap; }
  .avisos { max-width: 210mm; margin: 14px auto 0; background: #fff8db; color: #8a6500; border-radius: 8px; padding: 8px 12px; font-size: 12.5px; }
  main { padding: 18px 0 40px; }
  .folha { width: 210mm; height: 297mm; margin: 0 auto 18px; background: #fff; box-shadow: 0 4px 24px rgba(58,123,213,.12); overflow: hidden; break-after: page; }
  .folha:last-child { break-after: auto; }
  svg.aih { display: block; font-family: 'DejaVu Serif Condensed', 'DejaVu Serif', Georgia, 'Times New Roman', serif; }
  .hd { font-size: 7.5px; fill: #000; }
  .tl { font-size: 9.75px; font-weight: 700; fill: #000; }
  .tt { font-size: 8.25px; font-weight: 700; fill: #000; }
  .lb { font-size: 5.25px; font-weight: 700; fill: #000; }
  .vl { font-size: 7.5px; fill: ${AIH_VALOR}; }
  .op { font-size: 5.25px; fill: ${AIH_VALOR}; }
  .ac { font-size: 5.25px; fill: #000; }
  .vo { font-size: 7.5px; fill: ${AIH_VALOR}; }
  .borda { fill: none; stroke: #000; stroke-width: .75; }
  .gr { fill: none; stroke: ${AIH_CINZA}; stroke-width: .75; }
  .cx { fill: #fff; stroke: ${AIH_CINZA}; stroke-width: .75; }
  .ck { fill: #fff; stroke: ${AIH_CINZA}; stroke-width: .567; }
  .ckx { stroke: #333; stroke-width: .7; }
  .multi { font-family: 'DejaVu Serif Condensed', 'DejaVu Serif', Georgia, serif; font-size: 7.5px; line-height: 10.7px; color: ${AIH_VALOR}; height: 100%; overflow: hidden; }
  .multi p { margin: 0; }
  .multi p.sv { margin-top: 3.8px; }
  @media screen and (max-width: 820px) { .folha { zoom: .45; } }
  @media print { body { background: #fff; } .barra, .avisos { display: none; } main { padding: 0; } .folha { margin: 0; box-shadow: none; } }
`;

// ajustes depois que a fonte carrega: valor de uma linha que não cabe é comprimido; texto longo diminui de tamanho
const AJUSTE_LAUDO_AIH = `
  function ajustar() {
    document.querySelectorAll('text.vl[data-w]').forEach(t => {
      const max = +t.dataset.w;
      if (t.getComputedTextLength() > max) { t.setAttribute('textLength', max); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
    });
    document.querySelectorAll('.multi').forEach(div => {
      let fs = 7.5;
      while (div.scrollHeight > div.clientHeight + 0.5 && fs > 4.6) { fs -= 0.25; div.style.fontSize = fs + 'px'; div.style.lineHeight = (fs * 1.43) + 'px'; }
    });
  }
  window.addEventListener('load', () => document.fonts.ready.then(() => { ajustar(); setTimeout(() => window.print(), 250); }));
`;

// abre um ou vários laudos num documento só (uma folha por internação)
function abrirLaudosAih(lista, { titulo } = {}) {
  if (!lista.length) { showToast('⚠️ Nenhuma internação finalizada para gerar o laudo'); return; }
  const w = window.open('', '_blank');
  if (!w) { showToast('⚠️ Libere os pop-ups para gerar o documento'); return; }
  // o campo 60 (nº da autorização) é preenchido à mão no laudo impresso
  const folhas = lista.map(a => `<div class="folha">${laudoAihSvg(dadosLaudoAih(a))}</div>`);
  w.document.write(`<!DOCTYPE html><html lang="pt-br"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(lista.length > 1 ? titulo || 'Laudos de AIH' : `Laudo de AIH — ${lista[0].nome}`)}</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap">
    <style>${ESTILO_LAUDO_AIH}</style></head><body>
    <div class="barra"><span>${lista.length > 1 ? `${lista.length} laudos de AIH` : `Laudo de AIH — ${esc(lista[0].nome)}`}</span>
      <button onclick="window.print()">Imprimir / salvar PDF</button></div>
    <main>${folhas.join('')}</main>
    <script>${AJUSTE_LAUDO_AIH}<\/script>
    </body></html>`);
  w.document.close();
}
