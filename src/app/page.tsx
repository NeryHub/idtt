// src/app/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Flame, Calendar as CalendarIcon, Plus, Trash2, Trophy, Bell, Layers, BarChart3, PieChart, Clock, RotateCcw, Sliders, Check, User, X, Edit3, ChevronLeft, ChevronRight } from 'lucide-react';

interface Vote {
  tipo_voto: 'NOVO_EU' | 'VELHO_EU';
  valor_progresso_dia: number;
}

export interface Habit {
  id: string;
  identity_id?: string;
  nome_identidade?: string;
  nome_habito: string;
  horarios_notificacao: string[];
  dias_semana: string[];
  e_cumulativo: boolean;
  meta_objetivo: number;
  unidade_medida: string;
  ativo: boolean;
  historico_dias: { [dataStr: string]: Vote };
}

interface Identity {
  id: string;
  nome_identidade: string;
  habits: Habit[];
}

const DIAS_DA_SEMANA_MAP: { [key: number]: string } = {
  0: 'dom',
  1: 'seg',
  2: 'ter',
  3: 'qua',
  4: 'qui',
  5: 'sex',
  6: 'sab'
};

const NOMES_DIAS_EXTENSO: { [key: string]: string } = {
  dom: 'DOMINGO',
  seg: 'SEGUNDA-FEIRA',
  ter: 'TERÇA-FEIRA',
  qua: 'QUARTA-FEIRA',
  qui: 'QUINTA-FEIRA',
  sex: 'SEXTA-FEIRA',
  sab: 'SÁBADO'
};

