// ClinBot — dados, regras e helpers compartilhados entre as páginas (entradas.html, observacao.html)

// ===== CONSTANTS =====
// classificação de risco da triagem: nome = nível, label = cor
const RISCOS = {
  azul:     { nome:'Baixa',      label:'Azul',     cor:'#1e88e5' },
  verde:    { nome:'Média',      label:'Verde',    cor:'#43a047' },
  amarelo:  { nome:'Alta',       label:'Amarelo',  cor:'#fdd835' },
  vermelho: { nome:'Muito alta', label:'Vermelho', cor:'#e53935' },
};
// registros antigos usavam 5 cores (Manchester); "laranja" passa a valer como muito alta
Object.defineProperty(RISCOS, 'laranja', { value: RISCOS.vermelho, enumerable: false });
const normalizaRisco = k => (k === 'laranja' ? 'vermelho' : k || '');

const ENCAMINHAMENTOS = { ambulatorio:'Ambulatório', enfermaria:'Enfermaria', alta:'Alta' };

// abas (etapas) de Entradas em cada fluxo
const FLUXOS = {
  novo:         ['identificacao','triagem','consulta'],
  ambulatorio:  ['identificacao','consulta'],
  enfermaria:   ['identificacao','consulta'],
  exames:       ['identificacao','exames'],
  telemedicina: ['identificacao','telemedicina'],
};
const TRANSF_LABELS = { ambulatorio:'Ambulatório', enfermaria:'Enfermaria', exames:'Exames', telemedicina:'Telemedicina' };
const STAGE_LABELS  = { identificacao:'Identificação', triagem:'Triagem', consulta:'Consulta', exames:'Exames', telemedicina:'Telemedicina' };

const SEXOS = { M:'Masculino', F:'Feminino' };
const RACAS = { '01':'Branca', '02':'Preta', '03':'Parda', '04':'Amarela', '05':'Indígena' };

// conselhos profissionais (registro impresso ao lado do nome em cada registro do prontuário)
const CONSELHOS = {
  CRM: 'Conselho Regional de Medicina', COREN: 'Conselho Regional de Enfermagem', CRF: 'Conselho Regional de Farmácia',
  CRO: 'Conselho Regional de Odontologia', CREFITO: 'Conselho Regional de Fisioterapia e Terapia Ocupacional',
  CRN: 'Conselho Regional de Nutricionistas', CRP: 'Conselho Regional de Psicologia', CRESS: 'Conselho Regional de Serviço Social',
  CRBM: 'Conselho Regional de Biomedicina', CRFa: 'Conselho Regional de Fonoaudiologia',
};
const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

const ALERGIAS_COMUNS = ['Dipirona', 'Penicilina', 'Amoxicilina', 'AAS', 'Ibuprofeno', 'Látex', 'Sulfa', 'Iodo'];

// tabela de aprazamento de medicações da unidade: intervalo -> horários de início permitidos
const APRAZAMENTO = {
  '6':  { label:'6/6 horas',   inicios:[6, 12, 18, 24] },
  '8':  { label:'8/8 horas',   inicios:[6, 8, 14, 16, 22, 24] },
  '12': { label:'12/12 horas', inicios:[6, 8, 10, 12, 18] },
  '24': { label:'24/24 horas', inicios:[24] },
};
// além dos intervalos fixos: dose única e "se necessário" não têm horários aprazados
const APRAZ_ESPECIAIS = { unica:'Dose única', sn:'Se necessário' };

const fmtHorario = h => `${String(h).padStart(2, '0')}H`;

// ex.: intervalo 6, início 18 -> [18, 24, 6, 12]  (24 = meia-noite)
function horariosAprazamento(intervalo, inicio) {
  const n = Number(intervalo);
  return Array.from({ length: 24 / n }, (_, i) => ((inicio - 1 + i * n) % 24) + 1);
}

// lê o intervalo da posologia escrita na prescrição ("EV 12/12h", "VO dose única", "6/6h se dor")
function intervaloDaPosologia(pos) {
  const p = (pos || '').toLowerCase();
  if (/dose [úu]nica|\bagora\b/.test(p)) return 'unica';
  if (/\bse\b|s\/n|\bsn\b|necess[áa]rio/.test(p)) return 'sn';
  const m = p.match(/(\d{1,2})\s*\/\s*\d{1,2}\s*h/);
  if (m && APRAZAMENTO[m[1]]) return m[1];
  if (/1\s*x\s*(ao)?\s*dia|1 vez ao dia|uma vez ao dia/.test(p)) return '24';
  return '';
}

// primeiro horário de início permitido a partir da hora informada
function inicioPadrao(intervalo, hora) {
  const inicios = APRAZAMENTO[intervalo]?.inicios || [];
  return inicios.find(h => h >= hora) ?? inicios[0];
}

const IDADE_PEDIATRICA = 12; // abaixo desta idade (anos) o paciente vai para a Pediátrica

// público que cada ala recebe (cadastro do Hospital)
const PUBLICOS_ALA = {
  masculino:  'Adultos — masculino',
  feminino:   'Adultos — feminino',
  misto:      'Adultos — ambos os sexos',
  pediatrico: 'Pediátrico (menores de 12 anos)',
};

// alas e leitos vêm do cadastro do Hospital: { id: { nome, leitos, sexo?, publico } }
function enfermarias() {
  return Object.fromEntries((Hospital.get().alas || []).map(a => [a.id, {
    nome: a.nome,
    leitos: Number(a.leitos) || 0,
    publico: a.publico === 'pediatrico' ? 'pediatrico' : 'adulto',
    sexo: a.publico === 'masculino' ? 'M' : a.publico === 'feminino' ? 'F' : undefined,
  }]));
}

// alas que podem receber o paciente; sem sexo ou idade informados, não há como restringir por eles
function alasCompativeis(sexo, idade) {
  const alas = enfermarias();
  return Object.keys(alas).filter(key => {
    const ala = alas[key];
    if (idade != null) {
      const pediatrico = idade < IDADE_PEDIATRICA;
      if ((ala.publico === 'pediatrico') !== pediatrico) return false;
    }
    return !ala.sexo || !sexo || ala.sexo === sexo;
  });
}

