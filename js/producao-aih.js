// Exportação da produção (AIHs do mês) em CSV: uma linha por AIH, sem cabeçalho, campos separados por ";".
// Textos em maiúsculas e sem acento; um campo com espaço vai entre aspas (como o fputcsv do PHP).
// Ordem das colunas: cns; nome; prontuário; nascimento; sexo; raça; mãe; responsável; código do logradouro; logradouro; cep;
// ibge do município; (em branco); entrada; saída; cid; procedimento; clínica; caráter; motivo da alta; cpf, cns e cbo do solicitante; aih.
// Usa: clinbot.js, laudo-aih.js (clinicaAih, solicitanteAih, soDigitos).

// código DNE do tipo de logradouro (tabela do CADSUS)
const CODIGO_LOGRADOURO = {
  rua: '081', avenida: '008', travessa: '100', vila: '104', fazenda: '037', passagem: '074',
  estrada: '031', ramal: '082', rodovia: '090', sitio: '092', alameda: '004', praca: '065',
};
const SEXO_SIH = { M: '1', F: '3' };

const textoSih = v => (v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
const codigoSih = v => (v ? String(Number(v)) : ''); // '03' → '3'
const fmtCpfSih = v => { const d = soDigitos(v); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : d; };
const fmtCepSih = v => { const d = soDigitos(v); return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, '$1-$2') : d; };
const campoCsv = v => { const s = String(v ?? ''); return /[;"\s]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

function linhaProducao(a) {
  const i = a.ident || {}, int = a.internacao || {}, adm = int.admissao || {}, s = int.saida || {};
  const med = solicitanteAih(a);
  return [
    soDigitos(i.cns), textoSih(a.nome), i.prontuario || '', i.nasc || '', SEXO_SIH[i.sexo] || '', codigoSih(i.raca),
    textoSih(i.mae), textoSih(adm.campos?.ac_nome || a.nome),
    CODIGO_LOGRADOURO[slugTexto(i.tipoLogradouro)] || '', textoSih(i.logradouro), fmtCepSih(i.cep), soDigitos(i.ibge), '',
    (adm.em || adm.salvaEm || '').slice(0, 10), (s.em || '').slice(0, 10), s.cid || '', s.procCodigo || '',
    codigoSih(clinicaAih(a).split(' ')[0]), codigoSih(adm.carater), s.motivo || '',
    fmtCpfSih(med?.cpf), soDigitos(med?.cns), med?.cbo || '', int.aih?.numero || '',
  ];
}

// colunas que o SIH exige: cns, nascimento, sexo, ibge, entrada, saída, cid, procedimento, aih
const OBRIGATORIAS_PRODUCAO = [[0, 'CNS'], [3, 'nascimento'], [4, 'sexo'], [11, 'IBGE'], [13, 'entrada'], [14, 'saída'], [15, 'CID'], [16, 'procedimento'], [23, 'AIH']];

// devolve o texto do CSV e os atendimentos com colunas obrigatórias em branco
function producaoCsv(lista) {
  const ordenada = [...lista].sort((x, y) => (x.internacao?.aih?.numero || '').localeCompare(y.internacao?.aih?.numero || ''));
  const linhas = ordenada.map(linhaProducao);
  const incompletos = ordenada.map((a, k) => ({ nome: a.nome, faltam: OBRIGATORIAS_PRODUCAO.filter(([c]) => !linhas[k][c]).map(([, n]) => n) }))
    .filter(x => x.faltam.length);
  return { csv: linhas.map(l => l.map(campoCsv).join(';') + '\n').join(''), incompletos };
}

function baixarArquivo(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const link = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
