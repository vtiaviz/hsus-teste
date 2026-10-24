// AIH — Autorização de Internação Hospitalar para impressão (ou "Salvar como PDF").
// Reproduz o modelo oficial: folha Carta (612 × 792 pt) com 1ª e 2ª via iguais, nas mesmas posições e fontes do modelo.
// O número da AIH vem da faixa cadastrada (12 dígitos + dígito verificador), gerado antes em "Gerar AIHs".
// Usa: clinbot.js.

const VIA2_DESLOCAMENTO = 378; // a 2ª via repete a 1ª, 378 pt abaixo

// valores da AIH a partir do que foi registrado no atendimento
function dadosAih(a, numero) {
  const dig = v => (v || '').replace(/\D/g, '');
  const h = Hospital.get(), resp = responsaveisAih();
  const i = a.ident || {}, c = a.consulta || {}, int = a.internacao || {};
  const adm = int.admissao || {}, cp = adm.campos || {}, s = int.saida || {};
  const med = solicitanteAih(a);
  return {
    numero,
    orgao: resp.orgao, emissor: h.nome || '', cnes: h.cnes || '', estabelecimento: h.nome || '',
    nome: a.nome, prontuario: i.prontuario || '',
    sexo: (SEXOS[i.sexo] || '').toUpperCase(), nasc: fmtData(i.nasc), cns: dig(i.cns), cpf: dig(i.cpf),
    mae: i.mae || '', ibge: i.ibge || '', municipio: i.municipio || '', cep: dig(i.cep),
    raca: i.raca ? `${i.raca}-${(RACAS[i.raca] || '').toUpperCase()}` : '', responsavel: cp.ac_nome || '',
    cpfSolicitante: dig(med?.cpf), solicitante: med?.nome || '',
    procCodigo: s.procCodigo || '', procDescricao: s.procDescricao || '',
    cid: s.cid || '', cidDescricao: s.cidDescricao || '',
    dataAutorizacao: fmtData((adm.em || adm.salvaEm || '').slice(0, 10)),
    autCpf: dig(resp.autCpf), autorizador: resp.autorizador, autCns: dig(resp.autCns),
  };
}

// uma via; "dy" desloca tudo para baixo (2ª via)
function viaAih(d, via, dy) {
  const p = [];
  const y = v => +(v + dy).toFixed(1);
  // valor com limite à direita: se não couber, é comprimido no ajuste depois que a fonte carrega
  const tx = (s, x, b, cls, max) => { if (s) p.push(`<text x="${x}" y="${y(b)}" class="${cls}"${max ? ` data-w="${(max - x).toFixed(1)}"` : ''}>${esc(s)}</text>`); };
  const rot = (s, x, b) => tx(s, x, b, 'rt');
  const val = (s, x, b, max = 575) => tx(s, x, b, 'vl', max);
  const quadro = (x, top, w, h, legenda, lx, lw, lb) => {
    p.push(`<rect x="${x}" y="${y(top)}" width="${w}" height="${h}" class="qd"/>`);
    p.push(`<rect x="${lx - 2}" y="${y(top) - 3}" width="${lw + 4}" height="6" fill="#fff"/>`);
    tx(legenda, lx, lb, 'lg');
  };

  // cabeçalho
  p.push(`<image href="${new URL('images/logo-sus-aih.jpg', location.href).href}" x="62.2" y="${y(14.6)}" width="76.6" height="44.3" preserveAspectRatio="none"/>`);
  tx('AUTORIZAÇÃO DE INTERNAÇÃO HOSPITALAR', 186.6, 34, 'ti');
  tx(`${via}ª Via`, 533, 34, 'ti');
  tx('Nº', 233, 49, 'nu'); tx(d.numero, 249.6, 49, 'nu');
  rot('Órgão Emissor :', 50.9, 69); tx(d.orgao, 206.9, 69, 'cd', 288); val(d.emissor, 290.9, 67);
  rot('Estabelecimento Solicitante :', 50.9, 87); val(d.cnes, 206.9, 85, 288); val(d.estabelecimento, 290.9, 85);
  rot('Estabelecimento Executante :', 50.9, 105); val(d.cnes, 206.9, 103, 288); val(d.estabelecimento, 290.9, 103);

  // paciente
  quadro(44.9, 116.9, 518, 74.1, 'Paciente', 285, 40.9, 118.7);
  rot('Nome :', 50.9, 129); val(d.nome, 92.9, 127, 424);
  rot('Prontuário :', 427.3, 129); val(d.prontuario, 494, 127, 559);
  rot('Sexo:', 50, 143.3); val(d.sexo, 80, 142, 148);
  rot('Nascimento:', 149.9, 143.3); val(d.nasc, 213.6, 142, 293);
  rot('CNS :', 295.3, 144); val(d.cns, 328.3, 142, 424);
  rot('CPF :', 425.9, 144); val(d.cpf, 455, 142, 559);
  rot('Nome da Mãe:', 50.9, 158.3); val(d.mae, 119.9, 157, 559);
  rot('Município :', 50.9, 171.8); val(d.ibge, 116.9, 171.2, 186); val(d.municipio, 188.9, 171.2, 375);
  rot('CEP :', 377.9, 171.8); val(d.cep, 411.6, 170.5, 559);
  rot('Raça / Cor:', 50.9, 184.6); val(d.raca, 104.9, 184, 169);
  rot('Responsável:', 170.9, 185.3); val(d.responsavel, 234.6, 183.2, 559);

  // solicitação / autorização
  quadro(45.6, 200.9, 517.4, 107.1, 'Solicitação / Autorização', 247.1, 117.4, 202);
  rot('CPF Solicitante:', 50.9, 216); val(d.cpfSolicitante, 182, 213.2, 269); val(d.solicitante, 272, 213.2, 559);
  rot('Procedimento Solicitado :', 50.9, 231); val(d.procCodigo, 182, 228.2, 559); val(d.procDescricao, 182, 243.2, 559);
  rot('Procedimento Autorizado :', 50.9, 258); val(d.procCodigo, 182, 256, 559); val(d.procDescricao, 182, 269.5, 559);
  rot('CID :', 50.9, 285); val(d.cid, 182, 286, 559); val(d.cidDescricao, +(182 + d.cid.length * 5.4 + 9.3).toFixed(1), 286, 559);
  rot('Nº Laudo:', 50.9, 302.3);
  rot('Nº Prontuário:', 185.9, 301.6); val(d.prontuario, 254.9, 299.5, 559);

  // autorizador
  quadro(44.9, 317.2, 518, 62.2, 'Autorizador', 277.7, 55.7, 319);
  rot('Data :', 50.9, 329.3); val(d.dataAutorizacao, 86.9, 327.2, 559);
  rot('CPF :', 50.9, 345); val(d.autCpf, 86.9, 342.2, 174); val(d.autorizador, 176.9, 342.2, 559);
  rot('CNS :', 50.9, 358.6); val(d.autCns, 86.9, 357.2, 559);
  rot('Assinatura e carimbo (Nº do registro do conselho de classe) ;', 50.9, 372.8);
  return p.join('');
}