const TODOS_OS_DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [novaFacetaNome, setNovaFacetaNome] = useState('');
  
  // Controlo de Data Selecionada
  const dataHojeReal = new Date().toISOString().split('T')[0];
  const [dataSelecionada, setDataSelecionada] = useState<string>(dataHojeReal);

  // Estados para criação manual de hábitos
  const [idFacetaAtivaParaHabito, setIdFacetaAtivaParaHabito] = useState<string | null>(null);
  const [novoHabitoNome, setNovoHabitoNome] = useState('');
  const [novoHabitoDias, setNovoHabitoDias] = useState<string[]>([...TODOS_OS_DIAS]);
  
  // Gestor dinâmico de alertas de criação
  const [alertaHoraTmp, setAlertaHoraTmp] = useState('08:00');
  const [listaAlertasConfigurados, setListaAlertasConfigurados] = useState<string[]>(['08:00']);

  const [novoHabitoE_Cumulativo, setNovoHabitoE_Cumulativo] = useState(false);
  const [novoHabitoMeta, setNovoHabitoMeta] = useState(1);
  const [novoHabitoUnidade, setNovoHabitoUnidade] = useState('un');

  // Estados para edição de hábitos existentes
  const [habitoEmEdicao, setHabitoEmEdicao] = useState<Habit | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editDias, setEditDias] = useState<string[]>([]);
  const [editAlertas, setEditAlertas] = useState<string[]>([]);
  const [editAlertaTmp, setEditAlertaTmp] = useState('08:00');
  const [editMeta, setEditMeta] = useState(1);
  const [editUnidade, setEditUnidade] = useState('un');

  // Controlo dos gráficos
  const [tipoGrafico, setTipoGrafico] = useState<'barra' | 'redondo'>('barra');
  const [filtroTempo, setFiltroTempo] = useState<'semana' | 'mes' | 'ano'>('mes');
  const [facetaSelecionadaGrafico, setFacetaSelecionadaGrafico] = useState<string | null>(null);

  // Navegação mobile
  const [tabMobileAtiva, setTabMobileAtiva] = useState<'painel' | 'metricas' | 'config'>('painel');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modais de confirmação
  const [modalConfirm, setModalConfirm] = useState<{ tipo: 'area' | 'habito'; id: string; nome: string } | null>(null);

  // Cálculo do dia da semana baseado na DATA SELECIONADA
  const dataSelecionadaObj = useMemo(() => {
    return new Date(dataSelecionada + 'T00:00:00');
  }, [dataSelecionada]);

  const diaSemanaSelecionado = useMemo(() => {
    return DIAS_DA_SEMANA_MAP[dataSelecionadaObj.getDay()];
  }, [dataSelecionadaObj]);

  const isHoje = dataSelecionada === dataHojeReal;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
      carregarEstruturaCompleta();
    }
  }, [user]);

  async function carregarEstruturaCompleta() {
    setIsRefreshing(true);
    try {
      const { data: idData, error: idError } = await supabase
        .from('identities')
        .select(`
          id,
          nome_identidade,
          habits (
            id,
            nome_habito,
            horarios_notificacao,
            dias_semana,
            e_cumulativo,
            meta_objetivo,
            unidade_medida,
            ativo,
            votes_log (
              data_voto,
              tipo_voto,
              valor_progresso_dia
            )
          )
        `)
        .order('created_at', { ascending: true });

      if (idError) throw idError;
      if (!idData) return;

      const estruturaIdentidades: Identity[] = idData.map((identityRow: any) => {
        const listaHabitos: Habit[] = (identityRow.habits || [])
          .filter((h: any) => h.ativo !== false)
          .map((hRow: any) => {
            const historico: { [key: string]: Vote } = {};
            (hRow.votes_log || []).forEach((v: any) => {
              historico[v.data_voto] = {
                tipo_voto: v.tipo_voto,
                valor_progresso_dia: v.valor_progresso_dia
              };
            });

            let alertasArray: string[] = [];
            if (Array.isArray(hRow.horarios_notificacao)) {
              alertasArray = hRow.horarios_notificacao;
            } else if (typeof hRow.horarios_notificacao === 'string') {
              alertasArray = hRow.horarios_notificacao.split(',').map((x: string) => x.trim()).filter(Boolean);
            }

            let diasSemanaArray: string[] = TODOS_OS_DIAS;
            if (Array.isArray(hRow.dias_semana)) {
              diasSemanaArray = hRow.dias_semana;
            } else if (typeof hRow.dias_semana === 'string') {
              try {
                diasSemanaArray = JSON.parse(hRow.dias_semana);
              } catch {
                diasSemanaArray = hRow.dias_semana.split(',').map((d: string) => d.trim());
              }
            }

            return {
              id: hRow.id,
              identity_id: identityRow.id,
              nome_identidade: identityRow.nome_identidade,
              nome_habito: hRow.nome_habito,
              horarios_notificacao: alertasArray,
              dias_semana: diasSemanaArray,
              e_cumulativo: Boolean(hRow.e_cumulativo),
              meta_objetivo: Number(hRow.meta_objetivo) || 1,
              unidade_medida: hRow.unidade_medida || 'un',
              ativo: hRow.ativo !== false,
              historico_dias: historico
            };
          });

        return {
          id: identityRow.id,
          nome_identidade: identityRow.nome_identidade,
          habits: listaHabitos
        };
      });

      setIdentities(estruturaIdentidades);
      if (estruturaIdentidades.length > 0) {
        if (!idFacetaAtivaParaHabito) setIdFacetaAtivaParaHabito(estruturaIdentidades[0].id);
        if (!facetaSelecionadaGrafico) setFacetaSelecionadaGrafico(estruturaIdentidades[0].id);
      }
    } catch (err) {
      console.error("Erro ao sincronizar dados:", err);
    } finally {
      setIsRefreshing(false);
    }
  }

  // Navegar dias
  const mudarDia = (diasDelta: number) => {
    const novaData = new Date(dataSelecionadaObj);
    novaData.setDate(novaData.getDate() + diasDelta);
    setDataSelecionada(novaData.toISOString().split('T')[0]);
  };

  // TIMELINE PARA O DIA SELECIONADO
  const timelineDiaSelecionado = useMemo(() => {
    const todosHabitosDoDia: Habit[] = [];

    identities.forEach(ident => {
      ident.habits.forEach(h => {
        if (h.dias_semana.includes(diaSemanaSelecionado)) {
          todosHabitosDoDia.push({
            ...h,
            nome_identidade: ident.nome_identidade
          });
        }
      });
    });

    return todosHabitosDoDia.sort((a, b) => {
      const horaA = a.horarios_notificacao[0] || '99:99';
      const horaB = b.horarios_notificacao[0] || '99:99';
      return horaA.localeCompare(horaB);
    });
  }, [identities, diaSemanaSelecionado]);

  const totalConcluidasDia = useMemo(() => {
    return timelineDiaSelecionado.filter(h => {
      const log = h.historico_dias[dataSelecionada];
      if (!log) return false;
      if (h.e_cumulativo) return log.valor_progresso_dia >= h.meta_objetivo;
      return log.tipo_voto === 'NOVO_EU';
    }).length;
  }, [timelineDiaSelecionado, dataSelecionada]);

  const calcularEficaciaDia = (habits: Habit[], dateStr: string) => {
    const dataObj = new Date(dateStr + 'T00:00:00');
    const diaCod = DIAS_DA_SEMANA_MAP[dataObj.getDay()];

    const habitosDoDia = habits.filter(h => h.dias_semana.includes(diaCod));
    if (habitosDoDia.length === 0) return 100;

    let somaPercentagens = 0;

    habitosDoDia.forEach(h => {
      const log = h.historico_dias[dateStr];
      if (!log) return;
      if (h.e_cumulativo) {
        const pct = Math.min(100, (log.valor_progresso_dia / h.meta_objetivo) * 100);
        somaPercentagens += pct;
      } else {
        somaPercentagens += log.tipo_voto === 'NOVO_EU' ? 100 : 0;
      }
    });

    return Math.round(somaPercentagens / habitosDoDia.length);
  };

  const calcularCristalizacaoJusta = (habits: Habit[]) => {
    if (habits.length === 0) return 0;
    let somaEficacias = 0;

    for (let i = 89; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      somaEficacias += calcularEficaciaDia(habits, dateStr);
    }

    return Math.round(somaEficacias / 90);
  };

  const obterDadosFiltroTempo = () => {
    const facetaAlvo = identities.find(i => i.id === facetaSelecionadaGrafico);
    if (!facetaAlvo || facetaAlvo.habits.length === 0) return { mediaGeral: 0, dadosHabitos: [] };

    let numDias = 7;
    if (filtroTempo === 'mes') numDias = 30;
    if (filtroTempo === 'ano') numDias = 365;

    const arrayDias: { dateStr: string; diaSemana: string }[] = [];
    for (let i = numDias - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arrayDias.push({
        dateStr: d.toISOString().split('T')[0],
        diaSemana: DIAS_DA_SEMANA_MAP[d.getDay()]
      });
    }

    let somatorioFaceta = 0;
    
    const dadosHabitos = facetaAlvo.habits.map(h => {
      let diasCumpridos = 0;
      let totalDiasAgendados = 0;

      arrayDias.forEach(({ dateStr, diaSemana }) => {
        if (!h.dias_semana.includes(diaSemana)) return;
        totalDiasAgendados++;

        const log = h.historico_dias[dateStr];
        if (!log) return;
        if (h.e_cumulativo) {
          if (log.valor_progresso_dia >= h.meta_objetivo) diasCumpridos++;
        } else {
          if (log.tipo_voto === 'NOVO_EU') diasCumpridos++;
        }
      });

      const performanceHabito = totalDiasAgendados > 0 ? Math.round((diasCumpridos / totalDiasAgendados) * 100) : 100;
      somatorioFaceta += performanceHabito;

      return {
        id: h.id,
        nome: h.nome_habito,
        percentagem: performanceHabito
      };
    });

    const mediaGeral = dadosHabitos.length > 0 ? Math.round(somatorioFaceta / dadosHabitos.length) : 0;
    return { mediaGeral, dadosHabitos };
  };

  async function handleCriarFaceta(e: React.FormEvent) {
    e.preventDefault();
    if (!novaFacetaNome.trim() || !user) return;
    const { error } = await supabase.from('identities').insert([{ nome_identidade: novaFacetaNome.trim(), user_id: user.id }]);
    if (!error) { setNovaFacetaNome(''); carregarEstruturaCompleta(); }
  }

  function toggleDiaNovoHabito(dia: string) {
    if (novoHabitoDias.includes(dia)) {
      if (novoHabitoDias.length > 1) setNovoHabitoDias(novoHabitoDias.filter(d => d !== dia));
    } else {
      setNovoHabitoDias([...novoHabitoDias, dia]);
    }
  }

  function toggleDiaEdicao(dia: string) {
    if (editDias.includes(dia)) {
      if (editDias.length > 1) setEditDias(editDias.filter(d => d !== dia));
    } else {
      setEditDias([...editDias, dia]);
    }
  }

  function adicionarAlertaNaLista() {
    if (!listaAlertasConfigurados.includes(alertaHoraTmp)) {
      setListaAlertasConfigurados([...listaAlertasConfigurados, alertaHoraTmp].sort());
    }
  }

  function removerAlertaDaLista(horaParaRemover: string) {
    setListaAlertasConfigurados(listaAlertasConfigurados.filter(h => h !== horaParaRemover));
  }

  async function handleCriarHabito(e: React.FormEvent) {
    e.preventDefault();
    if (!novoHabitoNome.trim() || !idFacetaAtivaParaHabito) return;
    
    const stringHorariosParaDB = listaAlertasConfigurados.join(',');

    const { error } = await supabase.from('habits').insert([{
      identity_id: idFacetaAtivaParaHabito,
      nome_habito: novoHabitoNome.trim(),
      horarios_notificacao: stringHorariosParaDB,
      dias_semana: novoHabitoDias,
      e_cumulativo: novoHabitoE_Cumulativo,
      meta_objetivo: novoHabitoMeta,
      unidade_medida: novoHabitoUnidade,
      ativo: true
    }]);

    if (!error) { 
      setNovoHabitoNome(''); 
      setListaAlertasConfigurados(['08:00']);
      setNovoHabitoDias([...TODOS_OS_DIAS]);
      carregarEstruturaCompleta(); 
      setTabMobileAtiva('painel'); 
    }
  }

  function iniciarEdicaoHabito(habit: Habit) {
    setHabitoEmEdicao(habit);
    setEditNome(habit.nome_habito);
    setEditAlertas([...habit.horarios_notificacao]);
    setEditDias([...habit.dias_semana]);
    setEditMeta(habit.meta_objetivo);
    setEditUnidade(habit.unidade_medida);
  }

  function adicionarAlertaNaEdicao() {
    if (!editAlertas.includes(editAlertaTmp)) {
      setEditAlertas([...editAlertas, editAlertaTmp].sort());
    }
  }

  function removerAlertaNaEdicao(hora: string) {
    setEditAlertas(editAlertas.filter(h => h !== hora));
  }

  async function handleSalvarEdicaoHabito(e: React.FormEvent) {
    e.preventDefault();
    if (!habitoEmEdicao || !editNome.trim()) return;

    const stringHorariosDB = editAlertas.join(',');

    const { error } = await supabase
      .from('habits')
      .update({
        nome_habito: editNome.trim(),
        horarios_notificacao: stringHorariosDB,
        dias_semana: editDias,
        meta_objetivo: editMeta,
        unidade_medida: editUnidade
      })
      .eq('id', habitoEmEdicao.id);

    if (!error) {
      setHabitoEmEdicao(null);
      await carregarEstruturaCompleta();
    } else {
      console.error("Erro ao atualizar dados no Supabase:", error);
    }
  }

  async function ejecutarRemocaoConfirmada() {
    if (!modalConfirm) return;
    if (modalConfirm.tipo === 'area') {
      await supabase.from('identities').delete().eq('id', modalConfirm.id);
    } else {
      await supabase.from('habits').delete().eq('id', modalConfirm.id);
    }
    setModalConfirm(null);
    carregarEstruturaCompleta();
  }

  async function handleToggleVoto(habitId: string, tipoAlvo: 'NOVO_EU' | 'VELHO_EU') {
    let habitoAlvo: Habit | undefined;
    for (const ident of identities) {
      const h = ident.habits.find(x => x.id === habitId);
      if (h) { habitoAlvo = h; break; }
    }
    if (!habitoAlvo) return;
    const votoAtual = habitoAlvo.historico_dias[dataSelecionada];

    if (votoAtual?.tipo_voto === tipoAlvo) {
      await supabase.from('votes_log').delete().eq('habit_id', habitId).eq('data_voto', dataSelecionada);
    } else {
      await supabase.from('votes_log').upsert({
        habit_id: habitId,
        data_voto: dataSelecionada,
        tipo_voto: tipoAlvo,
        valor_progresso_dia: habitoAlvo.meta_objetivo
      }, { onConflict: 'habit_id,data_voto' });
    }
    carregarEstruturaCompleta();
  }

  async function handleAlterarProgressoCumulativo(habitId: string, valorAtual: number, incremento: number) {
    const h = habitsGlobalFind(habitId);
    if (!h) return;
    const novoValor = Math.max(0, valorAtual + incremento);
    await supabase.from('votes_log').upsert({
      habit_id: habitId,
      data_voto: dataSelecionada,
      tipo_voto: novoValor >= h.meta_objetivo ? 'NOVO_EU' : 'VELHO_EU',
      valor_progresso_dia: novoValor
    }, { onConflict: 'habit_id,data_voto' });
    carregarEstruturaCompleta();
  }

  function habitsGlobalFind(id: string) {
    for (const idnt of identities) {
      const h = idnt.habits.find(x => x.id === id);
      if (h) return h;
    }
    return null;
  }

  const gerarDiasCalendario = () => {
    const dias = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dias.push(d);
    }
    return dias;
  };

  const analiseGrafica = obterDadosFiltroTempo();

  if (!user) {
    return (
      <div className="min-h-screen bg-[#000000] text-[#ffffff] flex flex-col items-center justify-center p-6">
        <div className="bg-[#0d0d0d] border border-[#3c3c3c] p-8 rounded-none w-full max-w-md text-center shadow-none space-y-5">
          <div className="flex h-1 w-full"><div className="w-1/3 bg-[#0066b1]"></div><div className="w-1/3 bg-[#1c69d4]"></div><div className="w-1/3 bg-[#e22718]"></div></div>
          <h2 className="text-4xl font-black tracking-widest text-[#ffffff] font-mono uppercase pt-2">IDTT</h2>
          <p className="text-xs tracking-[1.5px] uppercase font-bold text-[#7e7e7e] -mt-2">Consistência e Identidade M-Engineering</p>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const target = e.target as any;
            const email = target.email.value;
            const password = target.password.value;
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
              await supabase.auth.signUp({ email, password });
              alert("Perfil criado! Faça login para ativar.");
            }
          }} className="space-y-4 text-left pt-2">
            <input name="email" type="email" required placeholder="EMAIL" className="w-full bg-[#1a1a1a] border border-[#3c3c3c] rounded-none px-4 py-3 text-base text-[#ffffff] tracking-wider focus:outline-none focus:border-[#ffffff] font-mono" />
            <input name="password" type="password" required placeholder="PASSWORD" className="w-full bg-[#1a1a1a] border border-[#3c3c3c] rounded-none px-4 py-3 text-base text-[#ffffff] tracking-wider focus:outline-none focus:border-[#ffffff] font-mono" />
            <button type="submit" className="w-full bg-[#ffffff] text-[#000000] font-bold py-3 rounded-none text-sm tracking-[1.5px] uppercase transition active:bg-[#e6e6e6]">Aceder ao Painel</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <main 
      className="min-h-screen bg-[#000000] text-[#ffffff] pb-28 md:p-8 flex flex-col items-center w-full select-none overflow-y-auto"
      style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        main::-webkit-scrollbar, div::-webkit-scrollbar { display: none !important; }
      `}} />
      
      {/* HEADER M-MOTORSPORT */}
      <div className="w-full max-w-4xl flex justify-between items-center bg-[#0d0d0d] sticky top-0 z-40 p-4 border-b border-[#3c3c3c] md:rounded-none md:mb-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono font-black text-2xl tracking-wider text-[#ffffff] uppercase">IDTT</span>
            <div className="flex h-[2px] w-8"><div className="w-1/3 bg-[#0066b1]"></div><div className="w-1/3 bg-[#1c69d4]"></div><div className="w-1/3 bg-[#e22718]"></div></div>
          </div>
          <span className="text-xs bg-[#1a1a1a] px-3 py-1 rounded-none border border-[#3c3c3c] text-[#bbbbbb] uppercase font-mono tracking-wider truncate max-w-[150px]">
            {user.email?.split('@')[0]}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={carregarEstruturaCompleta} 
            className={`p-2 rounded-none bg-[#1a1a1a] border border-[#3c3c3c] active:bg-[#262626] transition ${isRefreshing ? 'animate-spin' : ''}`}
          >
            <RotateCcw size={16} className="text-[#ffffff]" />
          </button>
          <button onClick={() => supabase.auth.signOut()} className="text-xs text-[#e22718] font-bold tracking-[1.5px] uppercase hover:underline">Sair</button>
        </div>
      </div>

      {/* 🧭 SELETOR DE DATA / NAVEGADOR DE DIAS (STICKY SUB-HEADER) */}
      <div className="w-full max-w-4xl px-3 md:px-0 mb-4">
        <div className="bg-[#0d0d0d] border border-[#3c3c3c] p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center justify-between md:justify-start gap-2">
            <button 
              onClick={() => mudarDia(-1)} 
              className="p-2 bg-[#1a1a1a] border border-[#3c3c3c] text-[#ffffff] hover:bg-[#262626] transition"
              title="Dia Anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={dataSelecionada} 
                onChange={(e) => setDataSelecionada(e.target.value)} 
                className="bg-[#1a1a1a] border border-[#3c3c3c] text-xs font-mono text-[#ffffff] px-2.5 py-1.5 focus:outline-none"
              />
              <button 
                onClick={() => setDataSelecionada(dataHojeReal)}
                className={`text-[10px] font-mono font-bold tracking-wider px-2.5 py-1.5 border uppercase transition ${
                  isHoje 
                    ? 'bg-[#ffffff] text-[#000000] border-[#ffffff]' 
                    : 'bg-transparent text-[#7e7e7e] border-[#3c3c3c] hover:text-[#ffffff]'
                }`}
              >
                HOJE
              </button>
            </div>

            <button 
              onClick={() => mudarDia(1)} 
              className="p-2 bg-[#1a1a1a] border border-[#3c3c3c] text-[#ffffff] hover:bg-[#262626] transition"
              title="Dia Seguinte"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 text-right">
            <div className="text-left md:text-right">
              <span className="text-[10px] font-black text-[#0066b1] tracking-[1.5px] uppercase block">
                {NOMES_DIAS_EXTENSO[diaSemanaSelecionado]}
              </span>
              <span className="text-xs font-mono text-[#bbbbbb]">
                {dataSelecionada} {!isHoje && <b className="text-[#e22718]">(HISTÓRICO)</b>}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PAINEL GRID PRINCIPAL */}
      <div className="w-full max-w-4xl px-3 md:px-0 pt-1 md:pt-0 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        
        {/* ================= SEPARADOR 1: PAINEL DE HÁBITOS ================= */}
        <div className={`${tabMobileAtiva === 'painel' ? 'block' : 'hidden md:block'} space-y-6 md:col-span-2`}>
          
          {/* ⚡ TIMELINE OPERACIONAL / TAREFAS DO DIA SELECIONADO ⚡ */}
          <div className="bg-[#0d0d0d] border border-[#ffffff]/30 rounded-none p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-[#3c3c3c] pb-3">
              <div>
                <span className="text-xs uppercase font-black text-[#0066b1] tracking-[1.5px] block mb-0.5">TIMELINE OPERACIONAL</span>
                <h3 className="text-xl font-black text-[#ffffff] uppercase tracking-tight flex items-center gap-2">
                  <Clock size={18} className="text-[#0066b1]" /> MISSÕES: {NOMES_DIAS_EXTENSO[diaSemanaSelecionado]}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-[#7e7e7e] uppercase tracking-[1.5px] block">PROGRESSO</span>
                <span className="text-sm font-mono font-black text-[#ffffff]">
                  {totalConcluidasDia} / {timelineDiaSelecionado.length} ({timelineDiaSelecionado.length > 0 ? Math.round((totalConcluidasDia / timelineDiaSelecionado.length) * 100) : 0}%)
                </span>
              </div>
            </div>

            {timelineDiaSelecionado.length === 0 ? (
              <div className="p-4 text-center font-mono text-xs text-[#7e7e7e] bg-[#1a1a1a]">
                NENHUMA MISSÃO AGENDADA PARA ESTE DIA
              </div>
            ) : (
              <div className="space-y-2.5">
                {timelineDiaSelecionado.map((habit) => {
                  const registo = habit.historico_dias[dataSelecionada];
                  const horarioExibicao = habit.horarios_notificacao.length > 0 ? habit.horarios_notificacao[0] : '--:--';
                  const dosePorHora = Math.round(habit.meta_objetivo / 15) || 1;
                  const valorAtual = registo ? registo.valor_progresso_dia : 0;
                  const isConcluido = habit.e_cumulativo 
                    ? valorAtual >= habit.meta_objetivo 
                    : registo?.tipo_voto === 'NOVO_EU';
                  const isFalha = !habit.e_cumulativo && registo?.tipo_voto === 'VELHO_EU';

                  return (
                    <div 
                      key={habit.id} 
                      className={`p-3 border flex flex-col gap-2.5 transition rounded-none ${
                        isConcluido 
                          ? 'bg-[#141414] border-[#ffffff]/40' 
                          : isFalha 
                          ? 'bg-[#1a0f0f] border-[#e22718]/60' 
                          : 'bg-[#1a1a1a] border-[#3c3c3c]'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-black px-2 py-1 bg-[#0d0d0d] border border-[#3c3c3c] text-[#ffffff]">
                            {horarioExibicao}
                          </span>
                          <div>
                            <span className="text-[9px] text-[#7e7e7e] uppercase font-bold tracking-wider block">
                              {habit.nome_identidade}
                            </span>
                            <span className={`text-sm font-bold uppercase tracking-tight ${isConcluido ? 'text-[#ffffff] line-through decoration-[#7e7e7e]' : 'text-[#ffffff]'}`}>
                              {habit.nome_habito}
                            </span>
                          </div>
                        </div>

                        <div>
                          {isConcluido && (
                            <span className="text-[10px] font-mono font-bold bg-[#ffffff] text-[#000000] px-2 py-0.5 uppercase">
                              NOVO EU ✓
                            </span>
                          )}
                          {isFalha && (
                            <span className="text-[10px] font-mono font-bold bg-[#e22718] text-[#ffffff] px-2 py-0.5 uppercase">
                              VELHO EU ✕
                            </span>
                          )}
                          {!isConcluido && !isFalha && (
                            <span className="text-[10px] font-mono text-[#7e7e7e] px-2 py-0.5 uppercase border border-[#3c3c3c]">
                              PENDENTE
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Controlos Rápidos Diretos na Timeline */}
                      {habit.e_cumulativo ? (
                        <div className="flex items-center justify-between gap-3 bg-[#0d0d0d] p-2 border border-[#3c3c3c]">
                          <span className="text-xs font-mono text-[#bbbbbb]">
                            {valorAtual} / {habit.meta_objetivo} {habit.unidade_medida}
                          </span>
                          <div className="flex gap-1.5">
                            <button onClick={() => handleAlterarProgressoCumulativo(habit.id, valorAtual, -dosePorHora)} className="px-2.5 py-1 bg-[#1a1a1a] border border-[#3c3c3c] text-xs font-mono font-black active:bg-[#262626]">-</button>
                            <button onClick={() => handleAlterarProgressoCumulativo(habit.id, valorAtual, dosePorHora)} className={`px-2.5 py-1 text-xs font-mono font-black uppercase ${isConcluido ? 'bg-[#ffffff] text-[#000000]' : 'bg-[#e22718] text-[#ffffff]'}`}>
                              +{dosePorHora}{habit.unidade_medida}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => handleToggleVoto(habit.id, 'NOVO_EU')}
                            className={`text-[10px] py-1.5 font-bold uppercase tracking-wider border transition ${registo?.tipo_voto === 'NOVO_EU' ? 'bg-[#ffffff] text-[#000000] border-[#ffffff]' : 'bg-transparent text-[#ffffff] border-[#3c3c3c] active:bg-[#262626]'}`}
                          >
                            👍 NOVO EU
                          </button>
                          <button 
                            onClick={() => handleToggleVoto(habit.id, 'VELHO_EU')}
                            className={`text-[10px] py-1.5 font-bold uppercase tracking-wider border transition ${registo?.tipo_voto === 'VELHO_EU' ? 'bg-[#e22718] text-[#ffffff] border-[#e22718]' : 'bg-transparent text-[#e22718] border-[#3c3c3c] active:bg-[#262626]'}`}
                          >
                            👎 VELHO EU
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* LISTA POR FACETAS / IDENTIDADES */}
          {identities.map((faceta) => {
            const pctCristalizacao = calcularCristalizacaoJusta(faceta.habits);
            const eficDia = calcularEficaciaDia(faceta.habits, dataSelecionada);

            return (
              <div key={faceta.id} className="bg-[#0d0d0d] border border-[#3c3c3c] rounded-none p-5 shadow-none space-y-4">
                <div className="flex justify-between items-start border-b border-[#3c3c3c] pb-3">
                  <div>
                    <span className="text-xs uppercase font-black text-[#e22718] tracking-[1.5px] block mb-1">FACETA ATIVA</span>
                    <h2 className="text-2xl font-black text-[#ffffff] uppercase tracking-tight">{faceta.nome_identidade}</h2>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase font-bold text-[#7e7e7e] tracking-[1.5px] block mb-1">CRISTALIZAÇÃO 90D</span>
                    <span className="text-3xl font-mono font-black text-[#ffffff]">{pctCristalizacao}%</span>
                  </div>
                </div>

                <div className="w-full bg-[#1a1a1a] h-3.5 rounded-none overflow-hidden border border-[#3c3c3c]">
                  <div className="bg-[#ffffff] h-full transition-all duration-500" style={{ width: `${pctCristalizacao}%` }} />
                </div>
                <div className="text-xs text-[#bbbbbb] flex justify-between font-mono tracking-wider">
                  <span>CICLO M-ENGINEERING</span>
                  <span>EFICÁCIA NO DIA: <b className="text-[#ffffff] text-sm">{eficDia}%</b></span>
                </div>

                <div className="space-y-4 pt-1">
                  {faceta.habits.map((habit) => {
                    const agendadoParaDia = habit.dias_semana.includes(diaSemanaSelecionado);
                    const registoHoje = habit.historico_dias[dataSelecionada];
                    const dosePorHora = Math.round(habit.meta_objetivo / 15) || 1;
                    const valorAtualCumulativo = registoHoje ? registoHoje.valor_progresso_dia : 0;
                    const concluidoCumulativo = valorAtualCumulativo >= habit.meta_objetivo;

                    return (
                      <div key={habit.id} className={`p-4 rounded-none border space-y-3.5 ${agendadoParaDia ? 'bg-[#1a1a1a] border-[#3c3c3c]' : 'bg-[#121212] border-[#262626] opacity-60'}`}>
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-base text-[#ffffff] tracking-tight uppercase">{habit.nome_habito}</h4>
                              {!agendadoParaDia && (
                                <span className="text-[9px] font-mono bg-[#262626] text-[#7e7e7e] px-1.5 py-0.5 uppercase">FORA DE HOJE</span>
                              )}
                            </div>
                            <span className="text-xs text-[#bbbbbb] font-mono mt-1.5 flex items-center gap-1.5">
                              <Bell size={13} className="text-[#e22718]" /> 
                              {habit.horarios_notificacao.length > 0 ? habit.horarios_notificacao.join(' | ') : 'SEM ALERTA'}
                            </span>
                          </div>
                        </div>

                        {habit.e_cumulativo ? (
                          <div className="flex items-center justify-between gap-4 bg-[#0d0d0d] p-3 rounded-none border border-[#3c3c3c]">
                            <div className="text-sm font-mono text-[#bbbbbb]">
                              M-METRIC: <span className="font-black text-[#ffffff] text-base">{valorAtualCumulativo}</span> / {habit.meta_objetivo} {habit.unidade_medida}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleAlterarProgressoCumulativo(habit.id, valorAtualCumulativo, -dosePorHora)} className="px-4 py-2 bg-[#1a1a1a] border border-[#3c3c3c] rounded-none font-black text-base active:bg-[#262626]">-</button>
                              <button onClick={() => handleAlterarProgressoCumulativo(habit.id, valorAtualCumulativo, dosePorHora)} className={`px-4 py-2 rounded-none text-xs tracking-[1.5px] uppercase font-black transition ${concluidoCumulativo ? 'bg-[#ffffff] text-[#000000]' : 'bg-[#e22718] text-[#ffffff]'}`}>
                                +{dosePorHora}{habit.unidade_medida}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <button 
                              onClick={() => handleToggleVoto(habit.id, 'NOVO_EU')}
                              className={`text-xs py-3 rounded-none tracking-[1.5px] uppercase transition border font-black flex items-center justify-center gap-1 ${registoHoje?.tipo_voto === 'NOVO_EU' ? 'bg-[#ffffff] text-[#000000] border-[#ffffff]' : 'bg-transparent text-[#ffffff] border-[#3c3c3c] active:bg-[#262626]'}`}
                            >
                              👍 NOVO EU {registoHoje?.tipo_voto === 'NOVO_EU' && '✓'}
                            </button>
                            <button 
                              onClick={() => handleToggleVoto(habit.id, 'VELHO_EU')}
                              className={`text-xs py-3 rounded-none tracking-[1.5px] uppercase transition border font-black flex items-center justify-center gap-1 ${registoHoje?.tipo_voto === 'VELHO_EU' ? 'bg-[#e22718] text-[#ffffff] border-[#e22718]' : 'bg-transparent text-[#e22718] border-[#3c3c3c] active:bg-[#262626]'}`}
                            >
                              👎 VELHO EU {registoHoje?.tipo_voto === 'VELHO_EU' && '✓'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* CONTAINER LATERAL */}
        <div className="space-y-6 md:col-span-1 w-full">
          
          {/* SEPARADOR 2: MÉTRICAS E CALENDÁRIO */}
          <div className={`${tabMobileAtiva === 'metricas' ? 'block' : 'hidden md:block'} space-y-6`}>
            <div className="bg-[#0d0d0d] border border-[#3c3c3c] p-4 rounded-none space-y-3 shadow-none">
              <h3 className="text-xs font-bold tracking-[1.5px] text-[#7e7e7e] uppercase flex items-center gap-1.5"><CalendarIcon size={14} /> CALENDÁRIO COMBINADO (META: 70%):</h3>
              <div className="grid grid-cols-7 gap-2 max-w-xs mx-auto">
                {gerarDiasCalendario().map((dia, idx) => {
                  const dateStr = dia.toISOString().split('T')[0];
                  let somaEficaciasDia = 0, contagemFacetasComHabitos = 0;
                  identities.forEach(f => {
                    if (f.habits.length > 0) { somaEficaciasDia += calcularEficaciaDia(f.habits, dateStr); contagemFacetasComHabitos++; }
                  });
                  const mediaEficaciaGlobalDia = contagemFacetasComHabitos > 0 ? (somaEficaciasDia / contagemFacetasComHabitos) : 0;
                  const temAlgumRegisto = identities.some(f => f.habits.some(h => h.historico_dias[dateStr] !== undefined));
                  const diaVerde = temAlgumRegisto && mediaEficaciaGlobalDia >= 70;
                  const diaVermelho = temAlgumRegisto && mediaEficaciaGlobalDia < 70;
                  const isDiaSelecionadoNoGrid = dateStr === dataSelecionada;

                  return (
                    <button 
                      key={idx} 
                      onClick={() => setDataSelecionada(dateStr)}
                      className={`aspect-square border flex items-center justify-center text-xs font-mono font-bold rounded-none transition ${
                        isDiaSelecionadoNoGrid ? 'ring-2 ring-[#0066b1]' : ''
                      } ${
                        diaVerde 
                          ? 'bg-transparent border-[#ffffff] text-[#ffffff]' 
                          : diaVermelho 
                          ? 'bg-transparent border-[#e22718] text-[#e22718]' 
                          : 'bg-[#1F2942]/10 border-[#3c3c3c] text-[#7e7e7e]'
                      }`}
                    >
                      {dia.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {identities.length > 0 && (
              <div className="bg-[#0d0d0d] border border-[#3c3c3c] p-4 rounded-none space-y-4 shadow-none">
                <div className="flex justify-between items-center border-b border-[#3c3c3c] pb-2.5">
                  <h4 className="text-xs font-bold text-[#ffffff] tracking-[1.5px] uppercase flex items-center gap-1.5">{tipoGrafico === 'barra' ? <BarChart3 size={14}/> : <PieChart size={14}/>} DATA PERFORMANCE</h4>
                  <div className="flex bg-[#1a1a1a] p-0.5 border border-[#3c3c3c] rounded-none">
                    <button onClick={() => setTipoGrafico('barra')} className={`p-1.5 rounded-md ${tipoGrafico === 'barra' ? 'bg-[#ffffff] text-[#000000]' : 'text-[#7e7e7e]'}`}><BarChart3 size={14}/></button>
                    <button onClick={() => setTipoGrafico('redondo')} className={`p-1.5 rounded-md ${tipoGrafico === 'redondo' ? 'bg-[#ffffff] text-[#000000]' : 'text-[#7e7e7e]'}`}><PieChart size={14}/></button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 text-sm">
                  <select value={facetaSelecionadaGrafico || ''} onChange={(e) => setFacetaSelecionadaGrafico(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#3c3c3c] rounded-none p-2.5 text-xs text-[#ffffff] font-mono tracking-wider focus:outline-none">
                    {identities.map(i => <option key={i.id} value={i.id}>{i.nome_identidade.toUpperCase()}</option>)}
                  </select>
                  <div className="flex bg-[#1a1a1a] p-0.5 border border-[#3c3c3c] text-[10px] font-bold tracking-[1.5px] uppercase rounded-none">
                    {(['semana', 'mes', 'ano'] as const).map(f => (
                      <button key={f} onClick={() => setFiltroTempo(f)} className={`flex-1 rounded-none py-1.5 ${filtroTempo === f ? 'bg-[#ffffff] text-[#000000]' : 'text-[#7e7e7e]'}`}>{f === 'mes' ? 'MÊS' : f.toUpperCase()}</button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#1a1a1a] p-4 border border-[#3c3c3c] rounded-none flex flex-col items-center justify-center min-h-[160px]">
                  {tipoGrafico === 'barra' ? (
                    <div className="w-full space-y-4">
                      <div className="text-center mb-1"><span className="text-[10px] text-[#7e7e7e] tracking-[1.5px] uppercase block mb-1">APROVEITAMENTO GLOBAL</span><span className="text-3xl font-black font-mono text-[#ffffff]">{analiseGrafica.mediaGeral}%</span></div>
                      <div className="space-y-3">
                        {analiseGrafica.dadosHabitos.map((dh, idx) => (
                          <div key={idx} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-mono text-[#bbbbbb]"><span className="truncate max-w-[130px] uppercase">{dh.nome}</span><span className="font-bold text-[#ffffff]">{dh.percentagem}%</span></div>
                            <div className="w-full bg-[#0d0d0d] h-1.5 border border-[#3c3c3c] rounded-none overflow-hidden"><div className="bg-[#ffffff] h-full transition-all" style={{ width: `${dh.percentagem}%` }} /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center space-y-2">
                      <div className="relative w-28 h-28 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                          <path className="text-[#0d0d0d]" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                          <path className="text-[#ffffff]" strokeWidth="3" strokeDasharray={`${analiseGrafica.mediaGeral}, 100`} stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        </svg>
                        <div className="absolute text-center"><span className="text-xl font-black font-mono text-[#ffffff]">{analiseGrafica.mediaGeral}%</span></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SEPARADOR 3: CONFIGURAÇÃO */}
          <div className={`${tabMobileAtiva === 'config' ? 'block' : 'hidden md:block'} space-y-6`}>
            <form onSubmit={handleCriarFaceta} className="bg-[#0d0d0d] border border-[#3c3c3c] p-4 rounded-none space-y-3 shadow-none">
              <h4 className="text-xs font-bold text-[#7e7e7e] tracking-[1.5px] uppercase flex items-center gap-1.5"><Layers size={14}/> CRIAR NOVA ÁREA:</h4>
              <div className="flex gap-2">
                <input type="text" placeholder="EX: ATLETA, TÉCNICO" value={novaFacetaNome} onChange={(e) => setNovaFacetaNome(e.target.value)} className="flex-1 bg-[#1a1a1a] border border-[#3c3c3c] rounded-none px-3 py-2.5 text-sm text-[#ffffff] focus:outline-none focus:border-[#ffffff] font-mono" />
                <button type="submit" className="bg-[#ffffff] text-[#000000] font-bold px-4 py-2.5 rounded-none text-xs tracking-[1.5px] uppercase active:bg-[#e6e6e6]">Criar</button>
              </div>
            </form>

            {identities.length > 0 && (
              <form onSubmit={handleCriarHabito} className="bg-[#0d0d0d] border border-[#3c3c3c] p-4 rounded-none space-y-4 shadow-none">
                <h4 className="text-xs font-bold text-[#7e7e7e] tracking-[1.5px] uppercase flex items-center gap-1.5"><Plus size={14}/> CONFIGURAR MICRO-HÁBITO:</h4>
                <div className="space-y-1">
                  <select value={idFacetaAtivaParaHabito || ''} onChange={(e) => setIdFacetaAtivaParaHabito(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#3c3c3c] rounded-none p-2.5 text-sm text-[#ffffff] font-mono focus:outline-none">
                    {identities.map(i => <option key={i.id} value={i.id}>{i.nome_identidade.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <input type="text" placeholder="NOME DO HÁBITO" value={novoHabitoNome} onChange={(e) => setNovoHabitoNome(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#3c3c3c] rounded-none p-2.5 text-sm text-[#ffffff] focus:outline-none focus:border-[#ffffff] font-mono" />
                </div>

                <div className="bg-[#1a1a1a] p-3 border border-[#3c3c3c] rounded-none space-y-2">
                  <label className="text-[10px] font-black text-[#7e7e7e] tracking-[1.5px] uppercase block">DIAS DE EXECUÇÃO</label>
                  <div className="flex justify-between gap-1">
                    {TODOS_OS_DIAS.map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDiaNovoHabito(d)}
                        className={`flex-1 py-1.5 text-xs font-mono font-bold uppercase transition rounded-none ${novoHabitoDias.includes(d) ? 'bg-[#ffffff] text-[#000000]' : 'bg-[#0d0d0d] text-[#7e7e7e] border border-[#3c3c3c]'}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#1a1a1a] p-3 border border-[#3c3c3c] rounded-none space-y-3">
                  <label className="text-[10px] font-black text-[#7e7e7e] tracking-[1.5px] uppercase block">ALERTAS DE NOTIFICAÇÃO</label>
                  <div className="flex gap-2 items-center">
                    <input type="time" value={alertaHoraTmp} onChange={(e) => setAlertaHoraTmp(e.target.value)} className="flex-1 bg-[#0d0d0d] border border-[#3c3c3c] rounded-none p-2.5 text-sm font-mono text-[#ffffff] text-center focus:outline-none" />
                    <button type="button" onClick={adicionarAlertaNaLista} className="bg-[#ffffff] text-[#000000] font-black px-4 py-2.5 rounded-none text-sm">+</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {listaAlertasConfigurados.map((hora) => (
                      <span key={hora} className="bg-[#0d0d0d] border border-[#3c3c3c] text-[#ffffff] font-mono text-xs font-bold px-3 py-1 rounded-none flex items-center gap-1.5">
                        {hora} <button type="button" onClick={() => removerAlertaDaLista(hora)} className="text-[#e22718] font-black text-sm ml-1">×</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-[#1a1a1a] p-3 border border-[#3c3c3c] rounded-none">
                  <input type="checkbox" id="e_cumulativo_box" checked={novoHabitoE_Cumulativo} onChange={(e) => {
                    setNovoHabitoE_Cumulativo(e.target.checked);
                    if (e.target.checked) { setNovoHabitoMeta(3000); setNovoHabitoUnidade('ml'); }
                    else { setNovoHabitoMeta(1); setNovoHabitoUnidade('un'); }
                  }} className="w-4 h-4 bg-[#0d0d0d] border-[#3c3c3c] rounded-none text-[#ffffff] focus:ring-0" />
                  <label htmlFor="e_cumulativo_box" className="text-xs tracking-[1.5px] uppercase font-bold text-[#bbbbbb] cursor-pointer select-none">PROGRESSO CUMULATIVO?</label>
                </div>

                {novoHabitoE_Cumulativo && (
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" value={novoHabitoMeta} onChange={(e) => setNovoHabitoMeta(Number(e.target.value))} className="bg-[#1a1a1a] border border-[#3c3c3c] rounded-none p-2.5 text-sm font-mono text-[#ffffff]" />
                    <input type="text" value={novoHabitoUnidade} onChange={(e) => setNovoHabitoUnidade(e.target.value)} className="bg-[#1a1a1a] border border-[#3c3c3c] rounded-none p-2.5 text-sm text-[#ffffff] font-mono uppercase" />
                  </div>
                )}
                <button type="submit" className="w-full bg-[#e22718] text-[#ffffff] font-black py-3 rounded-none text-xs tracking-[1.5px] uppercase active:bg-red-700">GUARDAR INFRAESTRUTURA</button>
              </form>
            )}

            {/* GESTÃO INFRAESTRUTURA */}
            <div className="space-y-4">
              <h4 className="text-xs font-black text-[#7e7e7e] tracking-[1.5px] uppercase flex items-center gap-1.5"><Sliders size={14}/> INFRAESTRUTURA ATIVA:</h4>
              {identities.map((idnt) => (
                <div key={idnt.id} className="bg-[#1a1a1a] rounded-none p-3 border border-[#3c3c3c] space-y-2.5">
                  <div className="flex justify-between items-center bg-[#0d0d0d] px-3 py-2 rounded-none border border-[#3c3c3c]">
                    <span className="text-sm font-bold text-[#ffffff] uppercase tracking-wide truncate max-w-[150px]">{idnt.nome_identidade}</span>
                    <button onClick={() => setModalConfirm({ tipo: 'area', id: idnt.id, nome: idnt.nome_identidade })} className="text-[#7e7e7e] hover:text-[#e22718] p-1"><Trash2 size={14} /></button>
                  </div>
                  <div className="space-y-1.5 pl-1">
                    {idnt.habits.map((h) => (
                      <div key={h.id} className="flex justify-between items-center bg-[#0d0d0d]/40 px-3 py-1.5 rounded-none text-xs font-mono border border-[#3c3c3c]">
                        <div className="flex flex-col">
                          <span className="text-[#bbbbbb] truncate max-w-[130px] uppercase font-bold">{h.nome_habito}</span>
                          <span className="text-[9px] text-[#7e7e7e] uppercase">{h.dias_semana.join(', ')}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => iniciarEdicaoHabito(h)} className="text-[#7e7e7e] hover:text-blue-400 p-0.5" title="Editar"><Edit3 size={13}/></button>
                          <button onClick={() => setModalConfirm({ tipo: 'habito', id: h.id, nome: h.nome_habito })} className="text-[#7e7e7e] hover:text-[#e22718]"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* MODAL DE EDIÇÃO DE HÁBITO */}
      {habitoEmEdicao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/90 backdrop-blur-xs animate-fade-in">
          <form onSubmit={handleSalvarEdicaoHabito} className="bg-[#0d0d0d] border border-[#3c3c3c] w-full max-w-sm rounded-none p-5 shadow-none space-y-4">
            <div className="flex justify-between items-center border-b border-[#3c3c3c] pb-2">
              <h3 className="text-xs font-black uppercase text-blue-400 tracking-[1.5px] flex items-center gap-1.5"><Edit3 size={14}/> RECONFIGURAR CORE</h3>
              <button type="button" onClick={() => setHabitoEmEdicao(null)} className="text-[#7e7e7e] hover:text-[#ffffff]"><X size={18}/></button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[#7e7e7e] uppercase tracking-wider block">NOME DO MICRO-HÁBITO</label>
              <input type="text" value={editNome} onChange={(e) => setEditNome(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#3c3c3c] rounded-none p-2.5 text-sm text-[#ffffff] font-mono focus:outline-none focus:border-blue-500" />
            </div>

            <div className="bg-[#1a1a1a] p-3 border border-[#3c3c3c] rounded-none space-y-2">
              <label className="text-[10px] font-bold text-[#7e7e7e] uppercase tracking-wider block">DIAS DE EXECUÇÃO</label>
              <div className="flex justify-between gap-1">
                {TODOS_OS_DIAS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDiaEdicao(d)}
                    className={`flex-1 py-1 text-xs font-mono font-bold uppercase transition rounded-none ${editDias.includes(d) ? 'bg-[#ffffff] text-[#000000]' : 'bg-[#0d0d0d] text-[#7e7e7e]'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-[#1a1a1a] p-3 border border-[#3c3c3c] rounded-none space-y-3">
              <label className="text-[10px] font-bold text-[#7e7e7e] uppercase tracking-wider block">AJUSTAR CRONOGRAMAS</label>
              <div className="flex gap-2">
                <input type="time" value={editAlertaTmp} onChange={(e) => setEditAlertaTmp(e.target.value)} className="flex-1 bg-[#0d0d0d] border border-[#3c3c3c] rounded-none p-2 text-sm font-mono text-center text-[#ffffff] focus:outline-none" />
                <button type="button" onClick={adicionarAlertaNaEdicao} className="bg-blue-600 text-[#ffffff] font-bold px-4 rounded-none text-sm">+</button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {editAlertas.map(hora => (
                  <span key={hora} className="bg-[#0d0d0d] border border-[#3c3c3c] text-[#ffffff] font-mono text-xs font-bold px-2.5 py-0.5 rounded-none flex items-center gap-1.5">
                    {hora} <button type="button" onClick={() => removerAlertaNaEdicao(hora)} className="text-[#e22718] font-black text-xs">×</button>
                  </span>
                ))}
              </div>
            </div>

            {habitoEmEdicao.e_cumulativo && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[#7e7e7e] uppercase tracking-wider block mb-1">META</label>
                  <input type="number" value={editMeta} onChange={(e) => setEditMeta(Number(e.target.value))} className="w-full bg-[#1a1a1a] border border-[#3c3c3c] rounded-none p-2.5 text-sm font-mono text-[#ffffff] focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#7e7e7e] uppercase tracking-wider block mb-1">UNIDADE</label>
                  <input type="text" value={editUnidade} onChange={(e) => setEditUnidade(e.target.value)} className="w-full bg-[#1a1a1a] border border-[#3c3c3c] rounded-none p-2.5 text-sm text-[#ffffff] font-mono focus:outline-none" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button type="button" onClick={() => setHabitoEmEdicao(null)} className="bg-[#1a1a1a] border border-[#3c3c3c] text-xs font-bold tracking-[1.5px] uppercase py-2.5 rounded-none">CANCELAR</button>
              <button type="submit" className="bg-blue-600 text-[#ffffff] text-xs font-bold tracking-[1.5px] uppercase py-2.5 rounded-none">GRAVAR REVISÃO</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO */}
      {modalConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000000]/80 backdrop-blur-xs">
          <div className="bg-[#0d0d0d] border border-[#3c3c3c] w-full max-w-sm rounded-none p-6 shadow-none space-y-4">
            <div className="flex justify-between items-center border-b border-[#3c3c3c] pb-2">
              <h3 className="text-xs font-black uppercase text-[#e22718] tracking-[1.5px]">AVISO DE PROTOCOLO</h3>
              <button onClick={() => setModalConfirm(null)} className="text-[#7e7e7e] hover:text-[#ffffff]"><X size={18}/></button>
            </div>
            <p className="text-sm text-[#bbbbbb] leading-relaxed">Tens a certeza de que desejas expurgar o registo <b className="text-[#ffffff]">"{modalConfirm.nome.toUpperCase()}"</b>?</p>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button onClick={() => setModalConfirm(null)} className="bg-[#1a1a1a] border border-[#3c3c3c] text-xs font-bold tracking-[1.5px] uppercase py-2.5 rounded-none">CANCELAR</button>
              <button onClick={ejecutarRemocaoConfirmada} className="bg-[#e22718] text-[#ffffff] text-xs font-bold tracking-[1.5px] uppercase py-2.5 rounded-none">CONFIRMAR REMOÇÃO</button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAV MOBILE */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0d0d0d]/95 backdrop-blur-md border-t border-[#3c3c3c] flex justify-around items-center h-20 pb-3 px-6">
        <button onClick={() => setTabMobileAtiva('painel')} className={`flex flex-col items-center justify-center w-16 h-full transition rounded-none ${tabMobileAtiva === 'painel' ? 'text-[#ffffff] font-black' : 'text-[#7e7e7e]'}`}><Flame size={20} /><span className="text-[10px] mt-1 font-bold tracking-[1.5px] uppercase">PAINEL</span></button>
        <button onClick={() => setTabMobileAtiva('metricas')} className={`flex flex-col items-center justify-center w-16 h-full transition rounded-none ${tabMobileAtiva === 'metricas' ? 'text-[#ffffff] font-black' : 'text-[#7e7e7e]'}`}><BarChart3 size={20} /><span className="text-[10px] mt-1 font-bold tracking-[1.5px] uppercase">METRICS</span></button>
        <button onClick={() => setTabMobileAtiva('config')} className={`flex flex-col items-center justify-center w-16 h-full transition rounded-none ${tabMobileAtiva === 'config' ? 'text-[#ffffff] font-black' : 'text-[#7e7e7e]'}`}><Sliders size={20} /><span className="text-[10px] mt-1 font-bold tracking-[1.5px] uppercase">CONFIG</span></button>
      </div>
    </main>
  );
}