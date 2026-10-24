// Campos da internação compartilhados entre a página de Internações e o prontuário impresso:
// esquema do exame físico, grupos/rótulos da admissão e rótulos da evolução de enfermagem.

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

// exame físico por região do corpo: campos "check" (alteração presente) ou "select"
const ACHADOS_MEMBRO = ['Hematoma', 'Equimoses', 'Alteração de perfusão', 'Hemorragia', 'Dor', 'Alteração de sensibilidade', 'Alteração de tônus muscular', 'Fraturas', 'Outros'];
const CONJUNTIVA = ['Hipocoradas', 'Normocoradas', 'Hipercoradas'];
const REGIOES = {
  cabeca: { titulo:'Cabeça', grupos:[
    { titulo:'Cabeça', campos:[
      { tipo:'check', nome:'cranio_assimetrico', label:'Crânio assimétrico' },
      { tipo:'check', nome:'olhos_assimetricos', label:'Olhos assimétricos' },
      { tipo:'select', nome:'face', label:'Tipo de face', opcoes:['Síndrome de Down', 'Basedowiana', 'Renal', 'Hipocrática', 'Cushingóide', 'Parkinsoniana'] },
      { tipo:'select', nome:'conjuntiva_d', label:'Conjuntiva direita', opcoes:CONJUNTIVA },
      { tipo:'select', nome:'conjuntiva_e', label:'Conjuntiva esquerda', opcoes:CONJUNTIVA },
    ] },
    { titulo:'Cabelo', campos:['Higiene inadequada', 'Parasitas', 'Alopecia'].map(l => ({ tipo:'check', nome:'cabelo_' + slug(l), label:l })) },
    { titulo:'Ouvidos', campos:['Assimetria', 'Malformações', 'Lesões', 'Higiene inadequada', 'Alteração no conduto externo'].map(l => ({ tipo:'check', nome:'ouvido_' + slug(l), label:l })) },
    { titulo:'Nariz', campos:['Assimetria', 'Lesões', 'Higiene inadequada', 'Secreção'].map(l => ({ tipo:'check', nome:'nariz_' + slug(l), label:l })) },
    { titulo:'Gengivas', campos:[
      { tipo:'check', nome:'gengiva_lesoes', label:'Lesões' },
      { tipo:'check', nome:'gengiva_edema', label:'Edema' },
      { tipo:'select', nome:'denticao', label:'Dentição', opcoes:['Preservada', 'Ausente', 'Em formação'] },
    ] },
  ] },
  bracos: { titulo:'Membros superiores', grupos:[
    { titulo:'MSD — membro superior direito', campos:ACHADOS_MEMBRO.map(l => ({ tipo:'check', nome:'msd_' + slug(l), label:l })) },
    { titulo:'MSE — membro superior esquerdo', campos:ACHADOS_MEMBRO.map(l => ({ tipo:'check', nome:'mse_' + slug(l), label:l })) },
  ] },
  pernas: { titulo:'Membros inferiores', grupos:[
    { titulo:'MID — membro inferior direito', campos:ACHADOS_MEMBRO.map(l => ({ tipo:'check', nome:'mid_' + slug(l), label:l })) },
    { titulo:'MIE — membro inferior esquerdo', campos:ACHADOS_MEMBRO.map(l => ({ tipo:'check', nome:'mie_' + slug(l), label:l })) },
  ] },
  corpo: { titulo:'Tórax e sistemas', grupos:[
    { titulo:'Sistema respiratório', campos:[
      { tipo:'check', nome:'torax_assimetrico', label:'Tórax assimétrico' },
      { tipo:'check', nome:'expansibilidade_ausente', label:'Expansibilidade ausente' },
      { tipo:'check', nome:'mamilos_assimetricos', label:'Mamilos assimétricos' },
      { tipo:'select', nome:'tipo_respiracao', label:'Respiração', opcoes:['Eupneico', 'Dispneico', 'Taquipneico', 'Bradipneico', 'Ortopneico'] },
      { tipo:'select', nome:'forma_mamilos', label:'Forma dos mamilos', opcoes:['Normal', 'Protuso', 'Invertido', 'Protuso ao estímulo'] },
      { tipo:'select', nome:'ausculta', label:'Ausculta pulmonar', opcoes:['MV s/ RA', 'MV D', 'MV E', 'Roncos', 'Sibilos', 'Crepitações'] },
    ] },
    { titulo:'Sistema cardiovascular', campos:[
      { tipo:'select', nome:'batimentos', label:'Batimentos', opcoes:['Normocárdico', 'Bradicárdico', 'Taquicárdico'] },
      { tipo:'select', nome:'pulso', label:'Pulso', opcoes:['Taquisfigmo', 'Bradisfigmo', 'Rítmico', 'Arrítmico'] },
    ] },
    { titulo:'Sistema geniturinário', campos:[
      { tipo:'check', nome:'genito_higiene_inadequada', label:'Higiene inadequada' },
      { tipo:'check', nome:'genito_lesoes', label:'Lesões' },
      { tipo:'select', nome:'urina', label:'Urina', opcoes:['Límpida', 'Turva', 'Sedimentos', 'Hematúria', 'Anúria', 'Poliúria', 'Oligúria', 'Disúria', 'Polaciúria'] },
    ] },
  ] },
};