// ===== HELPERS =====
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function isoTime(d) {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function agora() {
  const now = new Date();
  return `${isoDate(now)}T${isoTime(now)}`;
}
function fmtData(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtDataHora(iso) {
  const [d, t] = iso.split('T');
  return `${fmtData(d)} às ${t}`;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function iniciais(nome) {
  const words = (nome || '').trim().split(/\s+/).filter(w => w.length > 1);
  const ini = words.length >= 2 ? words[0][0] + words[words.length-1][0] : (words[0] ? words[0].slice(0,2) : '??');
  return ini.toUpperCase();
}
function maskCPF(el) {
  let v = el.value.replace(/\D/g,'').slice(0,11);
  v = v.replace(/(\d{3})(\d)/,'$1.$2');
  v = v.replace(/(\d{3})\.(\d{3})(\d)/,'$1.$2.$3');
  v = v.replace(/\.(\d{3})(\d)/,'.$1-$2');
  el.value = v;
}
function maskCNS(el) {
  const v = el.value.replace(/\D/g,'').slice(0,15);
  el.value = [v.slice(0,3), v.slice(3,7), v.slice(7,11), v.slice(11,15)].filter(Boolean).join(' ');
}
function maskCEP(el) {
  const v = el.value.replace(/\D/g,'').slice(0,8);
  el.value = v.length > 5 ? `${v.slice(0,5)}-${v.slice(5)}` : v;
}
// dígitos verificadores do CPF
function cpfValido(cpf) {
  const d = (cpf || '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { const s = [...d.slice(0, n)].reduce((acc, x, i) => acc + Number(x) * (n + 1 - i), 0); return ((s * 10) % 11) % 10; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
const slugTexto = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function maskPhone(el) {
  let v = el.value.replace(/\D/g,'').slice(0,11);
  if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{4})$/,'($1) $2-$3');
  else               v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/,'($1) $2-$3');
  el.value = v;
}
function calcAge(nasc) {
  if (!nasc) return null;
  const [y, m, d] = nasc.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth()+1 < m || (today.getMonth()+1 === m && today.getDate() < d)) age--;
  return age;
}

// ===== ETAPAS =====
const isIdentificado = a => !!(a.ident.cns && a.ident.mae && a.ident.logradouro);
const isTriado       = a => !!a.triagem.risco;
// novo: concluída ao definir o encaminhamento
// transferência (ambulatório/enfermaria): o destino já é o encaminhamento; concluída com médico e diagnóstico
const isConsultado = a => a.origem === 'transferencia'
  ? !!(a.consulta.medico && a.consulta.diagnostico)
  : !!a.consulta.encaminhamento;

// transferência sem destino escolhido mostra só a identificação
function stagesFor(origem, transf) {
  if (origem === 'novo') return FLUXOS.novo;
  if (origem === 'transferencia') return FLUXOS[transf] || ['identificacao'];
  return ['identificacao']; // origem ainda não escolhida
}
const stagesOf = a => stagesFor(a.origem, a.destinoTransf);

function stageDone(a, s) {
  switch (s) {
    case 'identificacao': return isIdentificado(a);
    case 'triagem':       return isTriado(a);
    case 'consulta':      return isConsultado(a);
    case 'exames':        return !!a.exames?.enviadoEm;
    case 'telemedicina':  return !!a.telemedicina?.registradoEm;
  }
}

// pendente = etapa faz parte do fluxo e ainda não foi concluída
const isPending = (a, s) => stagesOf(a).includes(s) && !stageDone(a, s);

// todas as abas de Entradas concluídas = paciente já seguiu para outro setor
const isConcluido = a => stagesOf(a).every(s => stageDone(a, s));

// em observação: saiu de Entradas encaminhado ao ambulatório e ainda sem encaminhamento da observação
const isEmObservacao = a => isConcluido(a) && a.consulta.encaminhamento === 'ambulatorio' && !a.observacao?.encaminhamento;

// internado: encaminhado à enfermaria pela consulta, ou à internação pela observação, e ainda sem saída
const isInternado = a =>
  ((isConcluido(a) && a.consulta.encaminhamento === 'enfermaria') || a.observacao?.encaminhamento === 'internacao') &&
  !a.internacao?.saida;

// motivos de saída/permanência da internação (tabela do SIH usada no sistema antigo)
const MOTIVOS_SAIDA = [
  { grupo:'Alta', itens:[['11','Alta curado'], ['12','Alta melhorado'], ['14','Alta a pedido'], ['15','Alta com previsão de retorno'], ['16','Alta por evasão'], ['18','Alta por outros motivos']] },
  { grupo:'Transferência', itens:[['10','Transferência']] },
  { grupo:'Permanência', itens:[['21','Permanência por características próprias da doença'], ['22','Permanência por intercorrência'], ['23','Permanência por impossibilidade sócio-familiar'],
      ['24','Permanência por processo de doação de órgãos (doador vivo)'], ['25','Permanência por processo de doação de órgãos (doador morto)'], ['26','Permanência por mudança de procedimento'],
      ['27','Permanência por reoperação'], ['28','Permanência por outros motivos']] },
  { grupo:'Óbito', itens:[['41','Óbito com declaração do médico assistente'], ['42','Óbito com declaração do Instituto Médico Legal'], ['43','Óbito com declaração do Serviço de Verificação de Óbito']] },
  { grupo:'Encerramento', itens:[['51','Encerramento administrativo']] },
  { grupo:'Obstétricos', itens:[['61','Alta da mãe/puérpera e do recém-nascido'], ['62','Alta da mãe/puérpera e permanência do recém-nascido'], ['63','Alta da mãe/puérpera e óbito do recém-nascido'],
      ['64','Alta da mãe/puérpera com óbito fetal'], ['65','Óbito da gestante e do concepto'], ['66','Óbito da mãe/puérpera e alta do recém-nascido'], ['67','Óbito da mãe/puérpera e permanência do recém-nascido']] },
];
const isPermanencia = codigo => codigo.startsWith('2');
const motivoLabel = codigo => MOTIVOS_SAIDA.flatMap(g => g.itens).find(([c]) => c === codigo)?.[1] || codigo;
// tipo de saída para resumos: alta, obito, transferencia ou encerramento
function tipoSaida(codigo) {
  if (['41', '42', '43', '65', '66', '67'].includes(codigo)) return 'obito';
  if (codigo === '10' || codigo === '31') return 'transferencia';
  if (codigo === '51') return 'encerramento';
  return 'alta';
}

// ===== FINALIZADOS =====
// cada função devolve { em, ... } quando o atendimento terminou naquele setor, ou null
const finalizacaoAmbulatorio = a => (a.observacao?.encaminhamento
  ? { em: a.observacao.encaminhadoEm, destino: a.observacao.encaminhamento } : null);
const finalizacaoEnfermaria = a => (a.internacao?.saida
  ? { em: a.internacao.saida.em, ...a.internacao.saida, tipo: tipoSaida(a.internacao.saida.motivo) } : null);
function encaminhamentoRealizado(a) {
  if (a.origem !== 'transferencia') return null;
  if (a.destinoTransf === 'exames' && a.exames?.enviadoEm) return { em: a.exames.enviadoEm, tipo: 'exames' };
  if (a.destinoTransf === 'telemedicina' && a.telemedicina?.registradoEm) return { em: a.telemedicina.registradoEm, tipo: 'telemedicina' };
  return null;
}

// leito no formato "enfermaria-numero", ex.: "masculina-3"
function leitoLabel(leito) {
  if (!leito) return '';
  const [ala, num] = leito.split('-');
  return `${enfermarias()[ala]?.nome || ala} · Leito ${String(num).padStart(2, '0')}`;
}

// ===== DADOS DE EXEMPLO =====
function seedAtendimentos() {
  const HOJE = isoDate(new Date());
  const dia = n => isoDate(new Date(Date.now() - n * 86400000)); // n dias atrás
  return [
    { id:1, nome:'Maria da Silva', relato:'Dor torácica há 2 horas', data:HOJE, hora:'07:42', origem:'novo', color:'#f472b6',
      ident:{ cns:'898 0010 2345 6781', cpf:'321.654.987-00', sexo:'F', raca:'03', nasc:'1985-04-12', mae:'Joana da Silva', telefone:'(91) 98765-4321', tipoLogradouro:'rua', logradouro:'13 de Maio', numero:'120', bairro:'Centro', municipio:'Belém' },
      triagem:{ risco:'vermelho', pa:'160/100', fc:'104', temp:'36.9', spo2:'95', queixa:'Dor em aperto irradiando para braço esquerdo', alergias:[] },
      consulta:{ medico:'Paulo Mendes — CRM-PA 12345', medicoId:3, diagnostico:'Dor torácica a esclarecer', plano:'Monitorização, ECG seriado e troponina. Reavaliar em 6h.', encaminhamento:'ambulatorio',
        prescricao:[{ med:'AAS 300mg', pos:'VO, dose única' }, { med:'Dipirona 1g', pos:'EV 6/6h se dor' }], exames:[{ exame:'ECG', obs:'seriado' }, { exame:'Troponina', obs:'' }], receitaTipo:'simples' },
      observacao:{ checkins:[{ administrado:true, hora:'08:30' }] } },
    { id:2, nome:'João Pereira', relato:'Febre e tosse há 3 dias', data:HOJE, hora:'08:05', origem:'novo', color:'#3a7bd5',
      ident:{ cns:'700 5012 3456 7890', cpf:'111.222.333-44', sexo:'M', nasc:'1978-09-03', mae:'Rosa Pereira', telefone:'(91) 97654-3210', tipoLogradouro:'avenida', logradouro:'Almirante Barroso', numero:'1500', municipio:'Belém' },
      triagem:{ risco:'verde', temp:'38.4', spo2:'97', queixa:'Tosse produtiva', alergias:[] }, consulta:{} },
    { id:3, nome:'Ana Costa', relato:'Corte profundo na mão esquerda', data:HOJE, hora:'08:20', origem:'novo', color:'#00c9a7',
      ident:{ cns:'709 4455 6677 8899', cpf:'555.666.777-88', sexo:'F', nasc:'1992-12-25', mae:'Lúcia Costa', tipoLogradouro:'rua', logradouro:'dos Mundurucus', municipio:'Belém' },
      triagem:{ risco:'amarelo', pa:'120/80', alergias:['Látex'] }, consulta:{} },
    { id:4, nome:'Carlos Souza', relato:'Transferido da UBS com crise hipertensiva', data:HOJE, hora:'08:31', origem:'transferencia', destinoTransf:'enfermaria', color:'#a78bfa',
      ident:{ cns:'702 3456 7890 1234', sexo:'M', nasc:'1965-07-18', mae:'Teresa Souza', tipoLogradouro:'travessa', logradouro:'Mauriti', municipio:'Ananindeua' },
      triagem:{}, consulta:{} },
    { id:5, nome:'Marcos Vieira', relato:'Trazido pelo SAMU após queda de moto', data:HOJE, hora:'08:47', origem:'novo', color:'#ff6b6b',
      ident:{ cns:'706 2233 4455 6677', sexo:'M', nasc:'1996-05-09', mae:'Rita Vieira', tipoLogradouro:'avenida', logradouro:'Pedro Miranda', municipio:'Belém' },
      triagem:{ risco:'vermelho', pa:'90/60', fc:'122', spo2:'91', queixa:'Rebaixamento de consciência', alergias:[] },
      consulta:{ medico:'Helena Rocha — CRM-PA 23456', medicoId:4, diagnostico:'Traumatismo cranioencefálico', plano:'Estabilização e TC de crânio.', encaminhamento:'enfermaria' } },
    { id:6, nome:'Beatriz Lima', relato:'Dor abdominal intensa', data:HOJE, hora:'09:02', origem:'novo', color:'#fb923c', ident:{}, triagem:{}, consulta:{} },
    { id:7, nome:'Lucas Alves', relato:'Crise de asma', data:HOJE, hora:'09:10', origem:'novo', color:'#3a7bd5', ident:{}, triagem:{}, consulta:{} },
    { id:8, nome:'Sofia Mendes', relato:'Vômitos desde ontem', data:HOJE, hora:'09:25', origem:'novo', color:'#f472b6',
      ident:{ cns:'898 7654 3210 9876', sexo:'F', nasc:'2018-08-10', mae:'Carla Mendes', tipoLogradouro:'rua', logradouro:'Boaventura da Silva', municipio:'Belém' },
      triagem:{}, consulta:{} },
    { id:9, nome:'Raimundo Ferreira', relato:'Transferido para coleta de hemograma e glicemia', data:HOJE, hora:'09:40', origem:'transferencia', destinoTransf:'exames', color:'#00c9a7',
      ident:{ cns:'705 1122 3344 5566', sexo:'M', nasc:'1958-02-03', mae:'Antônia Ferreira', tipoLogradouro:'rua', logradouro:'Pariquis', municipio:'Belém' },
      triagem:{}, consulta:{}, telemedicina:{},
      exames:{ solicitacoes:[{ exame:'Hemograma completo', obs:'' }, { exame:'Glicemia', obs:'jejum de 8h' }] } },
    { id:10, nome:'Luzia Barros', relato:'Retorno de pós-operatório por teleconsulta', data:HOJE, hora:'09:55', origem:'transferencia', destinoTransf:'telemedicina', color:'#a78bfa',
      ident:{ cns:'708 9988 7766 5544', sexo:'F', nasc:'1974-11-21', mae:'Maria Barros', tipoLogradouro:'avenida', logradouro:'Nazaré', municipio:'Belém' },
      triagem:{}, consulta:{}, exames:{}, telemedicina:{ registradoEm:`${HOJE}T09:58` } },
    { id:11, nome:'Rosa Almeida', relato:'Dor de cabeça forte desde a manhã', data:HOJE, hora:'10:05', origem:'novo', color:'#00c9a7',
      ident:{ cns:'703 5566 7788 9900', cpf:'444.555.666-77', sexo:'F', raca:'02', nasc:'1969-03-14', mae:'Benedita Almeida', telefone:'(91) 99876-1234', tipoLogradouro:'rua', logradouro:'dos Pariquis', numero:'45', municipio:'Belém' },
      triagem:{ risco:'amarelo', pa:'150/95', fc:'92', temp:'36.8', spo2:'97', queixa:'Cefaleia intensa com náuseas', alergias:['Dipirona'] },
      consulta:{ medico:'Paulo Mendes — CRM-PA 12345', medicoId:3, diagnostico:'Cefaleia', plano:'Analgesia, antiemético e reavaliação em 2h.', encaminhamento:'ambulatorio',
        prescricao:[{ med:'Paracetamol 750mg', pos:'VO agora' }, { med:'Metoclopramida 10mg', pos:'EV agora' }, { med:'Soro fisiológico 0,9% 500ml', pos:'EV em 1h' }] } },
    { id:12, nome:'Pedro Santos', relato:'Transferido da UBS com lombalgia', data:HOJE, hora:'10:20', origem:'transferencia', destinoTransf:'ambulatorio', color:'#fb923c',
      ident:{ cns:'704 6677 8899 0011', sexo:'M', raca:'03', nasc:'1981-08-27', mae:'Fátima Santos', tipoLogradouro:'avenida', logradouro:'Duque de Caxias', municipio:'Belém' },
      triagem:{}, consulta:{ medico:'Helena Rocha — CRM-PA 23456', medicoId:4, diagnostico:'Lombalgia aguda', plano:'Observação e analgesia.', encaminhamento:'ambulatorio' } },
    { id:13, nome:'Antônio Ribeiro', relato:'Falta de ar e tosse há 4 dias', data:HOJE, hora:'06:50', origem:'novo', color:'#3a7bd5',
      ident:{ cns:'701 2345 6789 0123', cpf:'222.333.444-55', sexo:'M', raca:'03', nasc:'1952-06-15', mae:'Raimunda Ribeiro', naturalidade:'Abaetetuba/PA', telefone:'(91) 98111-2233', tipoLogradouro:'rua', logradouro:'Oliveira Belo', numero:'310', bairro:'Umarizal', municipio:'Belém' },
      triagem:{ risco:'vermelho', pa:'170/100', fc:'98', temp:'37.8', spo2:'92', queixa:'Dispneia e tosse produtiva', alergias:['Penicilina'] },
      consulta:{ medico:'Helena Rocha — CRM-PA 23456', medicoId:4, diagnostico:'Pneumonia', plano:'Antibioticoterapia EV e oxigenoterapia.', encaminhamento:'enfermaria',
        prescricao:[{ med:'Ceftriaxona 1g', pos:'EV 12/12h' }, { med:'Dipirona 1g', pos:'EV 6/6h se febre' }], exames:[{ exame:'Hemograma', obs:'' }, { exame:'Raio-X de tórax', obs:'' }] },
      internacao:{
        aprazamentos:{ 'Ceftriaxona 1g':{ intervalo:'12', inicio:8 }, 'Salbutamol spray':{ intervalo:'6', inicio:12 } },
        admissao:{ salvaEm:`${HOJE}T08:10`, em:`${HOJE}T08:00`, leito:'masculina-2', carater:'02', procedimentos:[{ proc:'ADMINISTRAÇÃO DE MEDICAÇÃO ENDOVENOSA', hora:'08:20' }],
          checkinsMed:[{ administrado:true, hora:'08:20' }, { administrado:false, hora:'' }], checkinsExame:[{ administrado:true, hora:'08:15' }, { administrado:false, hora:'' }],
          campos:{ ac_nome:'Rita Ribeiro', ac_telefone:'(91) 98222-3344', ac_parentesco:'filho', ac_doc_tipo:'cpf', ac_doc_numero:'333.444.555-66',
            hab_tabagista:true, hab_tabagista_qtd:'10 cigarros/dia', hp_has:true, hp_medicamentos:true, hp_medicamentos_quais:'Losartana', hp_medicamentos_tempo:'5 anos',
            est_entrada:'maca', est_pupilas:'isocoricas', est_fotorreagentes:true, est_consciencia:'orientado', est_autocuidado:'parcial',
            ssvv_pa:'160/95', ssvv_temp:'37.6', ssvv_fc:'96', ssvv_spo2:'93', ssvv_fr:'24', antro_peso:'72', antro_altura:'1.70',
            ef_corpo_tipo_respiracao:'dispneico', ef_corpo_ausculta:'crepitacoes',
            diag_outro:'Risco de padrão respiratório ineficaz', plano_enfermagem:'Oxigenoterapia e controle de SSVV de 4/4h.', implementacao:'Cateter nasal O2 2 L/min.',
            anotacao:'Paciente admitido em maca, consciente e orientado, com dispneia leve.' } },
        evolucoesEnf:[{ em:`${HOJE}T10:00`, profissional:'Joana Lima — COREN-PA 345678-TE', profissionalId:5, acompanhamento:'total',
          administracoes:[], examesColetados:['Raio-X de tórax'],
          ssvv:{ pa:'150/90', temp:'37.2', fc:'90', fr:'22', spo2:'95', glicemia:'110' }, estado:{ diurese:true, evacuacao:false, verbalizacao:true, deambulando:false, dieta:true, avp:true },
          anotacao:'Paciente estável, aceitando dieta, AVP pérvio em MSE.' }],
        evolucoesMed:[{ em:`${HOJE}T11:30`, medico:'Helena Rocha — CRM-PA 23456', medicoId:4, diagnostico:'Pneumonia comunitária', plano:'Manter antibiótico e reavaliar RX em 48h.',
          ssvv:{ pa:'140/85', temp:'37.0', fc:'88', fr:'20', spo2:'96', peso:'72' }, estadoPaciente:'Melhora do padrão respiratório.', anotacoes:'',
          prescricao:[{ med:'Salbutamol spray', pos:'4 jatos 6/6h' }], exames:[{ exame:'PCR', obs:'' }] }],
      } },
    { id:14, nome:'Fernanda Torres', relato:'Dor abdominal em cólica', data:HOJE, hora:'07:15', origem:'novo', color:'#ff6b6b',
      ident:{ cns:'707 8899 0011 2233', cpf:'777.888.999-00', sexo:'F', raca:'01', nasc:'1988-11-05', mae:'Clara Torres', naturalidade:'Belém/PA', telefone:'(91) 99432-1098', tipoLogradouro:'travessa', logradouro:'Quintino Bocaiúva', municipio:'Belém' },
      triagem:{ risco:'amarelo', pa:'130/80', fc:'100', temp:'38.1', spo2:'98', queixa:'Dor em fossa ilíaca direita', alergias:['Látex'] },
      consulta:{ medico:'Paulo Mendes — CRM-PA 12345', medicoId:3, diagnostico:'Dor abdominal a esclarecer', plano:'Analgesia e observação.', encaminhamento:'ambulatorio',
        prescricao:[{ med:'Escopolamina 20mg', pos:'EV agora' }] },
      observacao:{ checkins:[{ administrado:true, hora:'07:40' }], anotacoes:[{ em:`${HOJE}T09:30`, texto:'Dor persistente apesar da analgesia. Encaminhada para internação.' }],
        encaminhamento:'internacao', encaminhadoEm:`${HOJE}T09:35` } },

    // ---- já finalizados (para as listas de Finalizados; datas relativas a hoje) ----
    { id:15, nome:'Cláudio Martins', relato:'Cólica renal', data:dia(3), hora:'14:10', origem:'novo', color:'#3a7bd5',
      ident:{ cns:'702 1111 3333 5555', cpf:'333.222.111-00', sexo:'M', raca:'03', nasc:'1979-04-02', mae:'Francisca Martins', naturalidade:'Castanhal/PA', telefone:'(91) 98444-1212', tipoLogradouro:'rua', logradouro:'Domingos Marreiros', numero:'88', municipio:'Belém' },
      triagem:{ risco:'amarelo', pa:'140/90', fc:'96', temp:'36.7', spo2:'98', queixa:'Dor lombar intensa à direita', alergias:[] },
      consulta:{ medico:'Paulo Mendes — CRM-PA 12345', medicoId:3, diagnostico:'Cólica nefrética', plano:'Analgesia e hidratação.', encaminhamento:'ambulatorio',
        prescricao:[{ med:'Dipirona 1g', pos:'EV agora' }, { med:'Escopolamina 20mg', pos:'EV agora' }] },
      observacao:{ checkins:[{ administrado:true, hora:'14:40' }, { administrado:true, hora:'14:45' }], procedimentos:[{ proc:'Hidratação venosa', hora:'14:50' }],
        anotacoes:[{ em:`${dia(3)}T16:00`, texto:'Paciente refere melhora da dor. Liberado com orientações.' }], encaminhamento:'alta', encaminhadoEm:`${dia(3)}T16:20` } },
    { id:16, nome:'Patrícia Gomes', relato:'Dor abdominal e febre', data:dia(6), hora:'09:30', origem:'novo', color:'#f472b6',
      ident:{ cns:'709 2222 4444 6666', cpf:'444.333.222-11', sexo:'F', raca:'01', nasc:'1990-09-17', mae:'Lucia Gomes', naturalidade:'Belém/PA', telefone:'(91) 98555-3434', tipoLogradouro:'avenida', logradouro:'Gentil Bittencourt', numero:'540', municipio:'Belém' },
      triagem:{ risco:'vermelho', pa:'110/70', fc:'112', temp:'38.6', spo2:'97', queixa:'Dor em fossa ilíaca direita com febre', alergias:['Dipirona'] },
      consulta:{ medico:'Helena Rocha — CRM-PA 23456', medicoId:4, diagnostico:'Suspeita de apendicite', plano:'Exames e avaliação cirúrgica.', encaminhamento:'ambulatorio',
        prescricao:[{ med:'Paracetamol 750mg', pos:'VO agora' }] },
      observacao:{ checkins:[{ administrado:true, hora:'10:00' }], anotacoes:[{ em:`${dia(6)}T11:40`, texto:'Sinal de Blumberg positivo. Encaminhada para internação.' }],
        encaminhamento:'internacao', encaminhadoEm:`${dia(6)}T12:00` },
      internacao:{
        aprazamentos:{ 'Cefazolina 1g':{ intervalo:'8', inicio:14 } },
        admissao:{ salvaEm:`${dia(6)}T12:40`, em:`${dia(6)}T12:30`, leito:'feminina-3', carater:'02',
          checkinsMed:[{ administrado:true, hora:'12:45' }],
          campos:{ ac_nome:'Lucia Gomes', ac_telefone:'(91) 98555-3435', ac_parentesco:'pais',
            est_entrada:'deambulando', est_pupilas:'isocoricas', est_fotorreagentes:true, est_consciencia:'orientado', est_autocuidado:'independente',
            ssvv_pa:'110/70', ssvv_temp:'38.4', ssvv_fc:'108', ssvv_spo2:'97', ssvv_fr:'20', antro_peso:'61', antro_altura:'1.63',
            plano_enfermagem:'Jejum, acesso venoso e preparo pré-operatório.', anotacao:'Admitida para apendicectomia, deambulando, consciente e orientada.' } },
        evolucoesEnf:[
          { em:`${dia(6)}T22:00`, profissional:'Joana Lima — COREN-PA 345678-TE', profissionalId:5, acompanhamento:'parcial', administracoes:[{ med:'Cefazolina 1g', horario:'22H', registradoEm:'22:00' }], examesColetados:[],
            ssvv:{ pa:'115/75', temp:'37.4', fc:'92', fr:'18', spo2:'98' }, estado:{ diurese:true, verbalizacao:true, avp:true }, anotacao:'Retornou do centro cirúrgico às 20h, sonolenta, curativo limpo e seco.' },
          { em:`${dia(5)}T08:00`, profissional:'Joana Lima — COREN-PA 345678-TE', profissionalId:5, acompanhamento:'total', administracoes:[], examesColetados:[], ssvv:{ pa:'120/80', temp:'37.1', fc:'88', spo2:'98' }, estado:{ diurese:true, dieta:false, avp:true }, anotacao:'Pós-operatório imediato sem intercorrências.' }],
        evolucoesMed:[
          { em:`${dia(6)}T13:10`, medico:'Helena Rocha — CRM-PA 23456', medicoId:4, diagnostico:'Apendicite aguda', plano:'Apendicectomia videolaparoscópica hoje. Antibioticoprofilaxia.', ssvv:{ pa:'110/70', temp:'38.4', fc:'106' }, estadoPaciente:'Dor em FID, Blumberg positivo.', anotacoes:'',
            prescricao:[{ med:'Cefazolina 1g', pos:'EV 8/8h' }], exames:[{ exame:'Hemograma', obs:'' }] },
          { em:`${dia(5)}T10:00`, medico:'Helena Rocha — CRM-PA 23456', medicoId:4, diagnostico:'Apendicite aguda', plano:'Apendicectomia realizada. Manter analgesia.', ssvv:{}, estadoPaciente:'Estável.', anotacoes:'', prescricao:[], exames:[] }],
        saida:{ em:`${dia(2)}T10:00`, medico:'Helena Rocha — CRM-PA 23456', medicoId:4, motivo:'12', cid:'K359', cidDescricao:'Apendicite aguda sem outra especificação', procCodigo:'0407020039', procDescricao:'APENDICECTOMIA' },
      } },
    { id:17, nome:'José Carvalho', relato:'Transferido da UPA com dispneia', data:dia(45), hora:'22:15', origem:'transferencia', destinoTransf:'enfermaria', color:'#a78bfa',
      ident:{ cns:'705 3333 5555 7777', sexo:'M', raca:'03', nasc:'1946-01-30', mae:'Joana Carvalho', naturalidade:'Cametá/PA', tipoLogradouro:'rua', logradouro:'Tamoios', numero:'12', municipio:'Belém' },
      triagem:{}, consulta:{ medico:'Paulo Mendes — CRM-PA 12345', medicoId:3, diagnostico:'Insuficiência cardíaca descompensada', plano:'Diurético EV e monitorização.', encaminhamento:'enfermaria' },
      internacao:{
        admissao:{ salvaEm:`${dia(45)}T23:00`, em:`${dia(45)}T22:50`, leito:'masculina-5', carater:'02', campos:{} },
        evolucoesEnf:[], evolucoesMed:[],
        saida:{ em:`${dia(38)}T06:30`, medico:'Paulo Mendes — CRM-PA 12345', medicoId:3, motivo:'41', cid:'I500', cidDescricao:'Insuficiência cardíaca congestiva', procCodigo:'0303060212', procDescricao:'TRATAMENTO DE INSUFICIENCIA CARDIACA' },
      } },
    { id:18, nome:'Sandra Reis', relato:'Transferida para exames de rotina pré-operatória', data:dia(5), hora:'10:00', origem:'transferencia', destinoTransf:'exames', color:'#00c9a7',
      ident:{ cns:'708 4444 6666 8888', cpf:'555.444.333-22', sexo:'F', raca:'03', nasc:'1983-06-11', mae:'Cecília Reis', tipoLogradouro:'travessa', logradouro:'Lomas Valentinas', municipio:'Belém' },
      triagem:{}, consulta:{}, telemedicina:{},
      exames:{ solicitacoes:[{ exame:'Hemograma completo', obs:'' }, { exame:'Coagulograma', obs:'' }, { exame:'ECG', obs:'' }], enviadoEm:`${dia(5)}T10:25` } },
    { id:19, nome:'Bruno Lopes', relato:'Teleconsulta de retorno ortopédico', data:dia(33), hora:'14:30', origem:'transferencia', destinoTransf:'telemedicina', color:'#fb923c',
      ident:{ cns:'701 5555 7777 9999', sexo:'M', raca:'02', nasc:'1995-12-03', mae:'Rosana Lopes', tipoLogradouro:'rua', logradouro:'Mundurucus', municipio:'Belém' },
      triagem:{}, consulta:{}, exames:{}, telemedicina:{ registradoEm:`${dia(33)}T15:05` } },
    ...seedFinalizadosEnfermaria(),
  ].map(autoriaExemplo);
}

// 12 internações com saída no mês corrente e ainda sem número de AIH (testes de "Gerar AIHs", laudos e AIHs do mês)
function seedFinalizadosEnfermaria() {
  const hoje = new Date();
  // dia "d" do mês corrente (no máximo ontem), recuado "menos" dias
  const noMes = (d, menos = 0) => isoDate(new Date(hoje.getFullYear(), hoje.getMonth(), Math.max(1, Math.min(d, hoje.getDate() - 1)) - menos));
  const hm = (hora, min) => { const [h, m] = hora.split(':').map(Number), t = (h * 60 + m + min + 1440) % 1440; return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
  const MED = { 3: 'Paulo Mendes — CRM-PA 12345', 4: 'Helena Rocha — CRM-PA 23456' };
  const ENF = 'Joana Lima — COREN-PA 345678-TE';
  const MUN = {
    belem: ['Belém', '1501402', '66000-000', 'PA'], ananindeua: ['Ananindeua', '1500800', '67030-000', 'PA'], marituba: ['Marituba', '1504422', '67200-000', 'PA'],
    castanhal: ['Castanhal', '1502400', '68740-000', 'PA'], benevides: ['Benevides', '1501501', '68795-000', 'PA'],
  };
  const P = [
    { nome:'Raimundo Nonato Sousa', sexo:'M', raca:'03', nasc:'1949-03-22', mae:'Maria das Dores Sousa', nat:'Vigia/PA', cpf:'612.345.870-11', cns:'701 4021 3354 0012', mun:'belem', cep:'66087-010',
      end:['travessa', 'Barão do Triunfo', '220', 'Pedreira'], tel:'(91) 98123-4501', acomp:['Raimunda Sousa', 'filho', '(91) 98123-4502'],
      relato:'Febre e falta de ar há 3 dias', queixa:'Tosse produtiva, febre e dispneia', risco:'laranja', sv:['150/90', '104', '38.7', '91', '24'],
      med:3, diag:'Pneumonia bacteriana', plano:'Ceftriaxona EV, oxigenoterapia e controle radiológico.', presc:[['Ceftriaxona 1g', 'EV 12/12h'], ['Dipirona 1g', 'EV 6/6h se febre']], exames:['Hemograma', 'Raio-X de tórax', 'PCR'],
      leito:'masculina-1', carater:'02', dias:5, saida:2, hora:'08:10', motivo:'12', cid:'J189', cidDesc:'Pneumonia não especificada', proc:'0303140151', procDesc:'TRATAMENTO DE PNEUMONIAS OU INFLUENZA (GRIPE)' },
    { nome:'Edna Maria Pinheiro', sexo:'F', raca:'03', nasc:'1957-08-14', mae:'Joana Pinheiro', nat:'Belém/PA', cpf:'523.410.982-07', cns:'702 8811 4520 0034', mun:'ananindeua',
      end:['rua', 'Cláudio Sanders', '1450', 'Centro'], tel:'(91) 98234-1102', acomp:['Paulo Pinheiro', 'filho', '(91) 98234-1103'],
      relato:'Inchaço nas pernas e cansaço', queixa:'Dispneia aos pequenos esforços e edema de membros inferiores', risco:'amarelo', sv:['170/100', '98', '36.6', '93', '22'],
      med:3, diag:'Insuficiência cardíaca descompensada', plano:'Furosemida EV, restrição hídrica e controle de peso diário.', presc:[['Furosemida 40mg', 'EV 12/12h'], ['Enalapril 10mg', 'VO 12/12h']], exames:['ECG', 'Raio-X de tórax', 'Ureia e creatinina'],
      leito:'feminina-1', carater:'02', dias:6, saida:4, hora:'21:40', motivo:'14', cid:'I500', cidDesc:'Insuficiência cardíaca congestiva', proc:'0303060212', procDesc:'TRATAMENTO DE INSUFICIENCIA CARDIACA' },
    { nome:'Francisco das Chagas Lima', sexo:'M', raca:'02', nasc:'1944-11-02', mae:'Antônia Lima', nat:'Bragança/PA', cpf:'214.587.330-90', cns:'703 2290 6612 0045', mun:'belem', cep:'66615-005',
      end:['rua', 'São Pedro', '33', 'Tapanã'], tel:'(91) 98345-2203', acomp:['Francisca Lima', 'filho', '(91) 98345-2204'],
      relato:'Perda de força no lado direito do corpo', queixa:'Hemiparesia à direita e dificuldade para falar há 2 horas', risco:'vermelho', sv:['190/110', '88', '36.4', '95', '18'],
      med:4, diag:'Acidente vascular cerebral', plano:'Controle pressórico, TC de crânio e avaliação neurológica.', presc:[['Captopril 25mg', 'VO 8/8h'], ['AAS 100mg', 'VO 1x/dia']], exames:['TC de crânio', 'Glicemia', 'Hemograma'],
      leito:'masculina-3', carater:'02', dias:8, saida:5, hora:'15:20', motivo:'41', cid:'I64', cidDesc:'Acidente vascular cerebral, não especificado como hemorrágico ou isquêmico', proc:'0303040149', procDesc:'TRATAMENTO DE ACIDENTE VASCULAR CEREBRAL - AVC (ISQUEMICO OU HEMORRAGICO AGUDO)' },
    { nome:'Josefa Rodrigues Nunes', sexo:'F', raca:'01', nasc:'1962-05-30', mae:'Benedita Rodrigues', nat:'Cametá/PA', cpf:'365.902.114-28', cns:'704 5532 1098 0056', mun:'marituba',
      end:['avenida', 'Dom Vicente Zico', '780', 'Centro'], tel:'(91) 98456-3304', acomp:['Carlos Nunes', 'conjuge', '(91) 98456-3305'],
      relato:'Muita sede, fraqueza e glicose alta', queixa:'Polidipsia, poliúria e glicemia capilar de 480 mg/dL', risco:'laranja', sv:['130/80', '110', '36.9', '97', '22'],
      med:4, diag:'Diabetes mellitus descompensado', plano:'Hidratação venosa, insulinoterapia e glicemia capilar de 2/2h.', presc:[['Insulina regular', 'SC conforme glicemia'], ['Soro fisiológico 0,9% 1000ml', 'EV 8/8h']], exames:['Glicemia', 'Gasometria', 'Eletrólitos'],
      leito:'feminina-2', carater:'02', dias:4, saida:7, hora:'10:05', motivo:'12', cid:'E117', cidDesc:'Diabetes mellitus não-insulino-dependente - com complicações múltiplas', proc:'0303030038', procDesc:'TRATAMENTO DE DIABETES MELLITUS' },
    { nome:'Kauã Silva Moraes', sexo:'M', raca:'03', nasc:'2021-07-19', mae:'Jéssica Silva Moraes', nat:'Belém/PA', cpf:'', cns:'898 0045 7781 0067', mun:'belem', cep:'66625-110',
      end:['passagem', 'Santa Maria', '15', 'Bengui'], tel:'(91) 98567-4405', acomp:['Jéssica Silva Moraes', 'pais', '(91) 98567-4405'],
      relato:'Diarreia e vômitos desde ontem', queixa:'Diarreia líquida, vômitos e recusa alimentar', risco:'amarelo', sv:['', '132', '38.1', '98', '30'],
      med:3, diag:'Gastroenterite aguda com desidratação', plano:'Hidratação venosa, antiemético e reavaliação do estado de hidratação.', presc:[['Soro de reidratação EV', 'conforme peso'], ['Ondansetrona 2mg', 'EV 8/8h se vômitos']], exames:['Hemograma', 'Eletrólitos'],
      leito:'pediatrica-1', carater:'02', dias:3, saida:8, hora:'19:30', motivo:'11', cid:'A09', cidDesc:'Diarréia e gastroenterite de origem infecciosa presumível', proc:'0303010061', procDesc:'TRATAMENTO DE DOENCAS INFECCIOSAS INTESTINAIS' },
    { nome:'Ana Clara Ferreira', sexo:'F', raca:'01', nasc:'2017-02-08', mae:'Priscila Ferreira', nat:'Castanhal/PA', cpf:'', cns:'898 0078 1123 0078', mun:'castanhal',
      end:['rua', 'Primeiro de Maio', '402', 'Nova Olinda'], tel:'(91) 98678-5506', acomp:['Priscila Ferreira', 'pais', '(91) 98678-5506'],
      relato:'Febre alta e cansaço para respirar', queixa:'Febre há 4 dias, tosse e tiragem subcostal', risco:'laranja', sv:['', '128', '39.0', '92', '36'],
      med:4, diag:'Pneumonia', plano:'Ampicilina EV, nebulização e oxigênio se SpO2 < 92%.', presc:[['Ampicilina 500mg', 'EV 6/6h'], ['Paracetamol gotas', 'VO 6/6h se febre']], exames:['Hemograma', 'Raio-X de tórax'],
      leito:'pediatrica-2', carater:'02', dias:5, saida:10, hora:'09:15', motivo:'12', cid:'J189', cidDesc:'Pneumonia não especificada', proc:'0303140151', procDesc:'TRATAMENTO DE PNEUMONIAS OU INFLUENZA (GRIPE)' },
    { nome:'Luciana Batista Costa', sexo:'F', raca:'03', nasc:'1996-10-11', mae:'Sandra Batista', nat:'Belém/PA', cpf:'741.258.963-04', cns:'705 6643 2210 0089', mun:'belem', cep:'66040-170',
      end:['travessa', 'Curuzu', '1102', 'Marco'], tel:'(91) 98789-6607', acomp:['Rafael Costa', 'conjuge', '(91) 98789-6608'],
      relato:'Gestante de 39 semanas com contrações', queixa:'Contrações regulares a cada 5 minutos, bolsa íntegra', risco:'amarelo', sv:['120/80', '90', '36.7', '99', '18'],
      med:4, diag:'Trabalho de parto', plano:'Acompanhamento do trabalho de parto com partograma.', presc:[['Ocitocina 5UI', 'EV conforme protocolo']], exames:['Tipagem sanguínea', 'VDRL', 'Teste rápido de HIV'],
      leito:'feminina-4', carater:'02', dias:2, saida:12, hora:'03:50', motivo:'61', cid:'O800', cidDesc:'Parto espontâneo cefálico', proc:'0310010039', procDesc:'PARTO NORMAL' },
    { nome:'Daniele Souza Matos', sexo:'F', raca:'02', nasc:'1993-04-25', mae:'Rosilda Souza', nat:'Abaetetuba/PA', cpf:'852.963.741-15', cns:'706 7754 3321 0090', mun:'benevides',
      end:['rua', 'Joaquim Pereira de Queiroz', '56', 'Centro'], tel:'(91) 98890-7708', acomp:['Márcio Matos', 'conjuge', '(91) 98890-7709'],
      relato:'Gestante de 40 semanas com perda de líquido', queixa:'Amniorrexe há 6 horas e apresentação pélvica', risco:'laranja', sv:['130/85', '96', '36.8', '98', '18'],
      med:3, diag:'Gestação a termo com apresentação pélvica', plano:'Cesariana de urgência.', presc:[['Cefazolina 2g', 'EV dose única'], ['Dipirona 1g', 'EV 6/6h']], exames:['Hemograma', 'Tipagem sanguínea', 'Coagulograma'],
      leito:'feminina-5', carater:'02', dias:3, saida:14, hora:'11:25', motivo:'61', cid:'O321', cidDesc:'Assistência prestada à mãe por apresentação pélvica', proc:'0411010034', procDesc:'PARTO CESARIANO' },
    { nome:'Marcelo Augusto Pantoja', sexo:'M', raca:'03', nasc:'1987-01-17', mae:'Lúcia Pantoja', nat:'Belém/PA', cpf:'963.852.741-26', cns:'707 8865 4432 0001', mun:'belem', cep:'66095-000',
      end:['avenida', 'Pedro Miranda', '1890', 'Pedreira'], tel:'(91) 98901-8809', acomp:['Lúcia Pantoja', 'filho', '(91) 98901-8810'],
      relato:'Dor na barriga do lado direito', queixa:'Dor em fossa ilíaca direita há 18 horas, náuseas e febre', risco:'laranja', sv:['125/80', '102', '38.2', '98', '20'],
      med:4, diag:'Apendicite aguda', plano:'Apendicectomia, jejum e antibioticoprofilaxia.', presc:[['Cefazolina 1g', 'EV 8/8h'], ['Tramadol 100mg', 'EV 8/8h se dor']], exames:['Hemograma', 'Ultrassonografia de abdome'],
      leito:'masculina-4', carater:'02', dias:3, saida:15, hora:'16:45', motivo:'12', cid:'K359', cidDesc:'Apendicite aguda sem outra especificação', proc:'0407020039', procDesc:'APENDICECTOMIA' },
    { nome:'Terezinha de Jesus Alves', sexo:'F', raca:'03', nasc:'1970-12-08', mae:'Ana de Jesus', nat:'Santarém/PA', cpf:'159.753.486-37', cns:'708 9976 5543 0012', mun:'ananindeua',
      end:['rua', 'Três Corações', '310', 'Cidade Nova'], tel:'(91) 98012-9910', acomp:['Fábio Alves', 'filho', '(91) 98012-9911'],
      relato:'Internação eletiva para retirada da vesícula', queixa:'Cólicas biliares de repetição', risco:'verde', sv:['130/80', '76', '36.5', '99', '16'],
      med:4, diag:'Colelitíase', plano:'Colecistectomia eletiva.', presc:[['Cefazolina 2g', 'EV na indução'], ['Dipirona 1g', 'EV 6/6h']], exames:['Hemograma', 'Coagulograma', 'Ultrassonografia de abdome'],
      leito:'feminina-6', carater:'01', dias:3, saida:17, hora:'07:30', motivo:'11', cid:'K802', cidDesc:'Calculose da vesícula biliar sem colecistite', proc:'0407030026', procDesc:'COLECISTECTOMIA' },
    { nome:'Sebastião Corrêa Neto', sexo:'M', raca:'01', nasc:'1955-06-03', mae:'Iracema Corrêa', nat:'Belém/PA', cpf:'357.159.852-48', cns:'709 1187 6654 0023', mun:'belem', cep:'66050-000',
      end:['avenida', 'Conselheiro Furtado', '2450', 'Cremação'], tel:'(91) 98123-0011', acomp:['Maria Corrêa', 'conjuge', '(91) 98123-0012'],
      relato:'Internação eletiva para correção de hérnia', queixa:'Abaulamento em região inguinal direita', risco:'verde', sv:['140/85', '80', '36.4', '98', '16'],
      med:3, diag:'Hérnia inguinal direita', plano:'Hernioplastia inguinal eletiva.', presc:[['Cefazolina 2g', 'EV na indução'], ['Cetoprofeno 100mg', 'EV 12/12h']], exames:['Hemograma', 'Coagulograma', 'ECG'],
      leito:'masculina-6', carater:'01', dias:2, saida:19, hora:'08:00', motivo:'12', cid:'K409', cidDesc:'Hérnia inguinal unilateral ou não especificada, sem obstrução ou gangrena', proc:'0407040129', procDesc:'HERNIOPLASTIA INGUINAL / CRURAL (UNILATERAL)' },
    { nome:'Benedito Farias Gomes', sexo:'M', raca:'02', nasc:'1968-09-27', mae:'Joaquina Farias', nat:'Marabá/PA', cpf:'486.357.159-59', cns:'700 2298 7765 0034', mun:'castanhal',
      end:['travessa', 'Quintino Bocaiúva', '88', 'Santa Lídia'], tel:'(91) 98234-1122', acomp:['Rosa Gomes', 'conjuge', '(91) 98234-1123'],
      relato:'Febre e ardência ao urinar', queixa:'Disúria, febre e dor lombar à esquerda', risco:'amarelo', sv:['110/70', '108', '38.9', '96', '20'],
      med:3, diag:'Pielonefrite aguda', plano:'Ceftriaxona EV e hidratação; urocultura.', presc:[['Ceftriaxona 1g', 'EV 12/12h'], ['Dipirona 1g', 'EV 6/6h se febre']], exames:['Urina tipo 1', 'Urocultura', 'Hemograma'],
      leito:'masculina-7', carater:'02', dias:4, saida:21, hora:'14:00', motivo:'10', cid:'N390', cidDesc:'Infecção do trato urinário de localização não especificada', proc:'0303150050', procDesc:'TRATAMENTO DE OUTRAS DOENCAS DO APARELHO URINARIO' },
  ];
  return P.map((p, n) => {
    const [municipio, ibge, cepMun, uf] = MUN[p.mun];
    const entrada = noMes(p.saida, p.dias), fim = noMes(p.saida), seguinte = noMes(p.saida, p.dias - 1);
    const horaEnt = ['07:20', '09:45', '13:10', '17:35', '20:05', '10:30'][n % 6];
    const horaAdm = hm(horaEnt, 70);
    const [pa, fc, temp, spo2, fr] = p.sv;
    const prescricao = p.presc.map(([med, pos]) => ({ med, pos }));
    const pediatrico = p.leito.startsWith('pediatrica');
    return {
      id: 20 + n, nome: p.nome, relato: p.relato, data: entrada, hora: horaEnt, origem: 'novo', color: ['#3a7bd5', '#f472b6', '#00c9a7', '#a78bfa', '#fb923c', '#ff6b6b'][n % 6],
      ident: { cns: p.cns, cpf: p.cpf, prontuario: String(5021 + n), sexo: p.sexo, raca: p.raca, nasc: p.nasc, mae: p.mae, naturalidade: p.nat, telefone: p.tel,
        tipoLogradouro: p.end[0], logradouro: p.end[1], numero: p.end[2], bairro: p.end[3], cep: p.cep || cepMun, municipio, uf, ibge },
      triagem: { risco: p.risco, pa, fc, temp, spo2, queixa: p.queixa, alergias: n % 4 === 1 ? ['Dipirona'] : [] },
      consulta: { medico: MED[p.med], medicoId: p.med, diagnostico: p.diag, plano: p.plano, encaminhamento: 'enfermaria', prescricao, exames: p.exames.map(exame => ({ exame, obs: '' })) },
      internacao: {
        aprazamentos: { [p.presc[0][0]]: { intervalo: '12', inicio: Number(horaAdm.slice(0, 2)) } },
        admissao: { salvaEm: `${entrada}T${hm(horaAdm, 15)}`, em: `${entrada}T${horaAdm}`, leito: p.leito, carater: p.carater,
          checkinsMed: prescricao.map((_, k) => ({ administrado: k === 0, hora: k === 0 ? hm(horaAdm, 20) : '' })),
          checkinsExame: p.exames.map(() => ({ administrado: true, hora: hm(horaAdm, 10) })),
          campos: { ac_nome: p.acomp[0], ac_parentesco: p.acomp[1], ac_telefone: p.acomp[2],
            est_entrada: pediatrico ? 'outros' : p.carater === '01' ? 'deambulando' : 'cadeira', est_pupilas: 'isocoricas', est_fotorreagentes: true,
            est_consciencia: 'orientado', est_autocuidado: pediatrico ? 'dependente' : 'parcial',
            ssvv_pa: pa, ssvv_temp: temp, ssvv_fc: fc, ssvv_spo2: spo2, ssvv_fr: fr,
            plano_enfermagem: 'Controle de sinais vitais de 6/6h, acesso venoso pérvio e cuidados conforme prescrição.',
            anotacao: `Paciente admitido(a) no leito para ${p.diag.toLowerCase()}, consciente, acompanhado(a) por ${p.acomp[0]}.` } },
        evolucoesEnf: [
          { em: `${entrada}T22:00`, profissional: ENF, profissionalId: 5, acompanhamento: 'parcial', administracoes: [{ med: p.presc[0][0], horario: '22H', registradoEm: '22:00' }], examesColetados: p.exames.slice(0, 1),
            ssvv: { pa, temp, fc, fr, spo2 }, estado: { diurese: true, verbalizacao: !pediatrico, avp: true }, anotacao: 'Paciente estável no plantão, medicação administrada conforme aprazamento.' },
          { em: `${fim}T${hm(p.hora, -120)}`, profissional: ENF, profissionalId: 5, acompanhamento: 'total', administracoes: [], examesColetados: [],
            ssvv: { pa: pa && '120/80', temp: '36.6', fc: String(Math.max(80, Number(fc) - 20)), spo2: '98' }, estado: { diurese: true, evacuacao: true, dieta: true, avp: true },
            anotacao: 'Evolui sem queixas, aceitando dieta, aguardando avaliação médica.' }],
        evolucoesMed: [
          { em: `${seguinte}T10:00`, medico: MED[p.med], medicoId: p.med, diagnostico: p.diag, plano: p.plano, ssvv: { pa, temp, fc }, estadoPaciente: 'Estável, em tratamento.', anotacoes: '', prescricao: [], exames: [] }],
        saida: { em: `${fim}T${p.hora}`, medico: MED[p.med], medicoId: p.med, motivo: p.motivo, cid: p.cid, cidDescricao: p.cidDesc, procCodigo: p.proc, procDescricao: p.procDesc },
      },
    };
  });
}

// autoria dos registros de exemplo: recepção abre a entrada, enfermagem tria e evolui, o médico consulta e dá a saída
function autoriaExemplo(a) {
  const P = Object.fromEntries(seedProfissionais().map(p => [p.id, { id: p.id, nome: p.nome, cargo: p.cargo, conselho: conselhoLabel(p) }]));
  const RECEPCAO = P[2], ENFERMAGEM = P[5];
  const medico = x => P[x?.medicoId] || P[a.consulta?.medicoId] || P[3];
  const mais = (iso, min) => { const d = new Date(iso); d.setMinutes(d.getMinutes() + min); return `${isoDate(d)}T${isoTime(d)}`; };
  const marca = (por, em) => ({ criado: { por, em } });
  const tem = o => o && Object.keys(chaveConteudo(o)).length;
  const inicio = `${a.data}T${a.hora}`;

  a.reg = marca(RECEPCAO, inicio);
  if (tem(a.ident)) a.ident.reg = marca(RECEPCAO, mais(inicio, 3));
  if (tem(a.triagem)) a.triagem.reg = marca(ENFERMAGEM, mais(inicio, 8));
  if (tem(a.consulta)) a.consulta.reg = marca(medico(), mais(inicio, 25));
  if (a.exames?.enviadoEm) a.exames.reg = marca(RECEPCAO, a.exames.enviadoEm);
  if (a.telemedicina?.registradoEm) a.telemedicina.reg = marca(RECEPCAO, a.telemedicina.registradoEm);
  const ck = c => (c?.administrado ? { ...c, por: ENFERMAGEM, em: `${a.data}T${c.hora}` } : c);
  const o = a.observacao;
  if (o) {
    o.checkins = (o.checkins || []).map(ck);
    o.procedimentos = (o.procedimentos || []).map(p => ({ ...p, por: ENFERMAGEM, em: `${a.data}T${p.hora}` }));
    o.anotacoes = (o.anotacoes || []).map(n => ({ ...n, por: ENFERMAGEM }));
    if (o.encaminhamento) o.encaminhadoPor = medico();
  }
  const i = a.internacao;
  if (i) {
    const adm = i.admissao;
    if (adm) {
      adm.reg = marca(ENFERMAGEM, adm.salvaEm);
      const dia = adm.em.slice(0, 10);
      ['checkinsMed', 'checkinsExame'].forEach(k => { if (adm[k]) adm[k] = adm[k].map(c => (c.administrado ? { ...c, por: ENFERMAGEM, em: `${dia}T${c.hora}` } : c)); });
      Object.values(i.aprazamentos || {}).forEach(ap => Object.assign(ap, { por: ENFERMAGEM, em: adm.salvaEm }));
    }
    (i.evolucoesEnf || []).forEach(e => Object.assign(e, { por: P[e.profissionalId] || ENFERMAGEM, salvoEm: e.em }));
    (i.evolucoesMed || []).forEach(e => Object.assign(e, { por: medico(e), salvoEm: e.em }));
    if (i.saida) i.saida.por = medico(i.saida);
  }
  return a;
}

// ===== ARMAZENAMENTO =====
// os atendimentos ficam no localStorage, compartilhados entre as páginas deste navegador
const Store = (() => {
  // v4: autoria (profissional e horário) em cada registro; uma versão nova recomeça dos dados de exemplo
  const KEY = 'clinbot:atendimentos:v4';
  let memoria = null; // usado se o localStorage não estiver disponível

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function write(list) {
    memoria = list;
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* segue só em memória */ }
  }

  function all() {
    const list = read() || memoria;
    if (list) return list;
    const seed = seedAtendimentos();
    write(seed);
    return seed;
  }

  // mescla com o registro salvo para não perder dados gravados por outra página
  function upsert(atend) {
    const list = all();
    const idx = list.findIndex(a => a.id === atend.id);
    if (idx >= 0) list[idx] = { ...list[idx], ...atend };
    else list.push(atend);
    write(list);
  }

  function remove(id) {
    write(all().filter(a => a.id !== id));
  }

  function nextId() {
    return Math.max(0, ...all().map(a => a.id)) + 1;
  }

  // volta aos dados de exemplo (útil para testes: Store.reset() no console)
  function reset() {
    write(seedAtendimentos());
  }

  // avisa quando outra aba/página alterar os dados
  function onChange(cb) {
    window.addEventListener('storage', e => { if (e.key === KEY) cb(); });
  }

  return { all, upsert, remove, nextId, reset, onChange };
})();

// ===== CADASTROS (hospital, profissionais, faixas de AIH) =====
// valor único guardado no localStorage, com dados de exemplo na primeira vez
function armazenar(KEY, seed) {
  let memoria = null;
  const ler = () => { try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };
  const gravar = v => { memoria = v; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* segue só em memória */ } };
  const get = () => { const v = ler() ?? memoria; if (v) return v; const s = seed(); gravar(s); return s; };
  return {
    get, set: gravar, reset: () => gravar(seed()),
    onChange: cb => window.addEventListener('storage', e => { if (e.key === KEY) cb(); }),
  };
}

