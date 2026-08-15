// src/app/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Flame, Calendar as CalendarIcon, Plus, Trash2, Trophy, Bell, Layers, BarChart3, PieChart, Clock, RotateCcw, Sliders, Check, User, X, Edit3, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

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
  dom: 'Domingo',
  seg: 'Segunda-feira',
  ter: 'Terça-feira',
  qua: 'Quarta-feira',
  qui: 'Quinta-feira',
  sex: 'Sexta-feira',
  sab: 'Sábado'
};

const TODOS_OS_DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [novaFacetaNome, setNovaFacetaNome] = useState('');
  
  // Data Selecionada
  const dataHojeReal = new Date().toISOString().split('T')[0];
  const [dataSelecionada, setDataSelecionada] = useState<string>(dataHojeReal);

  // Estados Criação
  const [idFacetaAtivaParaHabito, setIdFacetaAtivaParaHabito] = useState<string | null>(null);
  const [novoHabitoNome, setNovoHabitoNome] = useState('');
  const [novoHabitoDias, setNovoHabitoDias] = useState<string[]>([...TODOS_OS_DIAS]);
  const [alertaHoraTmp, setAlertaHoraTmp] = useState('08:00');
  const [listaAlertasConfigurados, setListaAlertasConfigurados] = useState<string[]>(['08:00']);
  const [novoHabitoE_Cumulativo, setNovoHabitoE_Cumulativo] = useState(false);
  const [novoHabitoMeta, setNovoHabitoMeta] = useState(1);
  const [novoHabitoUnidade, setNovoHabitoUnidade] = useState('un');

  // Estados Edição
  const [habitoEmEdicao, setHabitoEmEdicao] = useState<Habit | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editDias, setEditDias] = useState<string[]>([]);
  const [editAlertas, setEditAlertas] = useState<string[]>([]);
  const [editAlertaTmp, setEditAlertaTmp] = useState('08:00');
  const [editMeta, setEditMeta] = useState(1);
  const [editUnidade, setEditUnidade] = useState('un');

  // Gráficos e UI
  const [tipoGrafico, setTipoGrafico] = useState<'barra' | 'redondo'>('barra');
  const [filtroTempo, setFiltroTempo] = useState<'semana' | 'mes' | 'ano'>('mes');
  const [facetaSelecionadaGrafico, setFacetaSelecionadaGrafico] = useState<string | null>(null);
  const [tabMobileAtiva, setTabMobileAtiva] = useState<'painel' | 'metricas' | 'config'>('painel');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [modalConfirm, setModalConfirm] = useState<{ tipo: 'area' | 'habito'; id: string; nome: string } | null>(null);

  const dataSelecionadaObj = useMemo(() => new Date(dataSelecionada + 'T00:00:00'), [dataSelecionada]);
  const diaSemanaSelecionado = useMemo(() => DIAS_DA_SEMANA_MAP[dataSelecionadaObj.getDay()], [dataSelecionadaObj]);
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
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
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

  const mudarDia = (diasDelta: number) => {
    const novaData = new Date(dataSelecionadaObj);
    novaData.setDate(novaData.getDate() + diasDelta);
    setDataSelecionada(novaData.toISOString().split('T')[0]);
  };

  const timelineDiaSelecionado = useMemo(() => {
    const todos: Habit[] = [];
    identities.forEach(ident => {
      ident.habits.forEach(h => {
        if (h.dias_semana.includes(diaSemanaSelecionado)) {
          todos.push({ ...h, nome_identidade: ident.nome_identidade });
        }
      });
    });
    return todos.sort((a, b) => (a.horarios_notificacao[0] || '99:99').localeCompare(b.horarios_notificacao[0] || '99:99'));
  }, [identities, diaSemanaSelecionado]);

  const totalConcluidasDia = useMemo(() => {
    return timelineDiaSelecionado.filter(h => {
      const log = h.historico_dias[dataSelecionada];
      if (!log) return false;
      return h.e_cumulativo ? log.valor_progresso_dia >= h.meta_objetivo : log.tipo_voto === 'NOVO_EU';
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
        somaPercentagens += Math.min(100, (log.valor_progresso_dia / h.meta_objetivo) * 100);
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
      somaEficacias += calcularEficaciaDia(habits, d.toISOString().split('T')[0]);
    }
    return Math.round(somaEficacias / 90);
  };

  const obterDadosFiltroTempo = () => {
    const facetaAlvo = identities.find(i => i.id === facetaSelecionadaGrafico);
    if (!facetaAlvo || facetaAlvo.habits.length === 0) return { mediaGeral: 0, dadosHabitos: [] };

    let numDias = filtroTempo === 'mes' ? 30 : filtroTempo === 'ano' ? 365 : 7;
    const arrayDias: { dateStr: string; diaSemana: string }[] = [];
    for (let i = numDias - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arrayDias.push({ dateStr: d.toISOString().split('T')[0], diaSemana: DIAS_DA_SEMANA_MAP[d.getDay()] });
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
        if (h.e_cumulativo ? log.valor_progresso_dia >= h.meta_objetivo : log.tipo_voto === 'NOVO_EU') diasCumpridos++;
      });

      const performanceHabito = totalDiasAgendados > 0 ? Math.round((diasCumpridos / totalDiasAgendados) * 100) : 100;
      somatorioFaceta += performanceHabito;
      return { id: h.id, nome: h.nome_habito, percentagem: performanceHabito };
    });

    return { mediaGeral: dadosHabitos.length > 0 ? Math.round(somatorioFaceta / dadosHabitos.length) : 0, dadosHabitos };
  };

  async function handleCriarFaceta(e: React.FormEvent) {
    e.preventDefault();
    if (!novaFacetaNome.trim() || !user) return;
    const { error } = await supabase.from('identities').insert([{ nome_identidade: novaFacetaNome.trim(), user_id: user.id }]);
    if (!error) { setNovaFacetaNome(''); carregarEstruturaCompleta(); }
  }

  function toggleDiaNovoHabito(dia: string) {
    setNovoHabitoDias(novoHabitoDias.includes(dia) && novoHabitoDias.length > 1 ? novoHabitoDias.filter(d => d !== dia) : [...novoHabitoDias, dia]);
  }

  function toggleDiaEdicao(dia: string) {
    setEditDias(editDias.includes(dia) && editDias.length > 1 ? editDias.filter(d => d !== dia) : [...editDias, dia]);
  }

  function adicionarAlertaNaLista() {
    if (!listaAlertasConfigurados.includes(alertaHoraTmp)) setListaAlertasConfigurados([...listaAlertasConfigurados, alertaHoraTmp].sort());
  }

  function removerAlertaDaLista(h: string) {
    setListaAlertasConfigurados(listaAlertasConfigurados.filter(x => x !== h));
  }

  async function handleCriarHabito(e: React.FormEvent) {
    e.preventDefault();
    if (!novoHabitoNome.trim() || !idFacetaAtivaParaHabito) return;
    const { error } = await supabase.from('habits').insert([{
      identity_id: idFacetaAtivaParaHabito,
      nome_habito: novoHabitoNome.trim(),
      horarios_notificacao: listaAlertasConfigurados.join(','),
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

  async function handleSalvarEdicaoHabito(e: React.FormEvent) {
    e.preventDefault();
    if (!habitoEmEdicao || !editNome.trim()) return;
    const { error } = await supabase.from('habits').update({
      nome_habito: editNome.trim(),
      horarios_notificacao: editAlertas.join(','),
      dias_semana: editDias,
      meta_objetivo: editMeta,
      unidade_medida: editUnidade
    }).eq('id', habitoEmEdicao.id);

    if (!error) {
      setHabitoEmEdicao(null);
      await carregarEstruturaCompleta();
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
      <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 text-[#f8fafc]">
        <div className="liquid-glass-panel p-6 sm:p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl space-y-6">
          <div className="inline-flex p-3 rounded-2xl bg-white/10 border border-white/20 shadow-inner">
            <Sparkles className="text-amber-400 w-7 h-7 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">IDTT</h2>
            <p className="text-xs text-white/50 tracking-wider uppercase font-medium mt-1">Liquid Identity System</p>
          </div>
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
          }} className="space-y-3.5 text-left">
            <input name="email" type="email" required placeholder="Email" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50 backdrop-blur-md transition" />
            <input name="password" type="password" required placeholder="Palavra-passe" className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/50 backdrop-blur-md transition" />
            <button type="submit" className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:opacity-95 text-white font-semibold py-3 rounded-2xl text-sm shadow-lg shadow-amber-600/25 transition active:scale-[0.98]">
              Iniciar Sessão
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-32 md:pb-12 md:p-6 lg:p-8 flex flex-col items-center w-full select-none">
      
      {/* 🔮 APPLE LIQUID GLASS NAVBAR */}
      <header className="w-full max-w-4xl liquid-glass-panel sticky top-2 sm:top-3 z-40 p-3 sm:p-4 rounded-2xl sm:rounded-3xl mb-3 sm:mb-5 flex justify-between items-center mx-auto shadow-2xl">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-amber-400/20 via-sky-400/20 to-purple-500/20 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
            <Flame className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-base sm:text-lg tracking-tight text-white block leading-tight truncate">IDTT</span>
            <span className="text-[10px] sm:text-[11px] text-white/50 tracking-wider truncate block font-medium">LIFESTYLE ENGINE</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="hidden sm:inline-block text-xs bg-white/5 border border-white/10 text-white/70 px-3 py-1.5 rounded-full font-medium max-w-[130px] truncate">
            {user.email?.split('@')[0]}
          </span>
          <button 
            onClick={carregarEstruturaCompleta} 
            className={`p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition ${isRefreshing ? 'animate-spin' : ''}`}
            title="Recarregar"
          >
            <RotateCcw size={15} className="text-white/80" />
          </button>
          <button 
            onClick={() => supabase.auth.signOut()} 
            className="text-xs text-rose-400 font-medium px-2.5 py-1.5 rounded-xl hover:bg-rose-500/10 transition"
          >
            Sair
          </button>
        </div>
      </header>

      {/* 🧭 SELETOR DE DATA DINÂMICO (TRANSLUCENT LIQUID PILL) */}
      <section className="w-full max-w-4xl px-3 sm:px-0 mb-4 sm:mb-6">
        <div className="liquid-glass-panel p-3 sm:p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xl">
          <div className="flex items-center justify-between sm:justify-start gap-1.5 min-w-0">
            <button 
              onClick={() => mudarDia(-1)} 
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 active:scale-95 transition shrink-0"
              title="Dia Anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1.5 min-w-0">
              <input 
                type="date" 
                value={dataSelecionada} 
                onChange={(e) => setDataSelecionada(e.target.value)} 
                className="bg-white/5 border border-white/10 text-xs font-medium text-white px-3 py-1.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-400 shrink-0"
              />
              <button 
                onClick={() => setDataSelecionada(dataHojeReal)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition shrink-0 ${
                  isHoje 
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black border-amber-300 font-bold shadow-md' 
                    : 'bg-white/5 text-white/60 border-white/10 hover:text-white'
                }`}
              >
                Hoje
              </button>
            </div>

            <button 
              onClick={() => mudarDia(1)} 
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 active:scale-95 transition shrink-0"
              title="Dia Seguinte"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-white/10">
            <div className="text-left sm:text-right min-w-0">
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight block truncate">
                {NOMES_DIAS_EXTENSO[diaSemanaSelecionado]}
              </span>
              <span className="text-[11px] text-white/50 block">
                {dataSelecionada} {!isHoje && <span className="text-amber-400 font-medium">• Histórico</span>}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 📱 PAINEL GRID */}
      <div className="w-full max-w-4xl px-3 sm:px-0 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-start">
        
        {/* COLUNA 1 & 2: TIMELINE & FACETAS */}
        <div className={`${tabMobileAtiva === 'painel' ? 'block' : 'hidden md:block'} space-y-4 sm:space-y-6 md:col-span-2 min-w-0`}>
          
          {/* ✨ TIMELINE OPERACIONAL / LIQUID GLASS HERO */}
          <div className="liquid-glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4 relative overflow-hidden shadow-2xl">
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex justify-between items-center border-b border-white/10 pb-3 gap-2">
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-400 tracking-wider uppercase block truncate">Cronograma Ativo</span>
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2 truncate">
                  <Clock size={18} className="text-amber-400 shrink-0" /> {NOMES_DIAS_EXTENSO[diaSemanaSelecionado]}
                </h3>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider block">Conclusão</span>
                <span className="text-sm sm:text-base font-bold text-white">
                  {totalConcluidasDia}/{timelineDiaSelecionado.length} <span className="text-xs text-white/50 font-normal">({timelineDiaSelecionado.length > 0 ? Math.round((totalConcluidasDia / timelineDiaSelecionado.length) * 100) : 0}%)</span>
                </span>
              </div>
            </div>

            {timelineDiaSelecionado.length === 0 ? (
              <div className="py-8 text-center text-xs sm:text-sm text-white/40 liquid-glass-card rounded-2xl">
                Sem hábitos agendados para este dia.
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
                      className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-300 ${
                        isConcluido 
                          ? 'bg-gradient-to-r from-white/[0.08] to-emerald-500/[0.12] border-emerald-500/40 shadow-sm' 
                          : isFalha 
                          ? 'bg-rose-500/[0.12] border-rose-500/40' 
                          : 'liquid-glass-card border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-xl bg-white/10 border border-white/15 text-white shrink-0 font-mono shadow-xs">
                            {horarioExibicao}
                          </span>
                          <div className="min-w-0">
                            <span className="text-[10px] text-white/50 uppercase font-semibold tracking-wider block truncate">
                              {habit.nome_identidade}
                            </span>
                            <span className={`text-xs sm:text-sm font-semibold block truncate ${isConcluido ? 'text-white/90 line-through decoration-white/40' : 'text-white'}`}>
                              {habit.nome_habito}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isConcluido && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full shadow-xs">
                              <Check size={12} /> Concluído
                            </span>
                          )}
                          {isFalha && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2.5 py-0.5 rounded-full shadow-xs">
                              <X size={12} /> Omitido
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Controlos de Voto / Progresso */}
                      {habit.e_cumulativo ? (
                        <div className="flex items-center justify-between gap-2 bg-black/25 p-2 rounded-xl border border-white/10">
                          <span className="text-xs text-white/70 font-medium truncate">
                            {valorAtual} / {habit.meta_objetivo} {habit.unidade_medida}
                          </span>
                          <div className="flex gap-1.5 shrink-0">
                            <button 
                              onClick={() => handleAlterarProgressoCumulativo(habit.id, valorAtual, -dosePorHora)} 
                              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold transition active:scale-95"
                            >
                              -
                            </button>
                            <button 
                              onClick={() => handleAlterarProgressoCumulativo(habit.id, valorAtual, dosePorHora)} 
                              className={`px-2.5 py-1 rounded-lg text-xs font-semibold shadow-xs transition active:scale-95 ${
                                isConcluido ? 'bg-white text-black' : 'bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold'
                              }`}
                            >
                              +{dosePorHora}{habit.unidade_medida}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => handleToggleVoto(habit.id, 'NOVO_EU')}
                            className={`text-xs py-1.5 rounded-xl font-medium tracking-wide transition border active:scale-95 flex items-center justify-center gap-1.5 ${
                              registo?.tipo_voto === 'NOVO_EU' 
                                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black border-amber-300 font-bold shadow-md shadow-amber-500/20' 
                                : 'bg-white/5 text-white/80 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <Check size={14} className={registo?.tipo_voto === 'NOVO_EU' ? 'text-black font-bold' : 'text-emerald-400'} />
                            <span>Cumprido</span>
                          </button>
                          <button 
                            onClick={() => handleToggleVoto(habit.id, 'VELHO_EU')}
                            className={`text-xs py-1.5 rounded-xl font-medium tracking-wide transition border active:scale-95 flex items-center justify-center gap-1.5 ${
                              registo?.tipo_voto === 'VELHO_EU' 
                                ? 'bg-rose-500 text-white border-rose-500 font-semibold shadow-md shadow-rose-500/25' 
                                : 'bg-white/5 text-rose-300/80 border-white/10 hover:bg-rose-500/10'
                            }`}
                          >
                            <X size={14} className={registo?.tipo_voto === 'VELHO_EU' ? 'text-white' : 'text-rose-400'} />
                            <span>Omitido</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 💎 FACETAS DE IDENTIDADE */}
          {identities.map((faceta) => {
            const pctCristalizacao = calcularCristalizacaoJusta(faceta.habits);
            const eficDia = calcularEficaciaDia(faceta.habits, dataSelecionada);

            return (
              <div key={faceta.id} className="liquid-glass-panel p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-3.5 shadow-xl border border-white/10">
                <div className="flex justify-between items-start border-b border-white/10 pb-2.5 gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block">Área de Identidade</span>
                    <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">{faceta.nome_identidade}</h3>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider block">Consistência 90d</span>
                    <span className="text-xl sm:text-2xl font-bold text-white">{pctCristalizacao}%</span>
                  </div>
                </div>

                {/* Liquid Glass Progress Bar */}
                <div className="w-full bg-white/5 h-2 sm:h-2.5 rounded-full overflow-hidden border border-white/10 p-0.5">
                  <div 
                    className="bg-gradient-to-r from-amber-400 via-amber-500 to-sky-400 h-full rounded-full transition-all duration-700 shadow-sm" 
                    style={{ width: `${pctCristalizacao}%` }} 
                  />
                </div>
                <div className="text-xs text-white/50 flex justify-between font-medium">
                  <span>Ciclo M-Engineering</span>
                  <span>Eficácia no Dia: <b className="text-white">{eficDia}%</b></span>
                </div>
              </div>
            );
          })}
        </div>

        {/* COLUNA 3: MÉTRICAS & CONFIGURAÇÕES */}
        <div className="space-y-4 sm:space-y-6 md:col-span-1 w-full min-w-0">
          
          {/* SEPARADOR 2: MÉTRICAS & CALENDÁRIO */}
          <div className={`${tabMobileAtiva === 'metricas' ? 'block' : 'hidden md:block'} space-y-4 sm:space-y-6`}>
            
            {/* Calendário Liquid Glass */}
            <div className="liquid-glass-panel p-4 rounded-2xl sm:rounded-3xl space-y-3 shadow-xl">
              <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
                <CalendarIcon size={15} className="text-amber-400" /> Calendário Combinado
              </h4>
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {gerarDiasCalendario().map((dia, idx) => {
                  const dateStr = dia.toISOString().split('T')[0];
                  let soma = 0, count = 0;
                  identities.forEach(f => {
                    if (f.habits.length > 0) { soma += calcularEficaciaDia(f.habits, dateStr); count++; }
                  });
                  const media = count > 0 ? (soma / count) : 0;
                  const temRegisto = identities.some(f => f.habits.some(h => h.historico_dias[dateStr] !== undefined));
                  const diaVerde = temRegisto && media >= 70;
                  const diaVermelho = temRegisto && media < 70;
                  const isSel = dateStr === dataSelecionada;

                  return (
                    <button 
                      key={idx} 
                      onClick={() => setDataSelecionada(dateStr)}
                      className={`aspect-square rounded-xl text-xs font-medium transition-all ${
                        isSel ? 'ring-2 ring-amber-400 font-bold bg-amber-400/20' : ''
                      } ${
                        diaVerde 
                          ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30' 
                          : diaVermelho 
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                          : 'bg-white/5 text-white/40 border border-white/5 hover:bg-white/10'
                      }`}
                    >
                      {dia.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Performance Analytics */}
            {identities.length > 0 && (
              <div className="liquid-glass-panel p-4 rounded-2xl sm:rounded-3xl space-y-3 shadow-xl">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                    <BarChart3 size={15} className="text-amber-400" /> Rendimento
                  </h4>
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                    <button onClick={() => setTipoGrafico('barra')} className={`p-1.5 rounded-lg ${tipoGrafico === 'barra' ? 'bg-white text-black font-bold' : 'text-white/50'}`}><BarChart3 size={13}/></button>
                    <button onClick={() => setTipoGrafico('redondo')} className={`p-1.5 rounded-lg ${tipoGrafico === 'redondo' ? 'bg-white text-black font-bold' : 'text-white/50'}`}><PieChart size={13}/></button>
                  </div>
                </div>

                <div className="space-y-2">
                  <select 
                    value={facetaSelecionadaGrafico || ''} 
                    onChange={(e) => setFacetaSelecionadaGrafico(e.target.value)} 
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none"
                  >
                    {identities.map(i => <option key={i.id} value={i.id} className="bg-[#0b0f19]">{i.nome_identidade}</option>)}
                  </select>
                  
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 text-[11px] font-medium">
                    {(['semana', 'mes', 'ano'] as const).map(f => (
                      <button key={f} onClick={() => setFiltroTempo(f)} className={`flex-1 py-1 rounded-lg capitalize transition ${filtroTempo === f ? 'bg-white text-black font-semibold' : 'text-white/50'}`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 liquid-glass-card rounded-2xl flex flex-col items-center justify-center">
                  <span className="text-[10px] text-white/50 uppercase tracking-wider">Aproveitamento Global</span>
                  <span className="text-2xl sm:text-3xl font-bold text-white my-0.5">{analiseGrafica.mediaGeral}%</span>
                  <div className="w-full space-y-1.5 mt-2">
                    {analiseGrafica.dadosHabitos.map((dh, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="flex justify-between text-[11px] text-white/70">
                          <span className="truncate max-w-[130px]">{dh.nome}</span>
                          <span className="font-semibold text-white">{dh.percentagem}%</span>
                        </div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all" style={{ width: `${dh.percentagem}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SEPARADOR 3: CONFIGURAÇÃO / NOVO HÁBITO */}
          <div className={`${tabMobileAtiva === 'config' ? 'block' : 'hidden md:block'} space-y-4 sm:space-y-6`}>
            
            {/* Criar Área */}
            <form onSubmit={handleCriarFaceta} className="liquid-glass-panel p-4 rounded-2xl sm:rounded-3xl space-y-2.5 shadow-xl">
              <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
                <Layers size={14} className="text-amber-400" /> Nova Área
              </h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Ex: Atleta, Profissional" 
                  value={novaFacetaNome} 
                  onChange={(e) => setNovaFacetaNome(e.target.value)} 
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none" 
                />
                <button type="submit" className="bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold px-3.5 py-1.5 rounded-xl text-xs hover:opacity-90 transition shadow-sm">
                  Criar
                </button>
              </div>
            </form>

            {/* Criar Hábito */}
            {identities.length > 0 && (
              <form onSubmit={handleCriarHabito} className="liquid-glass-panel p-4 rounded-2xl sm:rounded-3xl space-y-3 shadow-xl">
                <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
                  <Plus size={14} className="text-amber-400" /> Configurar Hábito
                </h4>
                
                <select 
                  value={idFacetaAtivaParaHabito || ''} 
                  onChange={(e) => setIdFacetaAtivaParaHabito(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none"
                >
                  {identities.map(i => <option key={i.id} value={i.id} className="bg-[#0b0f19]">{i.nome_identidade}</option>)}
                </select>

                <input 
                  type="text" 
                  placeholder="Nome do Hábito" 
                  value={novoHabitoNome} 
                  onChange={(e) => setNovoHabitoNome(e.target.value)} 
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none" 
                />

                {/* Dias da Semana */}
                <div className="space-y-1">
                  <label className="text-[10px] text-white/50 uppercase font-medium">Dias Ativos</label>
                  <div className="flex justify-between gap-1">
                    {TODOS_OS_DIAS.map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDiaNovoHabito(d)}
                        className={`flex-1 py-1 text-[10px] font-bold uppercase rounded-lg transition ${
                          novoHabitoDias.includes(d) 
                            ? 'bg-amber-400 text-black shadow-xs font-bold' 
                            : 'bg-white/5 text-white/40 border border-white/5'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alertas */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-white/50 uppercase font-medium">Horário de Início</label>
                  <div className="flex gap-1.5">
                    <input 
                      type="time" 
                      value={alertaHoraTmp} 
                      onChange={(e) => setAlertaHoraTmp(e.target.value)} 
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl p-1.5 text-xs text-white text-center focus:outline-none" 
                    />
                    <button type="button" onClick={adicionarAlertaNaLista} className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 rounded-xl text-xs">+</button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {listaAlertasConfigurados.map((hora) => (
                      <span key={hora} className="bg-white/10 border border-white/10 text-white text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                        {hora} <button type="button" onClick={() => removerAlertaDaLista(hora)} className="text-rose-400 font-bold ml-1">×</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <input 
                    type="checkbox" 
                    id="e_cum_dark" 
                    checked={novoHabitoE_Cumulativo} 
                    onChange={(e) => {
                      setNovoHabitoE_Cumulativo(e.target.checked);
                      if (e.target.checked) { setNovoHabitoMeta(3000); setNovoHabitoUnidade('ml'); }
                      else { setNovoHabitoMeta(1); setNovoHabitoUnidade('un'); }
                    }} 
                    className="rounded bg-white/5 border-white/10 text-amber-400"
                  />
                  <label htmlFor="e_cum_dark" className="text-xs text-white/70 cursor-pointer select-none">Progresso Cumulativo?</label>
                </div>

                <button type="submit" className="w-full bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold py-2.5 rounded-xl text-xs hover:opacity-95 transition shadow-lg shadow-amber-500/20 active:scale-[0.98]">
                  Guardar Hábito
                </button>
              </form>
            )}

            {/* Lista de Gestão */}
            <div className="liquid-glass-panel p-4 rounded-2xl sm:rounded-3xl space-y-2.5 shadow-xl">
              <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider flex items-center gap-2">
                <Sliders size={14} className="text-amber-400" /> Estrutura
              </h4>
              {identities.map((idnt) => (
                <div key={idnt.id} className="liquid-glass-card p-2.5 rounded-xl space-y-1.5 border border-white/5">
                  <div className="flex justify-between items-center border-b border-white/5 pb-1">
                    <span className="text-xs font-semibold text-white truncate">{idnt.nome_identidade}</span>
                    <button onClick={() => setModalConfirm({ tipo: 'area', id: idnt.id, nome: idnt.nome_identidade })} className="text-white/40 hover:text-rose-400"><Trash2 size={13} /></button>
                  </div>
                  <div className="space-y-1">
                    {idnt.habits.map((h) => (
                      <div key={h.id} className="flex justify-between items-center text-xs text-white/70 py-0.5">
                        <span className="truncate max-w-[130px]">{h.nome_habito}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => iniciarEdicaoHabito(h)} className="text-white/40 hover:text-amber-400"><Edit3 size={12}/></button>
                          <button onClick={() => setModalConfirm({ tipo: 'habito', id: h.id, nome: h.nome_habito })} className="text-white/40 hover:text-rose-400"><Trash2 size={12} /></button>
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

      {/* 🔮 MODAL DE EDIÇÃO APPLE LIQUID GLASS */}
      {habitoEmEdicao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <form onSubmit={handleSalvarEdicaoHabito} className="liquid-glass-panel w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3.5 border border-white/20">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5"><Edit3 size={15} className="text-amber-400"/> Editar Hábito</h3>
              <button type="button" onClick={() => setHabitoEmEdicao(null)} className="text-white/40 hover:text-white"><X size={16}/></button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-white/50 uppercase font-medium">Nome</label>
              <input type="text" value={editNome} onChange={(e) => setEditNome(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-white/50 uppercase font-medium">Dias Ativos</label>
              <div className="flex justify-between gap-1">
                {TODOS_OS_DIAS.map(d => (
                  <button key={d} type="button" onClick={() => toggleDiaEdicao(d)} className={`flex-1 py-1 text-[10px] font-bold uppercase rounded-lg transition ${editDias.includes(d) ? 'bg-amber-400 text-black font-bold' : 'bg-white/5 text-white/40'}`}>{d}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button type="button" onClick={() => setHabitoEmEdicao(null)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold py-2 rounded-xl text-white">Cancelar</button>
              <button type="submit" className="bg-gradient-to-r from-amber-400 to-amber-500 text-black font-bold text-xs py-2 rounded-xl shadow-md">Gravar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO */}
      {modalConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="liquid-glass-panel w-full max-w-xs rounded-3xl p-5 shadow-2xl space-y-3 border border-white/20 text-center">
            <h3 className="text-sm font-bold text-white">Confirmar Remoção</h3>
            <p className="text-xs text-white/60">Desejas remover <b className="text-white">"{modalConfirm.nome}"</b>?</p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button onClick={() => setModalConfirm(null)} className="bg-white/5 border border-white/10 text-xs font-semibold py-1.5 rounded-xl text-white">Cancelar</button>
              <button onClick={ejecutarRemocaoConfirmada} className="bg-rose-500 text-white text-xs font-semibold py-1.5 rounded-xl shadow-md">Remover</button>
            </div>
          </div>
        </div>
      )}

      {/* 📱 APPLE FLOATING TAB BAR */}
      <nav className="fixed bottom-3 left-3 right-3 z-50 md:hidden liquid-glass-panel rounded-2xl flex justify-around items-center h-14 px-3 shadow-2xl border border-white/20">
        <button onClick={() => setTabMobileAtiva('painel')} className={`flex flex-col items-center justify-center transition ${tabMobileAtiva === 'painel' ? 'text-amber-400 font-semibold' : 'text-white/40'}`}>
          <Flame size={18} />
          <span className="text-[10px] mt-0.5">Painel</span>
        </button>
        <button onClick={() => setTabMobileAtiva('metricas')} className={`flex flex-col items-center justify-center transition ${tabMobileAtiva === 'metricas' ? 'text-amber-400 font-semibold' : 'text-white/40'}`}>
          <BarChart3 size={18} />
          <span className="text-[10px] mt-0.5">Métricas</span>
        </button>
        <button onClick={() => setTabMobileAtiva('config')} className={`flex flex-col items-center justify-center transition ${tabMobileAtiva === 'config' ? 'text-amber-400 font-semibold' : 'text-white/40'}`}>
          <Sliders size={18} />
          <span className="text-[10px] mt-0.5">Config</span>
        </button>
      </nav>

    </main>
  );
}