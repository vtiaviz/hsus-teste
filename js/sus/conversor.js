// Converte o dump MySQL das tabelas SUS (procedimentos, cids, procedxcid) no formato usado pelo sistema.
// Usado pela página Tabelas SUS (importação no navegador) e por tools/converter-tabelas-sus.js (Node).
(function (raiz) {
  // extrai as tuplas de todos os INSERT de uma tabela, respeitando aspas e \'
  function tuplas(src, tabela) {
    const re = new RegExp('INSERT INTO `' + tabela + '` VALUES (.*);', 'g');
    const linhas = [];
    let m;
    while ((m = re.exec(src))) {
      const s = m[1];
      let i = 0;
      while (i < s.length) {
        if (s[i] !== '(') { i++; continue; }
        i++;
        const campos = [];
        while (s[i] !== ')') {
          if (s[i] === "'") {
            let v = '';
            i++;
            while (s[i] !== "'") { if (s[i] === '\\') i++; v += s[i++]; }
            i++;
            campos.push(v);
          } else {
            let v = '';
            while (s[i] !== ',' && s[i] !== ')') v += s[i++];
            campos.push(v === 'NULL' ? null : Number(v));
          }
          if (s[i] === ',') i++;
        }
        i++;
        linhas.push(campos);
      }
    }
    if (!linhas.length) throw new Error(`Tabela "${tabela}" não encontrada no arquivo.`);
    return linhas;
  }

  function converterDumpSus(src, origem) {
    // procedimentos: [cod, descricao, sexo, idade_min (meses), idade_max (meses)]
    const procedimentos = tuplas(src, 'procedimentos')
      .map(([cod, descricao, sexo, idadeMin, idadeMax]) => [cod.trim(), descricao.trim(), sexo, idadeMin, idadeMax])
      .sort((a, b) => a[0].localeCompare(b[0]));
    const indiceProc = new Map(procedimentos.map((p, i) => [p[0], i]));

    // cids: [cod, descricao, sexo]. A tabela repete o mesmo código com sexos diferentes (ex.: N40 como "I" e
    // como "M"), sempre com a mesma descrição: fica uma linha por código, restrita a um sexo só quando todas
    // as linhas concordam (a restrição que vale para a AIH é a do procedimento).
    const sexosPorCid = new Map();
    tuplas(src, 'cids').forEach(([, cod, descricao, sexo]) => {
      const c = cod.trim();
      if (!sexosPorCid.has(c)) sexosPorCid.set(c, { descricao: descricao.trim(), sexos: new Set() });
      sexosPorCid.get(c).sexos.add(sexo);
    });
    const cids = [...sexosPorCid.entries()]
      .map(([cod, { descricao, sexos }]) => [cod, descricao, sexos.size === 1 && ['M', 'F'].includes([...sexos][0]) ? [...sexos][0] : 'I'])
      .sort((a, b) => a[0].localeCompare(b[0]));

    // procedxcid -> { cid: [índices de procedimentos] }
    // só entram procedimentos presentes na tabela "procedimentos" (os elegíveis como principal da AIH)
    const procxcid = {};
    let ignorados = 0;
    tuplas(src, 'procedxcid').forEach(([proc, cid]) => {
      const idx = indiceProc.get(proc.trim());
      if (idx === undefined) { ignorados++; return; }
      const c = cid.trim();
      (procxcid[c] = procxcid[c] || []).push(idx);
    });
    Object.values(procxcid).forEach(lista => lista.sort((a, b) => a - b));

    const pares = Object.values(procxcid).reduce((s, l) => s + l.length, 0);
    return {
      dados: { geradoEm: new Date().toISOString().slice(0, 10), origem, procedimentos, cids, procxcid },
      resumo: { procedimentos: procedimentos.length, cids: cids.length, pares, ignorados },
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { converterDumpSus };
  else raiz.converterDumpSus = converterDumpSus;
})(typeof window !== 'undefined' ? window : globalThis);