// lista de registros com id numérico
function colecao(KEY, seed) {
  const a = armazenar(KEY, seed);
  return {
    all: a.get,
    get: id => a.get().find(x => x.id === id) || null,
    upsert(item) {
      const lista = a.get();
      const i = lista.findIndex(x => x.id === item.id);
      if (i >= 0) lista[i] = { ...lista[i], ...item }; else lista.push(item);
      a.set(lista);
    },
    remove(id) { a.set(a.get().filter(x => x.id !== id)); },
    nextId: () => Math.max(0, ...a.get().map(x => x.id)) + 1,
    reset: a.reset, onChange: a.onChange,
  };
}

function seedHospital() {
  return {
    nome: 'Hospital Municipal H-SUS', cnes: '0000000',
    logradouro: 'Avenida Almirante Barroso', numero: '1000', bairro: 'Marco', cep: '66093-020', cidade: 'Belém', uf: 'PA',
    aih: { dirNome: 'Helena Rocha', dirDocTipo: 'cns', dirDoc: '', autNome: '', autCpf: '', autCns: '', orgaoAutorizador: '' },
    alas: [
      { id: 'masculina',  nome: 'Masculina',  publico: 'masculino',  leitos: 10 },
      { id: 'feminina',   nome: 'Feminina',   publico: 'feminino',   leitos: 10 },
      { id: 'pediatrica', nome: 'Pediátrica', publico: 'pediatrico', leitos: 6 },
    ],
  };
}

