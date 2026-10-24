// Consulta às tabelas SUS (CID-10, procedimentos e compatibilidade procedimento x CID).
// Fonte: tabelas importadas pela página Cadastros > Tabelas SUS (guardadas no IndexedDB do navegador)
// ou, se não houver importação, as tabelas padrão de js/sus/dados.js (gerado por tools/converter-tabelas-sus.js).
// Os dados só são carregados quando alguém precisa deles, com SUS.carregar().
const SUS = (() => {
  // dados.js fica ao lado deste arquivo (currentScript só existe enquanto o script carrega)
  const URL_DADOS = new URL('dados.js', document.currentScript?.src || new URL('js/sus/', location.href)).href;
  const DB_NOME = 'clinbot', DB_STORE = 'sus', DB_CHAVE = 'tabelas';

  let carregando = null;
  let fonte = null;      // 'importado' | 'padrao'
  let meta = {};
  let cids = [], procs = [], procxcid = {};
  const porCid = new Map(), porProc = new Map();

  const normalizar = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const tokens = s => normalizar(s).split(/\s+/).filter(Boolean);

  // J189 -> J18.9 ; C73 -> C73
  const fmtCid = cod => (cod && cod.length === 4 ? `${cod.slice(0, 3)}.${cod[3]}` : cod || '');
  // 0303140151 -> 03.03.14.015-1 (formato do SIGTAP)
  const fmtProc = cod => (cod && cod.length === 10 ? `${cod.slice(0, 2)}.${cod.slice(2, 4)}.${cod.slice(4, 6)}.${cod.slice(6, 9)}-${cod[9]}` : cod || '');

  // ---------- IndexedDB (tabelas importadas) ----------
  function abrirDb() {
    return new Promise((ok, erro) => {
      if (!window.indexedDB) { erro(new Error('IndexedDB indisponível')); return; }
      const req = indexedDB.open(DB_NOME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    });
  }
  async function dbOperacao(modo, fn) {
    const db = await abrirDb();
    return new Promise((ok, erro) => {
      const tx = db.transaction(DB_STORE, modo);
      const req = fn(tx.objectStore(DB_STORE));
      tx.oncomplete = () => { ok(req?.result); db.close(); };
      tx.onerror = () => { erro(tx.error); db.close(); };
    });
  }
  const lerImportadas = () => dbOperacao('readonly', s => s.get(DB_CHAVE)).catch(() => null);

  // ---------- carga ----------
  function indexar(d, origemFonte) {
    fonte = origemFonte;
    meta = { origem: d.origem, geradoEm: d.geradoEm, importadoEm: d.importadoEm };
    cids = d.cids.map(([cod, descricao, sexo]) => ({ cod, descricao, sexo, busca: normalizar(`${cod} ${fmtCid(cod)} ${descricao}`) }));
    procs = d.procedimentos.map(([cod, descricao, sexo, idadeMin, idadeMax]) => ({ cod, descricao, sexo, idadeMin, idadeMax, busca: normalizar(`${cod} ${fmtProc(cod)} ${descricao}`) }));
    procxcid = d.procxcid;
    inverso = null;
    porCid.clear(); porProc.clear();
    cids.forEach(c => porCid.set(c.cod, c));
    procs.forEach((p, i) => { p.idx = i; porProc.set(p.cod, p); });
  }

  // injeta js/sus/dados.js (funciona também abrindo o arquivo direto, sem servidor)
  function carregarPadrao() {
    return new Promise((ok, erro) => {
      if (window.SUS_DADOS) { ok(window.SUS_DADOS); return; }
      const s = document.createElement('script');
      s.src = URL_DADOS;
      s.onload = () => ok(window.SUS_DADOS);
      s.onerror = () => erro(new Error('Não foi possível carregar as tabelas SUS.'));
      document.head.appendChild(s);
    });
  }

  function carregar() {
    if (cids.length) return Promise.resolve();
    if (!carregando) {
      carregando = lerImportadas()
        .then(imp => (imp ? indexar(imp, 'importado') : carregarPadrao().then(d => indexar(d, 'padrao'))))
        .catch(err => { carregando = null; throw err; });
    }
    return carregando;
  }

  // importa um dump SQL (mesmo formato do arquivo original) e passa a usá-lo no lugar das tabelas padrão
  async function importar(texto, nomeArquivo) {
    const { dados, resumo } = converterDumpSus(texto, nomeArquivo);
    dados.importadoEm = new Date().toISOString();
    await dbOperacao('readwrite', s => s.put(dados, DB_CHAVE));
    indexar(dados, 'importado');
    carregando = Promise.resolve();
    return resumo;
  }

  // apaga a importação e volta às tabelas padrão
  async function restaurarPadrao() {
    await dbOperacao('readwrite', s => s.delete(DB_CHAVE));
    indexar(await carregarPadrao(), 'padrao');
    carregando = Promise.resolve();
  }

  // ---------- consultas ----------
  // restrição de sexo das tabelas: I (indiferente) e N (não se aplica) valem para todos
  const sexoOk = (restricao, sexo) => !sexo || !['M', 'F'].includes(restricao) || restricao === sexo;
  const idadeOk = (p, idadeMeses) => idadeMeses == null || (idadeMeses >= p.idadeMin && idadeMeses <= p.idadeMax);

  // ordena: código que começa com o termo > descrição que começa com o termo > restante
  function filtrar(lista, termo, limite) {
    const q = tokens(termo);
    if (!q.length) return lista.slice(0, limite);
    const qCod = normalizar(termo).replace(/[.\-\s]/g, '');
    return lista
      .filter(x => q.every(t => x.busca.includes(t)) || (qCod && x.cod.toLowerCase().startsWith(qCod)))
      .map(x => ({ x, peso: x.cod.toLowerCase().startsWith(qCod) ? 0 : normalizar(x.descricao).startsWith(q[0]) ? 1 : 2 }))
      .sort((a, b) => a.peso - b.peso || a.x.cod.localeCompare(b.x.cod))
      .slice(0, limite)
      .map(({ x }) => x);
  }

  // CIDs que aceitam o paciente; cada um vem com a quantidade de procedimentos compatíveis
  function buscarCids(termo, paciente = {}, limite = 8) {
    if (normalizar(termo).trim().length < 2) return [];
    return filtrar(cids.filter(c => sexoOk(c.sexo, paciente.sexo)), termo, limite)
      .map(c => ({ ...c, nProcedimentos: procedimentosCompativeis(c.cod, paciente).length }));
  }

  // procedimentos (principais da AIH) compatíveis com o CID, o sexo e a idade do paciente
  function procedimentosCompativeis(cidCod, paciente = {}) {
    return (procxcid[cidCod] || []).map(i => procs[i]).filter(p => sexoOk(p.sexo, paciente.sexo) && idadeOk(p, paciente.idadeMeses));
  }

  function buscarProcedimentos(cidCod, termo, paciente = {}, limite = 50) {
    return filtrar(procedimentosCompativeis(cidCod, paciente), termo, limite);
  }

  // CIDs compatíveis com um procedimento (sentido inverso; o índice é montado na primeira consulta)
  let inverso = null;
  function cidsDoProcedimento(procCod) {
    const p = porProc.get(procCod);
    if (!p) return [];
    if (!inverso) {
      inverso = new Map();
      Object.entries(procxcid).forEach(([c, lista]) => lista.forEach(i => {
        if (!inverso.has(i)) inverso.set(i, []);
        inverso.get(i).push(c);
      }));
    }
    return (inverso.get(p.idx) || []).map(c => porCid.get(c) || { cod: c, descricao: '' });
  }

  // listagens da página de cadastro (sem mínimo de caracteres)
  const listarCids = (termo, limite = 100) => filtrar(cids, termo, limite);
  const listarProcedimentos = (termo, limite = 100) => filtrar(procs, termo, limite);

  // pares CID x procedimento; o filtro vale para código ou descrição de qualquer um dos lados
  function listarPares(termo, limite = 100) {
    const q = tokens(termo);
    const pares = [];
    for (const [c, lista] of Object.entries(procxcid)) {
      const cid = porCid.get(c);
      for (const i of lista) {
        const p = procs[i];
        if (q.length && !q.every(t => (cid?.busca || normalizar(c)).includes(t) || p.busca.includes(t))) continue;
        pares.push({ cid: cid || { cod: c, descricao: '' }, proc: p });
        if (pares.length >= limite) return pares;
      }
    }
    return pares;
  }

  function info() {
    return {
      fonte, ...meta,
      cids: cids.length, procedimentos: procs.length,
      pares: Object.values(procxcid).reduce((s, l) => s + l.length, 0),
    };
  }

  return {
    carregar, importar, restaurarPadrao, info,
    buscarCids, procedimentosCompativeis, buscarProcedimentos, cidsDoProcedimento,
    listarCids, listarProcedimentos, listarPares, fmtCid, fmtProc,
    cid: cod => porCid.get(cod) || null,
    procedimento: cod => porProc.get(cod) || null,
    get carregado() { return cids.length > 0; },
  };
})();