function aihSvg(d) {
  return `<svg class="aih-doc" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792" width="8.5in" height="11in">
    ${viaAih(d, 1, 0)}
    <line x1="32" y1="390.6" x2="582.4" y2="390.6" class="sep"/>
    ${viaAih(d, 2, VIA2_DESLOCAMENTO)}
  </svg>`;
}

// ---------- janela de impressão ----------
const ESTILO_AIH = `
  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; background: #f4f6fb; font-family: 'DM Sans', Arial, sans-serif; }
  .barra { position: sticky; top: 0; z-index: 5; background: #1a2540; color: #fff; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 13px; }
  .barra button { background: linear-gradient(135deg, #3a7bd5, #5a9bf5); color: #fff; border: 0; border-radius: 10px; padding: 8px 16px; font: 700 13px 'DM Sans', Arial, sans-serif; cursor: pointer; white-space: nowrap; }
  .avisos { max-width: 8.5in; margin: 14px auto 0; background: #fff8db; color: #8a6500; border-radius: 8px; padding: 8px 12px; font-size: 12.5px; }
  main { padding: 18px 0 40px; }
  .folha { width: 8.5in; height: 11in; margin: 0 auto 18px; background: #fff; box-shadow: 0 4px 24px rgba(58,123,213,.12); overflow: hidden; break-after: page; }
  .folha:last-child { break-after: auto; }
  svg.aih-doc { display: block; }
  .ti { font: 700 9.9px Arial, 'Liberation Sans', Helvetica, sans-serif; fill: #000; }
  .rt { font: italic 700 9.9px Arial, 'Liberation Sans', Helvetica, sans-serif; fill: #000; }
  .lg { font: 700 9.9px Arial, 'Liberation Sans', Helvetica, sans-serif; fill: #000; }
  .cd { font: 400 9px Arial, 'Liberation Sans', Helvetica, sans-serif; fill: #000; }
  .vl { font: 400 9px 'Courier New', 'Liberation Mono', Courier, monospace; fill: #000; }
  .nu { font: 700 11px 'Courier New', 'Liberation Mono', Courier, monospace; fill: #000; }
  .qd { fill: none; stroke: #000; stroke-width: .45; }
  .sep { stroke: #000; stroke-width: .75; }
  @media screen and (max-width: 860px) { .folha { zoom: .45; } }
  @media print { body { background: #fff; } .barra, .avisos { display: none; } main { padding: 0; } .folha { margin: 0; box-shadow: none; } }
`;

// valor que passa do limite do campo é comprimido para caber
const AJUSTE_AIH = `
  document.querySelectorAll('text[data-w]').forEach(t => {
    const max = +t.dataset.w;
    if (t.getComputedTextLength() > max) { t.setAttribute('textLength', max); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
  });
`;

// abre uma ou várias AIHs num documento só (uma folha, com as duas vias, por internação)
function abrirAihs(lista, { titulo } = {}) {
  if (!lista.length) { showToast('⚠️ Nenhuma internação finalizada para gerar a AIH'); return; }
  if (lista.some(a => !a.internacao?.aih?.numero)) { showToast('⚠️ Gere as numerações em "Gerar AIHs" antes de emitir a AIH'); return; }
  const w = window.open('', '_blank');
  if (!w) { showToast('⚠️ Libere os pop-ups para gerar o documento'); return; }
  const folhas = lista.map(a => `<div class="folha">${aihSvg(dadosAih(a, a.internacao.aih.numero))}</div>`);
  w.document.write(`<!DOCTYPE html><html lang="pt-br"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(lista.length > 1 ? titulo || 'AIHs' : `AIH — ${lista[0].nome}`)}</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap">
    <style>${ESTILO_AIH}</style></head><body>
    <div class="barra"><span>${lista.length > 1 ? `${lista.length} AIHs` : `AIH — ${esc(lista[0].nome)}`}</span>
      <button onclick="window.print()">Imprimir / salvar PDF</button></div>
    <main>${folhas.join('')}</main>
    <script>
      window.addEventListener('load', () => document.fonts.ready.then(() => { ${AJUSTE_AIH} setTimeout(() => window.print(), 250); }));
    <\/script>
    </body></html>`);
  w.document.close();
}