// Usuários de exemplo — todos com a senha de teste "clinbot@2026" (guardada só como hash).
// admin (Administrador) · alice (Recepção) · paulo.mendes e helena.rocha (Médico) · joana.lima (Enfermagem) · marta.souza (inativa)
function seedProfissionais() {
  const p = (id, nome, login, cargo, cbo, nivel, salt, hash, extra = {}) =>
    ({ id, nome, login, cargo, cbo, nivel, status: 'ativo', cns: '', cpf: '', conselho: '', conselhoNumero: '', conselhoUF: '', senhaSalt: salt, senhaHash: hash, ...extra });
  const conselho = (sigla, numero) => ({ conselho: sigla, conselhoNumero: numero, conselhoUF: 'PA' });
  return [
    p(1, 'Administrador do Sistema', 'admin', 'Administrador do sistema', '', 'administrador',
      'a3e5b15419f4d287', '67d18615c74315d1619a0726871a6a6f596c96aa9da22972e82eab154270067d'),
    p(2, 'Alice Lins', 'alice', 'Recepcionista', '422105', 'recepcao',
      '45a4b88d5a149830', 'dc3ff68fa0c6709c59900341e9e1b5b2dd8053ddd5bf7d717503f4bbc09e6025', { cpf: '123.456.789-09' }),
    p(3, 'Paulo Mendes', 'paulo.mendes', 'Médico clínico', '225125', 'medico',
      '743f23ab4cdf34fd', 'e4f7bb5788bf3478165b792faaae1272a589895548491db4db6ad2ddeff219bc', { cns: '700 1234 5678 9012', ...conselho('CRM', '12345') }),
    p(4, 'Helena Rocha', 'helena.rocha', 'Médico clínico', '225125', 'medico',
      'c7efb986e6513347', '3ef124adfdf69d37c3a09e542cdcc1d9506fa773fc973bf19e68b0ed4135a86f', conselho('CRM', '23456')),
    p(5, 'Joana Lima', 'joana.lima', 'Técnico de enfermagem', '322205', 'enfermagem',
      '5e310d26affdaea4', 'd1adfad9b67bb96cc028474b740a2d00b4a30d6663e5a08fbcf626c2703a173f', conselho('COREN', '345678-TE')),
    p(6, 'Marta Souza', 'marta.souza', 'Técnico de enfermagem', '322205', 'enfermagem',
      '86e8da00246bdad5', '7b5937a93901914fa543c3278052f45898b22791bbfec566927ca2def9e6a46a', { status: 'inativo', ...conselho('COREN', '456789-TE') }),
  ];
}