// evolução de enfermagem
const ESTADO_ENF = { diurese:'Diurese', evacuacao:'Evacuação', verbalizacao:'Verbalização', deambulando:'Deambulando', dieta:'Aceitando dieta', avp:'AVP (acesso venoso)' };
const ACOMP_LABELS = { total:'Total', parcial:'Parcial', nao:'Não realizado' };

// conteúdo de uma evolução campo a campo ([rótulo, texto]), para mostrar o que mudou numa retificação
function camposEvolucao(e, tipo) {
  const sv = s => [['PA', s?.pa], ['Temp.', s?.temp], ['FC', s?.fc], ['FR', s?.fr], ['SpO₂', s?.spo2], ['HGT', s?.glicemia], ['Peso', s?.peso]]
    .filter(([, v]) => v).map(([l, v]) => `${l} ${v}`).join(' · ');
  const dose = d => `${d.med} (${d.horario === 'DU' ? 'dose única' : d.horario === 'SN' ? 'se necessário' : d.horario}${d.registradoEm ? ', às ' + d.registradoEm : ''})`;
  return tipo === 'enf' ? [
    ['Data/hora', fmtDataHora(e.em)], ['Profissional', e.profissional], ['Acompanhamento', ACOMP_LABELS[e.acompanhamento] || ''],
    ['Sinais vitais', sv(e.ssvv)], ['Estado', Object.entries(ESTADO_ENF).filter(([k]) => e.estado?.[k]).map(([, l]) => l).join(', ')],
    ['Medicamentos administrados', (e.administracoes || []).map(dose).join('; ')], ['Exames coletados', (e.examesColetados || []).join(', ')],
    ['Anotação', e.anotacao],
  ] : [
    ['Data/hora', fmtDataHora(e.em)], ['Médico', e.medico], ['Sinais vitais', sv(e.ssvv)],
    ['Hipótese diagnóstica', e.diagnostico], ['Plano de cuidado', e.plano], ['Estado do paciente', e.estadoPaciente], ['Anotações', e.anotacoes],
    ['Prescrição', (e.prescricao || []).map(p => `${p.med}${p.pos ? ' (' + p.pos + ')' : ''}`).join('; ')],
    ['Exames solicitados', (e.exames || []).map(x => `${x.exame}${x.obs ? ' (' + x.obs + ')' : ''}`).join('; ')],
  ];
}
// campos alterados entre duas versões: [[rótulo, antes, depois]]
function diferencasEvolucao(antes, depois, tipo) {
  const b = camposEvolucao(depois, tipo);
  return camposEvolucao(antes, tipo).map(([l, v], i) => [l, v || '', b[i][1] || '']).filter(([, x, y]) => x !== y);
}

const CARATER_INTERNACAO = {
  '01': 'Eletiva', '02': 'Urgência', '03': 'Acidente no local de trabalho', '04': 'Acidente no trajeto para o trabalho',
  '05': 'Outros tipos de acidentes de trânsito', '06': 'Outros tipos de lesões',
};