// faixas como o gestor as envia: 12 dígitos (sem o dígito verificador), ex.: 152410112417 a 152410113234
function seedFaixasAih() {
  const ano = new Date().getFullYear(), aa = n => String(n % 100).padStart(2, '0');
  const municipio = '150175 Brejo Grande do Araguaia';
  return [
    { id: 1, municipio, vigenciaInicio: `${ano - 1}-01-01`, vigenciaFim: `${ano - 1}-12-31`, inicio: `15${aa(ano - 1)}10112417`, final: `15${aa(ano - 1)}10113234`, ultimo: `15${aa(ano - 1)}10113234` },
    { id: 2, municipio, vigenciaInicio: `${ano}-01-01`, vigenciaFim: `${ano}-12-31`, inicio: `15${aa(ano)}10112417`, final: `15${aa(ano)}10113234`, ultimo: '' },
  ];
}

const Hospital      = armazenar('clinbot:hospital:v1', seedHospital);
// v2: registro no conselho; quem já tinha cadastro na v1 continua com ele (os exemplos ganham o conselho)
function seedProfissionaisV2() {
  const base = seedProfissionais();
  let v1 = null;
  try { v1 = JSON.parse(localStorage.getItem('clinbot:profissionais:v1')); } catch (e) { /* sem cadastro antigo */ }
  if (!Array.isArray(v1)) return base;
  return v1.map(p => {
    const b = base.find(x => x.id === p.id && x.login === p.login);
    return b ? { conselho: b.conselho, conselhoNumero: b.conselhoNumero, conselhoUF: b.conselhoUF, ...p } : p;
  });
}
const Profissionais = colecao('clinbot:profissionais:v2', seedProfissionaisV2);
// v2: faixas com 12 dígitos; o número da AIH ganha o dígito verificador na geração
const FaixasAih     = colecao('clinbot:faixas-aih:v2', seedFaixasAih);
// números de AIH cancelados, reaproveitados (os mais antigos primeiro) antes de avançar na faixa
const AihsLiberadas = armazenar('clinbot:aih-liberadas:v1', () => []);

// ===== PROFISSIONAIS E AUTORIA DOS REGISTROS =====
// "CRM-PA 23456"
const conselhoLabel = p => (p?.conselho && p.conselhoNumero ? `${p.conselho}${p.conselhoUF ? '-' + p.conselhoUF : ''} ${p.conselhoNumero}` : '');
// "Helena Rocha — CRM-PA 23456" (texto guardado nos campos de profissional responsável)
const profissionalLabel = p => [p.nome, conselhoLabel(p)].filter(Boolean).join(' — ');

// retrato de quem está logado no momento do registro: nome, cargo e conselho ficam gravados no
// próprio registro, então uma mudança posterior no cadastro não altera o que foi assinado
function autorAtual() {
  const s = sessaoAtual();
  if (!s) return null;
  const p = Profissionais.get(s.id) || s;
  return { id: p.id, nome: p.nome, cargo: p.cargo || '', conselho: conselhoLabel(p) };
}
const marcaAutoria = () => ({ por: autorAtual(), em: agora() });

// editar ou anular um registro: só quem o lançou ou o administrador
function podeAlterarRegistro(reg) {
  const s = sessaoAtual();
  return !!s && (s.nivel === 'administrador' || (reg?.por?.id != null && reg.por.id === s.id));
}
// evoluções anuladas continuam no prontuário, mas não contam em doses, prescrições, exames e totais
const evolucoesValidas = lista => (lista || []).filter(e => !e.anulada);