// campos da admissão (admissao.campos), na ordem do prontuário: [nome, rótulo, opções?]
const CAMPOS_ADMISSAO = [
  { titulo: 'Acompanhante', campos: [
    ['ac_nome', 'Nome'], ['ac_telefone', 'Telefone'],
    ['ac_parentesco', 'Parentesco', { pais:'Pai / Mãe', filho:'Filho(a)', conjuge:'Cônjuge', familia:'Família estendida', amigo:'Amigo(a)', outro:'Outro' }],
    ['ac_doc_tipo', 'Documento', { rg:'RG', cpf:'CPF', outro:'Outro' }], ['ac_doc_numero', 'Número do documento'],
  ] },
  { titulo: 'Anamnese — Hábitos', campos: [
    ['hab_religiao', 'Religião', { catolica:'Católica', evangelica:'Evangélica', protestante:'Protestante', espirita:'Espírita', matriz_africana:'Matriz africana', sem:'Sem religião', outra:'Outra' }],
    ['hab_religiao_praticante', 'Praticante'],
    ['hab_tabagista', 'Tabagista'], ['hab_tabagista_qtd', 'Tabagismo — quantidade por dia'],
    ['hab_drogas', 'Uso de drogas'], ['hab_drogas_tipo', 'Drogas — quais'], ['hab_drogas_freq', 'Drogas — frequência'],
    ['hab_etilista', 'Etilismo', { nao:'Não', sim:'Sim', as_vezes:'Às vezes' }], ['hab_etilista_freq', 'Etilismo — frequência'],
    ['hab_apetite', 'Apetite preservado'], ['hab_refeicoes', 'Refeições por dia'],
    ['hab_mastigacao', 'Problema de mastigação'], ['hab_degluticao', 'Problema de deglutição'], ['hab_digestao', 'Problema de digestão'],
    ['hab_nauseas', 'Náuseas'], ['hab_pirose', 'Pirose'],
    ['hab_hidrica', 'Ingestão hídrica', { pouco:'Pouca', normal:'Normal', muito:'Muita' }], ['hab_hidrica_freq', 'Ingestão hídrica — frequência'],
    ['hab_atividade', 'Atividade física'], ['hab_atividade_qual', 'Atividade física — qual'], ['hab_atividade_freq', 'Atividade física — frequência'],
    ['hab_sono_dificuldade', 'Dificuldade para dormir'], ['hab_sono_horas', 'Horas de sono'],
  ] },
  { titulo: 'Anamnese — Histórico pessoal', campos: [
    ['hp_dm', 'DM'], ['hp_has', 'HAS'], ['hp_irc', 'IRC'], ['hp_neoplasias', 'Neoplasias'], ['hp_obesidade', 'Obesidade'],
    ['hp_respiratorias', 'Doenças respiratórias'], ['hp_respiratorias_quais', 'Doenças respiratórias — quais'],
    ['hp_cardiopatias', 'Cardiopatias'], ['hp_cardiopatias_quais', 'Cardiopatias — quais'],
    ['hp_internacoes', 'Internações anteriores'], ['hp_internacoes_motivo', 'Internações anteriores — motivo'], ['hp_internacoes_quando', 'Internações anteriores — quando'],
    ['hp_cirurgias', 'Cirurgias anteriores'], ['hp_cirurgias_motivo', 'Cirurgias anteriores — motivo'], ['hp_cirurgias_quando', 'Cirurgias anteriores — quando'],
    ['hp_medicamentos', 'Medicamentos de uso contínuo'], ['hp_medicamentos_quais', 'Medicamentos — quais'], ['hp_medicamentos_tempo', 'Medicamentos — há quanto tempo'],
  ] },
  { titulo: 'Anamnese — Histórico familiar', campos: [
    ['hf_dm', 'DM'], ['hf_has', 'HAS'], ['hf_irc', 'IRC'], ['hf_neoplasias', 'Neoplasias'], ['hf_obesidade', 'Obesidade'],
    ['hf_respiratorias', 'Doenças respiratórias'], ['hf_respiratorias_quais', 'Doenças respiratórias — quais'],
    ['hf_cardiopatias', 'Cardiopatias'], ['hf_cardiopatias_quais', 'Cardiopatias — quais'], ['hf_outros', 'Outros'],
  ] },
  { titulo: 'Estado de entrada', campos: [
    ['est_entrada', 'Modo de entrada', { deambulando:'Deambulando', maca:'Maca', cadeira:'Cadeira de rodas', outros:'Outros' }],
    ['est_consciencia', 'Nível de consciência', { consciente:'Consciente', inconsciente:'Inconsciente', orientado:'Orientado', desorientado:'Desorientado', torporoso:'Torporoso', apatico:'Apático' }],
    ['est_pupilas', 'Pupilas', { isocoricas:'Isocóricas', anisocoricas:'Anisocóricas', midriase:'Midríase', miose:'Miose' }],
    ['est_fotorreagentes', 'Fotorreagentes'],
    ['est_autocuidado', 'Autocuidado', { dependente:'Dependente', parcial:'Parcialmente dependente', independente:'Independente' }],
    ['est_banhos', 'Banhos diários', { nenhum:'Nenhum', um_dois:'Um ou dois', tres_mais:'Três ou mais' }],
    ['est_higiene_oral', 'Higiene oral', { adequado:'Adequada', sem_dentes:'Ausência total de dentes', parcial_dentes:'Ausência parcial de dentes', protese:'Uso de prótese', ortodontico:'Aparelho ortodôntico' }],
    ['est_higiene_corporal', 'Higiene corporal adequada'],
  ] },
  { titulo: 'Sinais vitais e dados antropométricos', campos: [
    ['ssvv_pa', 'PA (mmHg)'], ['ssvv_temp', 'Temperatura (°C)'], ['ssvv_fc', 'FC (bpm)'], ['ssvv_spo2', 'SpO₂ (%)'],
    ['ssvv_fr', 'FR (irpm)'], ['ssvv_glicemia', 'HGT (mg/dL)'], ['antro_peso', 'Peso (kg)'], ['antro_altura', 'Altura (m)'],
  ] },
  { titulo: 'Diagnósticos e plano de enfermagem', campos: [
    ['diag_outro', 'Outro diagnóstico'], ['plano_enfermagem', 'Plano de enfermagem'], ['implementacao', 'Implementação'],
  ] },
  { titulo: 'Anotação de enfermagem da admissão', campos: [['anotacao', 'Anotação']] },
];