// conteúdo comparável de um bloco: sem a autoria, sem campos vazios e com as chaves em ordem
function chaveConteudo(v) {
  if (Array.isArray(v)) return v.map(chaveConteudo);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((o, k) => {
      if (k === 'reg') return o;
      const x = chaveConteudo(v[k]);
      const vazio = x === '' || x == null || x === false || (Array.isArray(x) ? !x.length : typeof x === 'object' && !Object.keys(x).length);
      if (!vazio) o[k] = x;
      return o;
    }, {});
  }
  return typeof v === 'string' ? v.trim() : v;
}
const mesmoConteudo = (a, b) => JSON.stringify(chaveConteudo(a || {})) === JSON.stringify(chaveConteudo(b || {}));

// autoria de um bloco de dados: { criado: {por, em}, alteracoes: [{por, em}] }
// nada mudou -> mantém a autoria; bloco ainda vazio -> sem autoria
function autoria(novo, anterior, reg) {
  if (reg && mesmoConteudo(novo, anterior)) return reg;
  if (!reg) return Object.keys(chaveConteudo(novo || {})).length ? { criado: marcaAutoria() } : undefined;
  return { ...reg, alteracoes: [...(reg.alteracoes || []), marcaAutoria()] };
}

// lista regravada inteira a cada salvamento (ex.: procedimentos): itens que já existiam mantêm a autoria
function manterAutoria(itens, anteriores) {
  const restantes = [...(anteriores || [])];
  const semAutoria = x => ({ ...x, por: null, em: null });
  return itens.map(it => {
    const i = restantes.findIndex(x => mesmoConteudo(semAutoria(x), semAutoria(it)));
    if (i < 0) return { ...it, ...marcaAutoria() };
    const [x] = restantes.splice(i, 1);
    return { ...it, por: x.por, em: x.em };
  });
}

// <select> de profissional responsável: ativos do(s) nível(is) pedido(s), já com quem está logado
// valor guardado no atendimento: { id, texto }; texto livre de registros antigos continua como opção
function preencherProfissionais(select, { niveis, id = null, texto = '' } = {}) {
  const lista = Profissionais.all().filter(p => p.status === 'ativo' && (!niveis || niveis.includes(p.nivel)));
  const porTexto = texto && lista.find(p => profissionalLabel(p) === texto);
  const sessao = sessaoAtual();
  let escolhido = id ?? porTexto?.id ?? null;
  if (escolhido == null && !texto && lista.some(p => p.id === sessao?.id)) escolhido = sessao.id;
  let html = '<option value="">Selecione o profissional</option>' +
    lista.map(p => `<option value="${p.id}">${esc(profissionalLabel(p))}</option>`).join('');
  const naLista = escolhido != null && lista.some(p => p.id === escolhido);
  if (!naLista && (texto || escolhido != null)) {
    const antigo = escolhido != null ? Profissionais.get(escolhido) : null;
    html += `<option value="registro" data-id="${escolhido ?? ''}">${esc(texto || (antigo ? profissionalLabel(antigo) : ''))}</option>`;
  }
  select.innerHTML = html;
  select.value = naLista ? String(escolhido) : (texto || escolhido != null) ? 'registro' : '';
}
function lerProfissional(select) {
  const opt = select.selectedOptions[0];
  if (!select.value || !opt) return { id: null, texto: '' };
  const id = select.value === 'registro' ? (opt.dataset.id ? Number(opt.dataset.id) : null) : Number(select.value);
  return { id, texto: opt.textContent.trim() };
}

// ===== FAIXAS DE AIH =====
// número da AIH = 12 dígitos da faixa + dígito verificador (resto da divisão por 11; resto 10 vira 0)
const dvAih = base => { const r = Number(base) % 11; return r === 10 ? 0 : r; };
const numeroAih = base => `${base}${dvAih(base)}`;
const proximaBaseAih = f => String(f.ultimo ? Number(f.ultimo) + 1 : Number(f.inicio)).padStart(f.inicio.length, '0');
const faixaDisponiveis = f => Math.max(0, Number(f.final) - Number(f.ultimo || Number(f.inicio) - 1));
function faixaStatus(f, hoje = isoDate(new Date())) {
  if (f.vigenciaFim && hoje > f.vigenciaFim) return 'expirada';
  if (f.vigenciaInicio && hoje < f.vigenciaInicio) return 'futura';
  return faixaDisponiveis(f) ? 'vigente' : 'esgotada';
}

// próximo número de AIH: primeiro um número cancelado (liberado); senão o seguinte da faixa vigente
function reservarNumeroAih() {
  const liberados = AihsLiberadas.get();
  if (liberados.length) {
    const [primeiro, ...resto] = liberados;
    AihsLiberadas.set(resto);
    return primeiro.numero;
  }
  const faixa = FaixasAih.all().find(f => faixaStatus(f) === 'vigente');
  if (!faixa) return null;
  const base = proximaBaseAih(faixa);
  FaixasAih.upsert({ id: faixa.id, ultimo: base });
  return numeroAih(base);
}

// número da AIH do atendimento: gerado pelo "Gerar AIHs" (Finalizados > Enfermaria) e guardado
function garantirNumeroAih(a) {
  const int = a.internacao || {};
  if (int.aih?.numero) return int.aih.numero;
  const numero = reservarNumeroAih();
  if (!numero) return '';
  int.aih = { numero, geradoEm: agora(), por: autorAtual() };
  Store.upsert({ id: a.id, internacao: int });
  return numero;
}

// responsáveis cadastrados no Hospital para o laudo e a AIH (cadastros antigos tinham um documento só para o autorizador)
function responsaveisAih() {
  const cfg = Hospital.get().aih || {};
  return {
    orgao: cfg.orgaoAutorizador || '',
    diretorDoc: cfg.dirDoc || '', diretorDocTipo: cfg.dirDocTipo || 'cns',
    autorizador: cfg.autNome || '',
    autCpf: cfg.autCpf || (cfg.autDocTipo === 'cpf' ? cfg.autDoc : '') || '',
    autCns: cfg.autCns || (cfg.autDocTipo === 'cns' ? cfg.autDoc : '') || '',
  };
}

// cancela a AIH do atendimento: o número volta para ser reaproveitado e o cancelamento fica no histórico
function cancelarAih(id, motivo) {
  const a = Store.all().find(x => x.id === id);
  const aih = a?.internacao?.aih;
  if (!aih?.numero) return false;
  const marca = marcaAutoria();
  const { aih: _, ...int } = a.internacao;
  int.aihCanceladas = [...(int.aihCanceladas || []), { ...aih, canceladoEm: marca.em, canceladoPor: marca.por, motivo }];
  Store.upsert({ id, internacao: int });
  AihsLiberadas.set([...AihsLiberadas.get(), { numero: aih.numero, liberadoEm: marca.em, atendimentoId: id, motivo }]);
  return true;
}

// ===== SENHAS =====
// hash SHA-256 com salt; protege a senha guardada, mas a validação de verdade deve ficar num servidor
async function hashSenha(senha, salt) {
  const dados = new TextEncoder().encode(`${salt}:${senha}`);
  const digest = await crypto.subtle.digest('SHA-256', dados);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const novoSalt = () => [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');

// ===== SESSÃO E PERFIS DE ACESSO =====
const SESSAO_KEY = 'clinbot:sessao';

// páginas que cada perfil pode usar
const PERFIS = {
  administrador: { nome: 'Administrador', paginas: ['entradas', 'observacao', 'internacoes', 'fin-ambulatorio', 'fin-enfermaria', 'encaminhamentos', 'hospital', 'profissionais', 'tabelas-sus', 'faixas-aih'] },
  medico:        { nome: 'Médico',        paginas: ['entradas', 'observacao', 'internacoes', 'fin-ambulatorio', 'fin-enfermaria', 'encaminhamentos'] },
  enfermagem:    { nome: 'Enfermagem',    paginas: ['entradas', 'observacao', 'internacoes', 'fin-ambulatorio', 'fin-enfermaria', 'encaminhamentos'] },
  recepcao:      { nome: 'Recepção',      paginas: ['entradas', 'encaminhamentos'] },
};

const MENU = [
  { categoria: 'Recepção',    itens: [{ id: 'entradas', href: 'entradas.html', icone: 'person_add', titulo: 'Entradas' }] },
  { categoria: 'Ambulatório', itens: [{ id: 'observacao', href: 'observacao.html', icone: 'eye_tracking', titulo: 'Em observação' }] },
  { categoria: 'Enfermaria',  itens: [{ id: 'internacoes', href: 'internacoes.html', icone: 'home_health', titulo: 'Internações' }] },
  { categoria: 'Finalizados', itens: [
    { id: 'fin-ambulatorio', href: 'finalizados-ambulatorio.html', icone: 'stethoscope', titulo: 'Ambulatório' },
    { id: 'fin-enfermaria',  href: 'finalizados-enfermaria.html',  icone: 'king_bed',    titulo: 'Enfermaria' },
    { id: 'encaminhamentos', href: 'encaminhamentos.html',         icone: 'alt_route',   titulo: 'Encaminhamentos' },
  ] },
  { categoria: 'Cadastros', itens: [
    { id: 'hospital',      href: 'hospital.html',      icone: 'local_hospital',      titulo: 'Hospital' },
    { id: 'profissionais', href: 'profissionais.html', icone: 'badge',               titulo: 'Profissionais' },
    { id: 'tabelas-sus',   href: 'tabelas-sus.html',   icone: 'table_view',          titulo: 'Tabelas SUS' },
    { id: 'faixas-aih',    href: 'faixas-aih.html',    icone: 'confirmation_number', titulo: 'Faixas de AIH' },
  ] },
];

function sessaoAtual() {
  try { return JSON.parse(sessionStorage.getItem(SESSAO_KEY)) || null; } catch (e) { return null; }
}
function iniciarSessao(p) {
  try { sessionStorage.setItem(SESSAO_KEY, JSON.stringify({ id: p.id, nome: p.nome, cargo: p.cargo, nivel: p.nivel })); } catch (e) { /* sem sessão */ }
}
function sair() {
  try { sessionStorage.removeItem(SESSAO_KEY); } catch (e) { /* nada a limpar */ }
  location.href = 'login.html';
}
const podeAcessar = (sessao, pagina) => !!PERFIS[sessao?.nivel]?.paginas.includes(pagina);
const paginaInicial = sessao => MENU.flatMap(c => c.itens).find(i => i.href !== '#' && podeAcessar(sessao, i.id))?.href || 'login.html';

// menu lateral só com o que o perfil pode usar
function renderSidebar(pagina, sessao) {
  const nav = document.querySelector('#sidebar .nav');
  if (!nav) return;
  nav.innerHTML = MENU.map((c, ci) => {
    const itens = c.itens.filter(i => podeAcessar(sessao, i.id));
    if (!itens.length) return '';
    return `<li class="nav-item nav-category ${ci ? 'pt-2' : 'pt-0'}">${c.categoria}</li>` + itens.map(i =>
      `<li class="nav-item ${i.id === pagina ? 'active' : ''}"><a class="nav-link" href="${i.href}">
         <i class="material-symbols-outlined menu-icon">${i.icone}</i><span class="menu-title">${i.titulo}</span></a></li>`).join('');
  }).join('');
}

// nome e cargo de quem entrou, no topo e no menu do perfil
function renderUsuario(sessao) {
  const primeiro = (sessao.nome || '').split(' ')[0];
  document.querySelectorAll('[data-usuario="primeiro-nome"]').forEach(el => el.textContent = primeiro);
  document.querySelectorAll('[data-usuario="nome"]').forEach(el => el.textContent = sessao.nome);
  document.querySelectorAll('[data-usuario="cargo"]').forEach(el => el.textContent = sessao.cargo || PERFIS[sessao.nivel]?.nome || '');
  document.querySelectorAll('[data-acao="sair"]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); sair(); }));
}

// início de toda página interna: exige login e permissão, monta menu, usuário e relógio
function iniciarPagina(pagina) {
  const sessao = sessaoAtual();
  if (!sessao) { location.replace('login.html'); return null; }
  if (!podeAcessar(sessao, pagina)) { location.replace(paginaInicial(sessao)); return null; }
  renderSidebar(pagina, sessao);
  renderUsuario(sessao);
  tickClock();
  setInterval(tickClock, 1000);
  return sessao;
}

// ===== TABELAS DINÂMICAS =====
// cada página define TABELAS = { tbodyId: { campos, placeholders, tipos? } }
function addRow(bodyId, item = {}) {
  const { campos, placeholders, tipos = [] } = TABELAS[bodyId];
  const row = document.createElement('tr');
  row.innerHTML = campos.map((_, i) => `<td><input type="${tipos[i] || 'text'}" class="field-input" placeholder="${placeholders[i]}"></td>`).join('') +
    `<td><button type="button" class="btn-table-delete" onclick="removeRow(this)"><span class="material-symbols-outlined">delete</span></button></td>`;
  row.querySelectorAll('input').forEach((input, i) => { input.value = item[campos[i]] || ''; });
  document.getElementById(bodyId).appendChild(row);
}

function removeRow(btn) {
  const body = btn.closest('tbody');
  if (body.children.length <= 1) {
    btn.closest('tr').querySelectorAll('input').forEach(i => i.value = '');
    return;
  }
  btn.closest('tr').remove();
}

function readTable(bodyId) {
  const { campos } = TABELAS[bodyId];
  return [...document.querySelectorAll(`#${bodyId} tr`)]
    .map(tr => {
      const obj = {};
      tr.querySelectorAll('input').forEach((input, i) => { obj[campos[i]] = input.value.trim(); });
      return obj;
    })
    .filter(obj => obj[campos[0]]);
}

function fillTable(bodyId, list) {
  document.getElementById(bodyId).innerHTML = '';
  (list && list.length ? list : [{}]).forEach(item => addRow(bodyId, item));
}

// ===== AUTOCOMPLETE =====
// lista de sugestões sob um campo (o campo precisa estar dentro de um elemento .ac-wrap)
//   buscar(termo) -> itens   |   desenharItem(item) -> html   |   escolher(item)
//   abrirAoFocar: mostra sugestões ao entrar no campo, mesmo vazio
function autocompletar(input, { buscar, desenharItem, escolher, abrirAoFocar = false }) {
  const lista = document.createElement('div');
  lista.className = 'ac-list';
  lista.setAttribute('role', 'listbox');
  input.closest('.ac-wrap').appendChild(lista);
  input.setAttribute('aria-autocomplete', 'list');
  let itens = [];
  let ativo = -1;

  const fechar = () => { lista.classList.remove('open'); ativo = -1; };
  const desenhar = () => {
    lista.innerHTML = itens.map((it, i) =>
      `<div class="ac-item ${i === ativo ? 'active' : ''}" role="option" data-i="${i}">${desenharItem(it)}</div>`).join('');
    lista.style.top = `${input.offsetTop + input.offsetHeight + 4}px`;
    lista.classList.toggle('open', itens.length > 0);
    lista.querySelector('.ac-item.active')?.scrollIntoView({ block: 'nearest' });
  };
  const atualizar = () => { itens = buscar(input.value); ativo = -1; desenhar(); };
  const selecionar = it => { fechar(); escolher(it); };

  input.addEventListener('input', atualizar);
  if (abrirAoFocar) input.addEventListener('focus', atualizar);
  input.addEventListener('keydown', e => {
    if (!lista.classList.contains('open')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); ativo = (ativo + 1) % itens.length; desenhar(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); ativo = (ativo - 1 + itens.length) % itens.length; desenhar(); }
    else if (e.key === 'Enter' && ativo >= 0) { e.preventDefault(); selecionar(itens[ativo]); }
    else if (e.key === 'Escape') fechar();
  });
  input.addEventListener('blur', () => setTimeout(fechar, 150));
  // mousedown para escolher antes do blur fechar a lista
  lista.addEventListener('mousedown', e => {
    const el = e.target.closest('.ac-item');
    if (!el) return;
    e.preventDefault();
    selecionar(itens[el.dataset.i]);
  });
  return { fechar, atualizar };
}

// ===== TOAST =====
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ===== RELÓGIO / SAUDAÇÃO =====
function tickClock() {
  const now = new Date();
  const h = now.getHours();
  document.getElementById('clockDate').textContent = fmtData(isoDate(now));
  document.getElementById('clockTime').textContent = isoTime(now);
  document.getElementById('greeting').textContent  = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

// as 12 internações finalizadas de teste entram uma vez nos dados já gravados (quem começa do zero já as recebe no exemplo)
(function incluirFinalizadosEnfermaria() {
  const FLAG = 'clinbot:seed-finalizados-enfermaria:v1';
  try { if (localStorage.getItem(FLAG)) return; localStorage.setItem(FLAG, '1'); } catch (e) { return; }
  const lista = Store.all();
  let id = Store.nextId(); // depois dos atendimentos já gravados, para não sobrepor nenhum
  seedFinalizadosEnfermaria().map(autoriaExemplo)
    .filter(a => !lista.some(x => x.ident?.cns === a.ident.cns))
    .forEach(a => Store.upsert({ ...a, id: id++ }));
})();
