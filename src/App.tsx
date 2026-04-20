import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, User, deleteUser } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, setDoc, getDoc, addDoc, updateDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { auth, db, loginWithGoogle, logout } from './firebase';
import { Button, Card, Input, Label } from './components/ui';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Settings, 
  MessageSquare, 
  LogOut, 
  Plus, 
  Search, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Bird,
  ExternalLink,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Mic,
  MicOff,
  Send,
  BarChart3
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday, parseISO, isPast, isBefore, addMinutes, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { processVoiceCommandAI, FlowStep } from './services/robotService';
import { cn, formatPhone } from './lib/utils';
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { getDocs, getDocFromServer } from 'firebase/firestore';

import { UserConfig, Client, Appointment, Service, PublicAppointment, UserProfile } from './types';

// --- Firebase Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

// --- Context ---
interface AppContextType {
  user: User | null;
  config: UserConfig | null;
  clients: Client[];
  appointments: Appointment[];
  loading: boolean;
  refreshConfig: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

// --- Components ---

const LoginPage = () => (
  <div className="min-h-screen flex items-center justify-center bg-sky-50 p-4">
    <Card className="max-w-md w-full p-8 text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-20 h-20 bg-sky-500 rounded-full flex items-center justify-center text-white shadow-lg">
          <Bird size={40} />
        </div>
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Sabiá</h1>
        <p className="text-slate-500">Seu sistema inteligente de agendamento</p>
      </div>
      <Button onClick={loginWithGoogle} className="w-full" size="lg">
        Entrar com Google
      </Button>
    </Card>
  </div>
);

const Sidebar = ({ activeTab, setActiveTab, aiEnabled }: { activeTab: string, setActiveTab: (t: string) => void, aiEnabled: boolean }) => {
  const { user } = useApp();
  
  const menuItems = [
    { id: 'agenda', label: 'Agenda', icon: CalendarIcon },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { id: 'plans', label: 'Planos', icon: Settings },
    ...(aiEnabled ? [{ id: 'robot', label: 'Assistente', icon: MessageSquare }] : []),
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-sky-500 rounded-lg flex items-center justify-center text-white">
          <Bird size={24} />
        </div>
        <span className="text-xl font-bold text-slate-900">Sabiá</span>
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              activeTab === item.id 
                ? 'bg-sky-50 text-sky-600 font-semibold' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <item.icon size={20} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 px-4 py-3 mb-4">
          <img src={user?.photoURL || ''} alt="" className="w-8 h-8 rounded-full" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{user?.displayName}</p>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={logout}>
          <LogOut size={20} />
          Sair
        </Button>
      </div>
    </div>
  );
};

// --- Public Booking View ---

const PublicBookingView = () => {
  const { userId } = useParams<{ userId: string }>();
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingData, setBookingData] = useState({ name: '', phone: '' });
  const [isBooking, setIsBooking] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const fetchConfig = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', userId));
        if (docSnap.exists()) {
          setConfig(docSnap.data() as UserConfig);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${userId}`);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [userId]);

  useEffect(() => {
    if (!config || !selectedService || !selectedDate || !userId) return;

    // Real-time listener for appointments to update slots
    const q = query(
      collection(db, 'public_appointments'), 
      where('ownerId', '==', userId),
      where('date', '==', selectedDate)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const existing = snap.docs.map(d => d.data() as PublicAppointment);
      const slots: string[] = [];
      
      // Check if day is blocked
      if (config.blockedDates?.includes(selectedDate)) {
        setAvailableSlots([]);
        return;
      }

      // Check if business is open on this day
      const dayOfWeek = parseISO(selectedDate).getDay();
      if (!config.workingDays?.includes(dayOfWeek)) {
        setAvailableSlots([]);
        return;
      }

      let current = parse(`${selectedDate} ${config.workingHours.start}`, 'yyyy-MM-dd HH:mm', new Date());
      const dayEnd = parse(`${selectedDate} ${config.workingHours.end}`, 'yyyy-MM-dd HH:mm', new Date());

      while (isBefore(current, dayEnd)) {
        const slotStart = format(current, 'HH:mm');
        const slotEnd = format(addMinutes(current, selectedService.duration), 'HH:mm');
        
        // 1. Check if slot is within working hours
        const isWithinHours = slotStart >= config.workingHours.start && slotEnd <= config.workingHours.end;
        
        // 2. Check if slot overlaps with any pause
        const isInPause = (config.pauses || []).some(p => 
          (slotStart >= p.start && slotStart < p.end) || 
          (slotEnd > p.start && slotEnd <= p.end) ||
          (p.start >= slotStart && p.start < slotEnd)
        );

        // 3. Check if slot overlaps with existing appointments
        const isOccupied = existing.some(a => 
          (slotStart >= a.startTime && slotStart < a.endTime) ||
          (slotEnd > a.startTime && slotEnd <= a.endTime) ||
          (a.startTime >= slotStart && a.startTime < slotEnd)
        );

        const isPastSlot = isPast(current) && isToday(current);

        if (isWithinHours && !isInPause && !isOccupied && !isPastSlot) {
          slots.push(slotStart);
        }
        
        current = addMinutes(current, selectedService.duration + selectedService.interval);
      }
      setAvailableSlots(slots);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'public_appointments');
    });

    return () => unsubscribe();
  }, [config, selectedService, selectedDate, userId]);

  const handleBook = async () => {
    if (!selectedSlot) {
      toast.error('Selecione um horário.');
      return;
    }
    if (!bookingData.name || !bookingData.phone) {
      toast.error('Preencha seu nome e telefone.');
      return;
    }

    setIsBooking(true);
    console.log('Iniciando agendamento...', { selectedSlot, bookingData, selectedDate });
    try {
      const start = parse(`${selectedDate} ${selectedSlot}`, 'yyyy-MM-dd HH:mm', new Date());
      const end = addMinutes(start, selectedService!.duration);
      const endTime = format(end, 'HH:mm');

      // 1. Create/Find Client
      const clientsRef = collection(db, 'clients');
      const q = query(clientsRef, where('ownerId', '==', userId), where('phone', '==', bookingData.phone));
      const clientSnap = await getDocs(q);
      
      let clientId = '';
      if (clientSnap.empty) {
        console.log('Criando novo cliente...');
        const newClient = await addDoc(clientsRef, {
          name: bookingData.name,
          phone: bookingData.phone,
          ownerId: userId,
          createdAt: new Date().toISOString()
        });
        clientId = newClient.id;
      } else {
        console.log('Cliente já existe.');
        clientId = clientSnap.docs[0].id;
      }

      // 2. Create Appointment
      console.log('Criando agendamento...');
      await addDoc(collection(db, 'appointments'), {
        clientId,
        clientName: bookingData.name,
        clientPhone: bookingData.phone,
        serviceId: selectedService!.id,
        serviceName: selectedService!.name,
        date: selectedDate,
        startTime: selectedSlot,
        endTime,
        ownerId: userId,
        status: 'confirmed'
      });

      // 3. Create Public Appointment
      console.log('Criando registro público...');
      await addDoc(collection(db, 'public_appointments'), {
        ownerId: userId,
        date: selectedDate,
        startTime: selectedSlot,
        endTime
      });

      console.log('Agendamento concluído com sucesso!');
      toast.success('Agendamento realizado com sucesso!');
      setBookingData({ name: '', phone: '' });
      setSelectedService(null);
      setSelectedSlot(null);
      (document.getElementById('booking-modal') as any).close();
    } catch (e) {
      console.error('Erro no agendamento:', e);
      handleFirestoreError(e, OperationType.WRITE, 'appointments');
      toast.error('Erro ao realizar agendamento.');
    } finally {
      setIsBooking(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-sky-50"><Bird className="animate-bounce text-sky-500" size={48} /></div>;
  if (!config) return <div className="min-h-screen flex items-center justify-center bg-sky-50 text-slate-500">Link inválido ou usuário não encontrado.</div>;

  return (
    <div className="min-h-screen bg-sky-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-sky-500 rounded-full flex items-center justify-center text-white mx-auto shadow-lg mb-4">
            <Bird size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">{config.businessName}</h1>
          <p className="text-slate-500">Agende seu horário de forma rápida e fácil</p>
        </div>

        <Card className="p-6 md:p-8 space-y-8">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="w-6 h-6 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center text-xs">1</span>
              Escolha o Serviço
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(config.services || []).map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedService(s)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selectedService?.id === s.id 
                      ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-100' 
                      : 'border-slate-200 hover:border-sky-200'
                  }`}
                >
                  <p className="font-bold text-slate-900">{s.name}</p>
                  <p className="text-sm text-slate-500">{s.duration} min</p>
                </button>
              ))}
            </div>
          </section>

          {selectedService && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-6 h-6 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center text-xs">2</span>
                Escolha a Data
              </h2>
              <Input 
                type="date" 
                min={format(new Date(), 'yyyy-MM-dd')}
                value={selectedDate} 
                onChange={e => setSelectedDate(e.target.value)} 
              />
            </motion.section>
          )}

          {selectedService && selectedDate && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-6 h-6 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center text-xs">3</span>
                Escolha o Horário
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {availableSlots.length > 0 ? (
                  availableSlots.map(slot => (
                    <button
                      key={slot}
                      onClick={() => {
                        const modal = document.getElementById('booking-modal') as any;
                        if (modal) {
                          modal.showModal();
                          setSelectedSlot(slot);
                        }
                      }}
                      className="p-2 text-sm font-medium rounded-lg border border-slate-200 hover:border-sky-500 hover:text-sky-500 transition-all text-center"
                    >
                      {slot}
                    </button>
                  ))
                ) : (
                  <p className="col-span-full text-center text-slate-400 py-4">Nenhum horário disponível para esta data.</p>
                )}
              </div>
            </motion.section>
          )}
        </Card>
      </div>

      <dialog id="booking-modal" className="modal p-0 rounded-2xl shadow-2xl backdrop:bg-black/50">
        <div className="p-8 w-full max-w-md space-y-6">
          <h3 className="text-xl font-bold">Finalizar Agendamento</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Seu Nome</Label>
              <Input value={bookingData.name} onChange={e => setBookingData({...bookingData, name: e.target.value})} placeholder="Como devemos te chamar?" />
            </div>
            <div className="space-y-2">
              <Label>Seu Telefone</Label>
              <Input 
                value={bookingData.phone} 
                onChange={e => setBookingData({...bookingData, phone: formatPhone(e.target.value)})} 
                placeholder="(11) 98765-4321" 
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => {
              (document.getElementById('booking-modal') as any).close();
              setSelectedSlot(null);
            }}>Cancelar</Button>
            <Button 
              className="flex-1" 
              disabled={isBooking}
              onClick={handleBook}
            >
              {isBooking ? 'Agendando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
};

// --- Plan Selection Overlay ---

const PlanSelectionOverlay = ({ user }: { user: User }) => {
  const handleSelectPlan = async (plan: 'basic' | 'pro') => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        plan,
        aiEnabled: plan === 'pro'
      });
      toast.success(`Plano ${plan.toUpperCase()} selecionado com sucesso!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      toast.error('Erro ao selecionar plano.');
    }
  };

  const commonFeatures = [
    'Agenda completa',
    'Gestão de clientes',
    'Relatórios mensais',
    'Link de agendamento para clientes',
    'Envio de mensagem via WhatsApp (confirmação e cancelamento)'
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl w-full my-8"
      >
        <Card className="p-8 md:p-12 text-center space-y-12 bg-white shadow-2xl border-none">
          <div className="space-y-4">
            <div className="w-20 h-20 bg-gradient-to-br from-sky-400 to-sky-600 rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl transform -rotate-6">
              <Bird size={48} />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Potencialize seu Negócio</h1>
            <p className="text-slate-500 text-lg max-w-lg mx-auto">Escolha o plano ideal para a sua jornada com o Sabiá</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Plano Básico */}
            <Card className="p-8 border-2 border-slate-100 hover:border-slate-200 transition-all flex flex-col justify-between bg-slate-50/50">
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Plano Básico</h3>
                  <p className="text-sm text-slate-500 mt-2 italic">"Ideal para organizar seus atendimentos e clientes de forma simples"</p>
                </div>
                
                <div className="text-5xl font-black text-slate-900">R$ 15<span className="text-base text-slate-400 font-normal ml-1">/mês</span></div>
                
                <ul className="space-y-3 text-left">
                  {commonFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                      <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                  <li className="flex items-start gap-3 text-sm text-slate-400">
                    <XCircle size={18} className="text-slate-300 shrink-0 mt-0.5" />
                    Sem assistente com inteligência artificial
                  </li>
                </ul>
              </div>
              
              <Button 
                onClick={() => handleSelectPlan('basic')}
                className="w-full mt-10 bg-slate-900 hover:bg-slate-800 text-white shadow-lg"
                size="lg"
              >
                Começar agora
              </Button>
            </Card>

            {/* Plano Pro */}
            <Card className="p-8 border-2 border-sky-500 ring-8 ring-sky-500/10 flex flex-col justify-between relative overflow-hidden bg-white shadow-xl">
              <div className="absolute top-0 right-0 bg-sky-500 text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-xl uppercase tracking-widest shadow-sm">Mais Escolhido</div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-sky-600 flex items-center justify-center gap-2">
                    Plano Pro
                  </h3>
                  <p className="text-sm text-slate-600 mt-2 font-medium">"Automatize seu atendimento e ganhe tempo com inteligência artificial"</p>
                </div>
                
                <div className="text-5xl font-black text-sky-600">R$ 120<span className="text-base text-slate-400 font-normal ml-1">/mês</span></div>
                
                <ul className="space-y-3 text-left border-y border-slate-100 py-6">
                  <li className="text-xs font-bold text-sky-600 uppercase tracking-wider mb-4">Tudo do plano básico, mais:</li>
                  <li className="flex items-start gap-3 text-sm font-semibold text-slate-900">
                    <CheckCircle2 size={18} className="text-sky-500 shrink-0 mt-0.5" />
                    Assistente com Inteligência Artificial
                  </li>
                  {[
                    'Comandos por texto e voz',
                    'Criação automática de clientes',
                    'Agendamentos feitos pela IA',
                    'Consulta de agenda em tempo real',
                    'Relatórios automáticos por comando',
                    'Respostas inteligentes para o dia a dia',
                    'Automação de tarefas repetitivas'
                  ].map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                      <CheckCircle2 size={18} className="text-sky-500 shrink-0 mt-0.5 opacity-70" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4 mt-8">
                <Button 
                  onClick={() => handleSelectPlan('pro')}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-200 py-6 text-lg font-bold"
                  size="lg"
                >
                  Ativar Inteligência Artificial
                </Button>
                <p className="text-[11px] text-sky-600 font-bold bg-sky-50 py-2 px-3 rounded-lg border border-sky-100">
                  "A IA trabalha por você: agenda, organiza e responde — tudo em segundos."
                </p>
              </div>
            </Card>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/book/:userId" element={<PublicBookingView />} />
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  );
}

const PlansTab = ({ profile, onToggle, onDelete }: { profile: UserProfile | null, onToggle: () => void, onDelete: () => void }) => (
  <div className="space-y-6 max-w-2xl">
    <div className="flex flex-col gap-1">
      <h2 className="text-2xl font-bold text-slate-900">Gerenciamento de Plano</h2>
      <p className="text-slate-500 text-sm">Gerencie sua assinatura e dados da conta.</p>
    </div>

    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-sky-500 rounded-lg flex items-center justify-center text-white shadow-lg">
            <Settings size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Plano Atual</p>
            <p className="text-xl font-bold text-slate-900 capitalize">{profile?.plan || 'Nenhum'}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={onToggle}
          className="border-sky-200 text-sky-600 hover:bg-sky-50"
        >
          {profile?.plan === 'basic' ? 'Atualizar para Pro' : 'Voltar para Básico'}
        </Button>
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-slate-900">Status da Conta</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500 uppercase font-bold">IA Ativada</p>
            <p className="text-lg font-bold text-slate-900">{profile?.aiEnabled ? 'Sim' : 'Não'}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500 uppercase font-bold">Membro desde</p>
            <p className="text-lg font-bold text-slate-900">
              {profile?.createdAt ? format(parseISO(profile.createdAt), 'dd/MM/yyyy') : '-'}
            </p>
          </div>
        </div>
      </div>
    </Card>

    <Card className="p-6 border-red-100 bg-red-50/30">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-red-600">
          <Trash2 size={20} />
          <h4 className="font-bold">Zona de Perigo</h4>
        </div>
        <p className="text-sm text-slate-600">
          Ao cancelar sua conta, todos os seus agendamentos, clientes e configurações serão apagados permanentemente. Esta ação não pode ser desfeita.
        </p>
        <Button 
          variant="ghost" 
          className="text-red-600 hover:bg-red-100 hover:text-red-700 w-full md:w-auto"
          onClick={onDelete}
        >
          Cancelar conta e apagar todos os dados
        </Button>
      </div>
    </Card>
  </div>
);

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('agenda');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    // Load User Profile (and create if not exists)
    const userRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(userRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.plan !== undefined) {
          setProfile(data as UserProfile);
        } else {
          // Migration/Merge path if existing user only had config
          console.log('Merging profile into existing user doc...');
          const initialProfile = {
            uid: user.uid,
            name: user.displayName || '',
            email: user.email || '',
            plan: 'none',
            aiEnabled: false,
            createdAt: new Date().toISOString()
          };
          await updateDoc(userRef, initialProfile as any);
        }
      } else {
        // Initial setup for new user
        console.log('Creating initial user doc...');
        const initialProfile: UserProfile = {
          uid: user.uid,
          name: user.displayName || '',
          email: user.email || '',
          plan: 'none',
          aiEnabled: false,
          createdAt: new Date().toISOString()
        };
        
        // Also initial config
        const initialConfig: UserConfig = {
          businessName: user.displayName || 'Minha Empresa',
          assistantName: 'Sabiá',
          workingDays: [1, 2, 3, 4, 5],
          workingHours: { start: '08:00', end: '18:00' },
          pauses: [],
          blockedDates: [],
          services: [
            { id: '1', name: 'Consulta Geral', duration: 60, interval: 15 }
          ],
          ownerId: user.uid,
          wakeWord: 'Sabiá',
          continuousListening: true,
          voiceVolume: 1
        };
        
        await setDoc(userRef, { ...initialProfile, ...initialConfig } as any);
      }
      setLoading(false);
    });

    // Load Config
    const unsubConfig = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setConfig(doc.data() as UserConfig);
      }
    });

    // Load Clients
    const clientsQuery = query(collection(db, 'clients'), where('ownerId', '==', user.uid), orderBy('name'));
    const unsubClients = onSnapshot(clientsQuery, (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
    });

    // Load Appointments
    const appointmentsQuery = query(collection(db, 'appointments'), where('ownerId', '==', user.uid));
    const unsubAppointments = onSnapshot(appointmentsQuery, (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
    });

    return () => {
      unsubProfile();
      unsubConfig();
      unsubClients();
      unsubAppointments();
    };
  }, [user]);

  const refreshConfig = async () => {
    if (!user) return;
    const docSnap = await getDoc(doc(db, 'users', user.uid));
    if (docSnap.exists()) setConfig(docSnap.data() as UserConfig);
  };

  const handleTogglePlan = async () => {
    if (!user || !profile) return;
    const newPlan = profile.plan === 'basic' ? 'pro' : 'basic';
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        plan: newPlan,
        aiEnabled: newPlan === 'pro'
      });
      toast.success(`Plano atualizado para ${newPlan.toUpperCase()}!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      toast.error('Erro ao atualizar plano.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    // User requested exactly: "Isso irá apagar todos os seus dados permanentemente. Deseja continuar?"
    const confirmed = window.confirm('Isso irá apagar todos os seus dados permanentemente. Deseja continuar?');
    if (!confirmed) return;

    setLoading(true);
    try {
      const uid = user.uid;

      // PASSO 1: Apagar dados do Firestore (users, clients, appointments, public_appointments, reports)
      
      // Documento do usuário
      const userRef = doc(db, 'users', uid);
      await deleteDoc(userRef);

      // Clients
      const clientsQuery = query(collection(db, 'clients'), where('ownerId', '==', uid));
      const clientsSnap = await getDocs(clientsQuery);
      for (const d of clientsSnap.docs) await deleteDoc(d.ref);

      // Appointments
      const appsQuery = query(collection(db, 'appointments'), where('ownerId', '==', uid));
      const appsSnap = await getDocs(appsQuery);
      for (const d of appsSnap.docs) await deleteDoc(d.ref);

      // Public Appointments 
      const pubQuery = query(collection(db, 'public_appointments'), where('ownerId', '==', uid));
      const pubSnap = await getDocs(pubQuery);
      for (const d of pubSnap.docs) await deleteDoc(d.ref);

      // Reports
      const reportsQuery = query(collection(db, 'reports'), where('ownerId', '==', uid));
      try {
        const reportsSnap = await getDocs(reportsQuery);
        for (const d of reportsSnap.docs) await deleteDoc(d.ref);
      } catch (e) {
        console.log('Collection "reports" not found or already empty');
      }

      // PASSO 2: Excluir conta (Auth)
      try {
        await deleteUser(user);
      } catch (authError: any) {
        console.error('Auth deletion error:', authError);
        // TRATAMENTO DE ERRO: Sessão expirada
        if (authError.code === 'auth/requires-recent-login') {
          toast.error('Faça login novamente para confirmar a exclusão da conta.');
          setLoading(false);
          await logout();
          return;
        }
        throw authError;
      }

      // PASSO 4 & 5: Logout e Finalização
      toast.success('Conta excluída com sucesso.');
      await logout();
    } catch (error: any) {
      console.error('Erro crítico na exclusão:', error);
      handleFirestoreError(error, OperationType.DELETE, 'account_cleanup');
      toast.error('Erro ao excluir dados. Tente novamente mais tarde.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }} 
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-sky-500"
        >
          <Bird size={64} />
        </motion.div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <AppContext.Provider value={{ user, config, clients, appointments, loading, refreshConfig }}>
      <AnimatePresence>
        {profile?.plan === 'none' && <PlanSelectionOverlay user={user} />}
      </AnimatePresence>
      
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} aiEnabled={profile?.aiEnabled || false} />
        
        <main className="flex-1 p-8 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'agenda' && <AgendaView />}
              {activeTab === 'clientes' && <ClientsView />}
              {activeTab === 'relatorios' && <ReportsView />}
              {activeTab === 'robot' && <RobotView />}
              {activeTab === 'plans' && <PlansTab profile={profile} onToggle={handleTogglePlan} onDelete={handleDeleteAccount} />}
              {activeTab === 'settings' && <SettingsView />}
            </motion.div>
          </AnimatePresence>
        </main>
        <Toaster position="top-right" richColors />
      </div>
    </AppContext.Provider>
  );
}

// --- Views ---

const AgendaView = () => {
  const { appointments, config, user } = useApp();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [whatsAppApp, setWhatsAppApp] = useState<Appointment | null>(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const dayAppointments = appointments
    .filter(a => a.date === dateStr)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const handleConfirm = async (app: Appointment) => {
    try {
      await updateDoc(doc(db, 'appointments', app.id), { status: 'completed' });
      toast.success(`Atendimento de ${app.clientName} confirmado!`);
    } catch (e) {
      toast.error('Erro ao confirmar atendimento.');
    }
  };

  const handleDelete = async (id: string) => {
    console.log('Iniciando exclusão de agendamento...', id);
    try {
      const app = appointments.find(a => a.id === id);
      await deleteDoc(doc(db, 'appointments', id));
      
      // Also delete from public
      if (app) {
        const q = query(
          collection(db, 'public_appointments'), 
          where('ownerId', '==', user?.uid),
          where('date', '==', app.date),
          where('startTime', '==', app.startTime)
        );
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
      }
      console.log('Agendamento excluído com sucesso!');
      toast.success('Agendamento excluído!');
    } catch (e) {
      console.error('Erro ao excluir agendamento:', e);
      handleFirestoreError(e, OperationType.DELETE, `appointments/${id}`);
      toast.error('Erro ao excluir agendamento.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      {/* Lado Esquerdo: Mini Calendário */}
      <div className="w-full lg:w-72 flex-shrink-0">
        <Card className="p-4 sticky top-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">
              {format(selectedDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => setSelectedDate(subMonths(selectedDate, 1))}>
                <ChevronLeft size={16} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSelectedDate(addMonths(selectedDate, 1))}>
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
              <span key={i} className="text-[10px] font-bold text-slate-400">{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {(() => {
              const start = startOfWeek(startOfMonth(selectedDate));
              const end = endOfWeek(endOfMonth(selectedDate));
              const days = eachDayOfInterval({ start, end });
              
              return days.map(day => {
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
                const hasAppointments = appointments.some(a => a.date === format(day, 'yyyy-MM-dd'));

                return (
                  <button
                    key={day.toString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "h-8 w-8 rounded-lg text-xs flex flex-col items-center justify-center relative transition-all",
                      isSelected ? "bg-sky-500 text-white font-bold shadow-md" : "hover:bg-sky-50 text-slate-600",
                      !isCurrentMonth && !isSelected && "opacity-30",
                      isToday(day) && !isSelected && "text-sky-500 font-bold border border-sky-200"
                    )}
                  >
                    {format(day, 'd')}
                    {hasAppointments && !isSelected && (
                      <span className="absolute bottom-1 w-1 h-1 bg-sky-400 rounded-full" />
                    )}
                  </button>
                );
              });
            })()}
          </div>

          <Button className="w-full mt-6 gap-2" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Novo Agendamento
          </Button>
        </Card>
      </div>

      {/* Lado Direito: Lista de Agendamentos */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {isToday(selectedDate) ? 'Hoje' : format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h2>
          <span className="text-sm text-slate-500">{dayAppointments.length} agendamentos</span>
        </div>

        {config?.blockedDates?.includes(dateStr) && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl flex items-center gap-3">
            <XCircle size={20} />
            <span className="font-medium">Agenda fechada para este dia.</span>
          </div>
        )}

        <div className="space-y-3">
          {dayAppointments.length > 0 ? (
            dayAppointments.map(app => (
              <Card key={app.id} className="p-4 hover:shadow-md transition-shadow group">
                <div className="flex items-center gap-4">
                  <div className="w-16 flex-shrink-0 text-center border-r border-slate-100 pr-4">
                    <p className="text-sm font-bold text-sky-600">{app.startTime}</p>
                    <p className="text-[10px] text-slate-400">{app.endTime}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 truncate">{app.clientName}</p>
                    <p className="text-xs text-slate-500">{app.serviceName}</p>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {app.status !== 'completed' && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-green-500 hover:text-green-600 hover:bg-green-50" 
                        onClick={() => handleConfirm(app)}
                        title="Confirmar Atendimento"
                      >
                        <CheckCircle2 size={16} />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-sky-500 hover:text-sky-600 hover:bg-sky-50" 
                      onClick={() => setWhatsAppApp(app)}
                      title="Enviar Mensagem"
                    >
                      <MessageSquare size={16} />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeletingId(app.id)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-400">Nenhum agendamento para este dia</p>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && <AppointmentModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} initialDate={selectedDate} />}
      
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-8 max-w-sm w-full space-y-6 shadow-2xl">
            <h3 className="text-xl font-bold">Excluir Agendamento</h3>
            <p className="text-slate-500">Deseja realmente excluir este agendamento? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeletingId(null)}>Cancelar</Button>
              <Button variant="destructive" className="flex-1" onClick={() => handleDelete(deletingId)}>Excluir</Button>
            </div>
          </Card>
        </div>
      )}

      {whatsAppApp && (
        <WhatsAppModal 
          isOpen={!!whatsAppApp} 
          onClose={() => setWhatsAppApp(null)} 
          appointment={whatsAppApp} 
        />
      )}
    </div>
  );
};

const ClientsView = () => {
  const { clients, user } = useApp();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  const handleDelete = async (id: string) => {
    console.log('Iniciando exclusão de cliente...', id);
    try {
      await deleteDoc(doc(db, 'clients', id));
      console.log('Cliente excluído com sucesso!');
      toast.success('Cliente excluído com sucesso!');
    } catch (e) {
      console.error('Erro ao excluir cliente:', e);
      handleFirestoreError(e, OperationType.DELETE, `clients/${id}`);
      toast.error('Erro ao excluir cliente.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Clientes</h2>
          <p className="text-slate-500">Gerencie sua base de contatos</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus size={20} />
          Novo Cliente
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            placeholder="Buscar por nome ou telefone..." 
            className="pl-10" 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map(client => (
          <Card key={client.id} className="p-6 hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-lg">
                {client.name.charAt(0)}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" onClick={() => {
                  setEditingClient(client);
                  setIsModalOpen(true);
                }}>
                  <Edit2 size={16} />
                </Button>
                <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeletingId(client.id)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
            <h3 className="font-bold text-slate-900 mb-1">{client.name}</h3>
            <p className="text-sm text-slate-500 flex items-center gap-2 mb-1">
              <Clock size={14} />
              {formatPhone(client.phone)}
            </p>
            {client.email && (
              <p className="text-sm text-slate-500 truncate mb-4">{client.email}</p>
            )}
            <div className="pt-4 border-t border-slate-50">
              <Button variant="outline" size="sm" className="w-full" onClick={() => {
                setEditingClient(client);
                setIsModalOpen(true);
              }}>
                Ver Prontuário
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {isModalOpen && (
        <ClientModal 
          isOpen={isModalOpen} 
          onClose={() => {
            setIsModalOpen(false);
            setEditingClient(null);
          }} 
          client={editingClient}
        />
      )}

      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-8 max-w-sm w-full space-y-6 shadow-2xl">
            <h3 className="text-xl font-bold">Excluir Cliente</h3>
            <p className="text-slate-500">Deseja realmente excluir este cliente? Todos os dados associados serão perdidos.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeletingId(null)}>Cancelar</Button>
              <Button variant="destructive" className="flex-1" onClick={() => handleDelete(deletingId)}>Excluir</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

const RobotView = () => {
  const { config, user, clients, appointments, refreshConfig, setActiveTab } = useApp();
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: `Olá! Eu sou o ${config?.assistantName || 'Sabiá'}. Você pode digitar um comando ou usar sua voz.` }
  ]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [context, setContext] = useState<any>({});
  const [step, setStep] = useState<FlowStep>('IDLE');
  const [transcript, setTranscript] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [pendingAction, setPendingAction] = useState<any>(null);
  
  const recognitionRef = React.useRef<any>(null);
  const shouldBeListeningRef = React.useRef(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const inactivityTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Calcula faturamento para passar para a IA
  const currentMonthRevenue = appointments
    .filter(a => a.status === 'completed' && a.date.startsWith(format(new Date(), 'yyyy-MM')))
    .reduce((acc, a) => {
      const s = config?.services.find(serv => serv.id === a.serviceId);
      return acc + (s?.price || 0);
    }, 0);

  const criarAgendamento = async (dados: any) => {
    console.log("DENTRO DA FUNÇÃO: agendar", dados);
    if (!dados.nome || !dados.data || !dados.hora_inicio) {
      console.error("ERRO: Dados insuficientes para agendar", dados);
      throw new Error("Dados insuficientes para agendar. Nome, data e hora são obrigatórios.");
    }
    let client = clients.find(c => c.name.toLowerCase().includes(dados.nome.toLowerCase()));
    if (!client) {
      console.warn("AVISO: Cliente não encontrado", dados.nome);
      return `Cliente ${dados.nome} não encontrado. Deseja cadastrar primeiro?`;
    }
    const service = config?.services?.[0];
    const start = parse(`${dados.data} ${dados.hora_inicio}`, 'yyyy-MM-dd HH:mm', new Date());
    const endTime = format(addMinutes(start, service?.duration || 60), 'HH:mm');
    
    console.log("Salvando agendamento no banco...");
    await addDoc(collection(db, 'appointments'), {
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      serviceId: service?.id || 'default',
      serviceName: service?.name || 'Serviço',
      date: dados.data,
      startTime: dados.hora_inicio,
      endTime: endTime,
      ownerId: user?.uid,
      status: 'confirmed'
    });
    console.log("Agendamento salvo com sucesso!");
    return null;
  };

  const criarCliente = async (dados: any) => {
    console.log("DENTRO DA FUNÇÃO: cadastrar", dados);
    if (!dados.nome || !dados.telefone) {
      console.error("ERRO: Nome ou telefone ausente", dados);
      throw new Error("Nome ou telefone ausente para cadastrar cliente.");
    }
    console.log("Salvando cliente no banco...");
    await addDoc(collection(db, 'clients'), {
      name: dados.nome,
      phone: dados.telefone,
      ownerId: user?.uid,
      createdAt: new Date().toISOString()
    });
    console.log("Cliente salvo com sucesso!");
  };

  const cancelarAgendamento = async (dados: any) => {
    console.log("DENTRO DA FUNÇÃO: cancelar", dados);
    if (!dados.data) {
      console.error("ERRO: Data não informada para cancelamento");
      throw new Error("Data não informada para cancelamento.");
    }
    const apps = appointments.filter(a => a.date === dados.data);
    if (dados.nome) {
      const app = apps.find(a => a.clientName.toLowerCase().includes(dados.nome.toLowerCase()));
      if (app) {
        console.log("Deletando agendamento do banco...", app.id);
        await deleteDoc(doc(db, 'appointments', app.id));
        console.log("Agendamento deletado com sucesso!");
      } else {
        console.error("ERRO: Agendamento não encontrado para", dados.nome, "na data", dados.data);
        throw new Error(`Agendamento não encontrado para ${dados.nome} no dia ${dados.data}.`);
      }
    } else {
      console.error("ERRO: Nome do cliente não informado para cancelamento");
      throw new Error("Nome do cliente não informado para cancelamento.");
    }
  };

  const adicionarProntuario = async (dados: any) => {
    console.log("DENTRO DA FUNÇÃO: prontuario", dados);
    if (!dados.nome || !dados.texto) {
      console.error("ERRO: Dados insuficientes para prontuário", dados);
      throw new Error("Dados insuficientes para prontuário. Nome e texto são obrigatórios.");
    }
    const client = clients.find(c => c.name.toLowerCase().includes(dados.nome.toLowerCase()));
    if (client) {
      console.log("Atualizando prontuário no banco...");
      const newNote = `${client.notes || ''}\n[${format(new Date(), 'dd/MM/yyyy HH:mm')}]: ${dados.texto}`;
      await updateDoc(doc(db, 'clients', client.id), { notes: newNote });
      console.log("Prontuário atualizado com sucesso!");
    } else {
      console.error("ERRO: Cliente não encontrado para prontuário", dados.nome);
      throw new Error(`Cliente ${dados.nome} não encontrado para adicionar prontuário.`);
    }
  };

  const editarCliente = async (dados: any) => {
    console.log("DENTRO DA FUNÇÃO: editar_cliente", dados);
    if (!dados.nome) {
      console.error("ERRO: Nome do cliente não informado");
      throw new Error("Nome do cliente não informado para edição.");
    }
    const client = clients.find(c => c.name.toLowerCase().includes(dados.nome.toLowerCase()));
    if (client) {
      console.log("Atualizando dados do cliente no banco...");
      const updates: any = {};
      if (dados.telefone) updates.phone = dados.telefone;
      if (dados.texto) updates.notes = dados.texto;
      await updateDoc(doc(db, 'clients', client.id), updates);
      console.log("Cliente atualizado com sucesso!");
    } else {
      console.error("ERRO: Cliente não encontrado para edição", dados.nome);
      throw new Error(`Cliente ${dados.nome} não encontrado para edição.`);
    }
  };

  const executarAcaoIA = async (respostaIA: any) => {
    console.log("RESPOSTA BRUTA DA IA:", respostaIA);
    
    let parsed: any;
    try {
      parsed = typeof respostaIA === "string" ? JSON.parse(respostaIA) : respostaIA;
      console.log("JSON PARSEADO:", parsed);
    } catch (e) {
      console.error("ERRO AO PARSEAR JSON:", e);
      throw new Error("Erro ao interpretar a resposta da IA.");
    }

    if (!parsed.action && !parsed.acao) {
      console.error("ERRO: Ação (action/acao) não definida na resposta da IA");
      throw new Error("Ação não definida pela IA.");
    }

    if (!parsed.data && !parsed.dados) {
      console.error("ERRO: Dados (data/dados) não enviados na resposta da IA");
      throw new Error("Dados não enviados pela IA.");
    }

    console.log("AÇÃO RECEBIDA:", parsed.action || parsed.acao);
    console.log("DADOS RECEBIDOS:", parsed.data || parsed.dados);
    
    const { action, data, necessita_confirmacao } = parsed;
    
    // Suporte para retrocompatibilidade ou se a IA falar o campo errado em algum momento
    const finalAction = action || parsed.acao;
    const finalData = data || parsed.dados;

    if (necessita_confirmacao) {
      setPendingAction(parsed);
      return;
    }
    
    switch (finalAction) {
      case "confirmar":
        if (pendingAction) {
          const actionToExec = pendingAction;
          setPendingAction(null);
          return await executarAcaoIA({ ...actionToExec, necessita_confirmacao: false });
        }
        return "Não tenho nenhuma ação pendente para confirmar.";
      case "createAppointment":
      case "agendar":
        const dadosAgendamento = {
          nome: finalData.client || finalData.nome,
          data: finalData.date || finalData.data,
          hora_inicio: finalData.time || finalData.hora_inicio
        };
        const resultApp = await criarAgendamento(dadosAgendamento);
        if (resultApp === null) return "Agendamento realizado com sucesso!";
        return resultApp;
      case "createClient":
      case "cadastrar":
        const dadosCliente = {
          nome: finalData.name || finalData.nome,
          telefone: finalData.phone || finalData.telefone
        };
        await criarCliente(dadosCliente);
        return "Cliente cadastrado com sucesso.";
      case "cancelAppointment":
      case "cancelar":
        const dadosCancelamento = {
          data: finalData.date || finalData.data,
          nome: finalData.client || finalData.nome
        };
        await cancelarAgendamento(dadosCancelamento);
        return "Agendamento cancelado com sucesso.";
      case "listClients":
      case "listar_clientes":
        setActiveTab('clientes');
        return "Claro, mudei para a aba de clientes para você.";
      case "getAppointments":
      case "listar_agenda":
        setActiveTab('agenda');
        return "Aqui está a sua agenda de hoje.";
      case "getRevenue":
      case "faturamento":
        setActiveTab('relatórios');
        return "Abri a aba de relatórios com as informações de faturamento.";
      case "none":
        return;
      default:
        console.error("ERRO: Ação desconhecida", finalAction);
        return;
    }
  };

  const playBeep = (type: 'start' | 'end' = 'start') => {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(type === 'start' ? 880 : 440, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
  };

  const stepRef = React.useRef(step);

  const resetInactivityTimeout = () => {
    if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    if (stepRef.current === 'IDLE') return;

    inactivityTimeoutRef.current = setTimeout(() => {
      setStep('IDLE');
      setContext({});
      setTranscript('');
      console.log("Voltando para standby por inatividade");
    }, 5000);
  };

  useEffect(() => {
    stepRef.current = step;
    if (step !== 'IDLE') {
      resetInactivityTimeout();
    } else {
      if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
    }
  }, [step]);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);
  }, []);

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    
    // Stop listening while speaking to avoid feedback
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1;
    utterance.volume = config?.voiceVolume ?? 1;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      if (shouldBeListeningRef.current) {
        startListening();
        resetInactivityTimeout();
      }
    };
    
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    console.log("Botão clicado");
    if (isSpeaking) {
      console.log("Sistema está falando, ignorando início de escuta");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.log("Reconhecimento de voz não suportado");
      alert("Reconhecimento de voz não suportado neste navegador.");
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log("Erro ao parar reconhecimento anterior:", e);
      }
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      console.log("Microfone ATIVO");
      setIsListening(true);
      shouldBeListeningRef.current = true;
    };

    recognition.onresult = (event: any) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        fullTranscript += event.results[i][0].transcript;
      }

      const currentText = fullTranscript.toLowerCase().trim();
      const isFinal = event.results[event.results.length - 1].isFinal;
      
      if (currentText) {
        resetInactivityTimeout();
        handleVoiceInput(currentText, isFinal);
      }
    };

    recognition.onerror = (event: any) => {
      console.log("ERRO:", event.error);
      alert("Erro no microfone: " + event.error);
      
      if (event.error === 'not-allowed') {
        shouldBeListeningRef.current = false;
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      console.log("Microfone FINALIZADO");
      setIsListening(false);
      
      // Auto-restart logic if enabled in config, but keeping it simple for debug
      if (shouldBeListeningRef.current && config?.continuousListening && !isSpeaking) {
        setTimeout(() => {
          if (shouldBeListeningRef.current && !isSpeaking) {
            try { recognition.start(); } catch (e) {}
          }
        }, 1000);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      console.log("Reconhecimento iniciado");
    } catch (e) {
      console.log("Falha crítica ao iniciar recognition:", e);
      alert("Falha ao iniciar microfone: " + e);
    }
  };

  const stopListening = () => {
    shouldBeListeningRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  useEffect(() => {
    if (config?.continuousListening && !isInIframe) {
      startListening();
    }
    return () => {
      shouldBeListeningRef.current = false;
      if (recognitionRef.current) recognitionRef.current.stop();
      window.speechSynthesis.cancel();
    };
  }, [config?.continuousListening, isInIframe]);

  const handleVoiceInput = async (text: string, isFinal: boolean) => {
    const input = text.toLowerCase().trim();
    const wakeWord = (config?.wakeWord || 'Sabiá').toLowerCase();
    const currentStep = stepRef.current;

    // Standby Mode: Listen for wake word
    if (currentStep === 'IDLE') {
      if (input.includes(wakeWord) || input.includes('sabia')) {
        // Stop recognition temporarily to speak
        if (recognitionRef.current) recognitionRef.current.stop();
        
        playBeep('start');
        const msg = "Em que posso ajudar?";
        setMessages(prev => [...prev, { role: 'bot', text: msg }]);
        setStep('WAITING_FOR_INTENT');
        speak(msg);
      }
      return;
    }

    // Active Mode: Wait for final result to process with AI
    if (currentStep === 'WAITING_FOR_INTENT') {
      // Ignore wake word if spoken alone in command mode
      if (input === wakeWord || input === 'sabia') return;

      if (!isFinal) {
        setTranscript(text); // Show interim transcript in UI
        return;
      }

      await processInputWithAI(input);
    }
  };

  const handleTextInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isProcessing) return;

    const input = chatInput.trim();
    setChatInput('');
    setStep('WAITING_FOR_INTENT');
    setMessages(prev => [...prev, { role: 'user', text: input }]);
    
    await processInputWithAI(input);
  };

  const processInputWithAI = async (input: string) => {
    setIsProcessing(true);
    setTranscript('');
    
    try {
      const aiResponse = await processVoiceCommandAI(input, {
        clients,
        appointments,
        config,
        revenue: currentMonthRevenue,
        chatHistory: messages
      });
      
      const errorOverride = await executarAcaoIA(aiResponse);
      let successMessage = errorOverride || aiResponse.mensagem_resposta;

      speak(successMessage);
      setMessages(prev => [...prev, { role: 'bot', text: successMessage }]);
      playBeep('end');
      
      resetInactivityTimeout();
    } catch (error: any) {
      console.error("ERRO REAL:", error);
      const errorMsg = error.message || "Não consegui executar a ação, verifique os dados ou tente novamente.";
      speak("Erro: " + errorMsg);
      setMessages(prev => [...prev, { role: 'bot', text: "Erro: " + errorMsg }]);
      resetInactivityTimeout();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-160px)] flex flex-col">
      {isInIframe && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-amber-800">
            <XCircle size={20} className="shrink-0" />
            <p className="text-sm font-medium">
              Reconhecimento de voz pode não funcionar neste ambiente. Abra em nova aba para garantir o funcionamento.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={openInNewTab} className="bg-white border-amber-200 text-amber-800 hover:bg-amber-100 shrink-0 gap-2">
            <ExternalLink size={14} />
            Abrir em nova aba
          </Button>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Assistente de Voz</h2>
          <p className="text-slate-500">Diga "{config?.wakeWord || 'Sabiá'}" para ativar</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isProcessing ? 'bg-amber-500 animate-pulse' : isListening ? (step === 'IDLE' ? 'bg-sky-500' : 'bg-green-500 animate-pulse') : 'bg-slate-200'}`} />
            <span className="text-xs font-medium text-slate-400">
              {isProcessing ? 'Processando...' : isListening ? (step === 'IDLE' ? 'Standby' : 'Ativo') : 'Inativo'}
            </span>
          </div>
          <Button 
            variant={isListening ? 'destructive' : 'outline'} 
            size="sm" 
            onClick={() => isListening ? stopListening() : startListening()}
            className="gap-2"
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            {isListening ? 'Parar' : 'Ativar'}
          </Button>
        </div>
      </div>

      {transcript && (
        <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl animate-pulse">
          <p className="text-sm text-slate-500 italic">Ouvindo: {transcript}</p>
        </div>
      )}

      <Card className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 border-slate-100 shadow-inner">
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
              <Bird size={64} className="text-slate-300" />
              <p className="text-lg font-medium text-slate-400 max-w-xs">
                Olá! Sou o Sabiá. Você pode digitar um comando abaixo ou usar sua voz.
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={i} 
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] p-5 rounded-3xl shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-sky-500 text-white rounded-tr-none' 
                  : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'
              }`}>
                <p className="text-lg leading-relaxed">{msg.text}</p>
              </div>
            </motion.div>
          ))}
          {isListening && transcript && (
            <div className="flex justify-end">
              <div className="max-w-[85%] p-5 rounded-3xl bg-sky-100 text-sky-600 italic animate-pulse">
                {transcript}...
              </div>
            </div>
          )}
        </div>
        
        <div className="p-6 bg-white border-t border-slate-100">
          <form onSubmit={handleTextInput} className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Input 
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Digite um comando..."
                className="pr-12 h-14 rounded-2xl border-slate-200 focus:border-sky-500 focus:ring-sky-500 text-lg"
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim() || isProcessing}
                className="absolute right-2 top-2 w-10 h-10 bg-sky-500 text-white rounded-xl flex items-center justify-center hover:bg-sky-600 disabled:opacity-50 disabled:bg-slate-300 transition-all"
              >
                <Send size={20} />
              </button>
            </div>
            
            <Button 
              type="button"
              variant={isListening ? 'destructive' : 'outline'} 
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all shadow-md ${isListening ? 'animate-pulse scale-105' : 'hover:border-sky-500 hover:text-sky-500'}`}
              onClick={() => isListening ? stopListening() : startListening()}
            >
              {isListening ? <MicOff size={24} /> : <Mic size={24} />}
            </Button>
          </form>
          <div className="mt-3 flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-amber-500 animate-pulse' : isListening ? (step === 'IDLE' ? 'bg-sky-500' : 'bg-green-500 animate-pulse') : 'bg-slate-200'}`} />
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
              {isProcessing ? 'Sabiá está pensando...' : isListening ? (step === 'IDLE' ? 'Sabiá está ouvindo' : 'Pode falar') : 'Sabiá em standby'}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};

const SettingsView = () => {
  const { config, user, refreshConfig } = useApp();
  const [form, setForm] = useState<UserConfig>({
    businessName: config?.businessName || '',
    assistantName: config?.assistantName || 'Sabiá',
    workingDays: config?.workingDays || [1, 2, 3, 4, 5],
    workingHours: config?.workingHours || { start: '08:00', end: '18:00' },
    pauses: config?.pauses || [],
    services: config?.services || [],
    blockedDates: config?.blockedDates || [],
    ownerId: config?.ownerId || user?.uid || '',
    wakeWord: config?.wakeWord || 'Sabiá',
    continuousListening: config?.continuousListening ?? true,
    voiceVolume: config?.voiceVolume ?? 1
  });

  const handleSave = async () => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), form);
      toast.success('Configurações salvas!');
      refreshConfig();
    } catch (e) {
      toast.error('Erro ao salvar configurações.');
    }
  };

  const addPause = () => {
    setForm({
      ...form,
      pauses: [...(form.pauses || []), { id: Math.random().toString(36).substr(2, 9), name: 'Pausa', start: '12:00', end: '13:00' }]
    });
  };

  const removePause = (id: string) => {
    setForm({ ...form, pauses: (form.pauses || []).filter(p => p.id !== id) });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Configurações</h2>
        <Button onClick={handleSave}>Salvar Alterações</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Mic size={20} className="text-sky-500" />
            Assistente de Voz
          </h3>
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Palavra-chave de Ativação</Label>
              <Input value={form.wakeWord || ''} onChange={e => setForm({...form, wakeWord: e.target.value})} placeholder="Ex: Sabiá" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Escuta Contínua</Label>
              <input 
                type="checkbox" 
                checked={form.continuousListening} 
                onChange={e => setForm({...form, continuousListening: e.target.checked})}
                className="w-5 h-5 accent-sky-500"
              />
            </div>
            <div className="space-y-2">
              <Label>Volume da Voz ({Math.round((form.voiceVolume ?? 1) * 100)}%)</Label>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1" 
                value={form.voiceVolume ?? 1} 
                onChange={e => setForm({...form, voiceVolume: parseFloat(e.target.value)})}
                className="w-full accent-sky-500"
              />
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bird size={20} className="text-sky-500" />
            Identidade
          </h3>
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Nome do Negócio</Label>
              <Input value={form.businessName || ''} onChange={e => setForm({...form, businessName: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Nome do Assistente</Label>
              <Input value={form.assistantName || ''} onChange={e => setForm({...form, assistantName: e.target.value})} />
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock size={20} className="text-sky-500" />
            Horário de Funcionamento
          </h3>
          <Card className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="time" value={form.workingHours.start} onChange={e => setForm({...form, workingHours: {...form.workingHours, start: e.target.value}})} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="time" value={form.workingHours.end} onChange={e => setForm({...form, workingHours: {...form.workingHours, end: e.target.value}})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dias de Atendimento</Label>
              <div className="flex flex-wrap gap-2">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      const newDays = form.workingDays.includes(i)
                        ? form.workingDays.filter(d => d !== i)
                        : [...form.workingDays, i];
                      setForm({...form, workingDays: newDays});
                    }}
                    className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${
                      form.workingDays.includes(i) ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </section>

        <section className="space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Clock size={20} className="text-sky-500" />
              Pausas e Intervalos
            </h3>
            <Button variant="outline" size="sm" onClick={addPause} className="gap-2">
              <Plus size={16} /> Adicionar Pausa
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(form.pauses || []).map((pause, i) => (
              <Card key={pause.id} className="p-4 space-y-3 relative group">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removePause(pause.id)}
                >
                  <Trash2 size={14} />
                </Button>
                <Input 
                  className="font-bold border-none p-0 h-auto focus-visible:ring-0" 
                  value={pause.name || ''} 
                  onChange={e => {
                    const newPauses = [...form.pauses];
                    newPauses[i].name = e.target.value;
                    setForm({...form, pauses: newPauses});
                  }}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-slate-400">Início</Label>
                    <Input type="time" value={pause.start || ''} onChange={e => {
                      const newPauses = [...form.pauses];
                      newPauses[i].start = e.target.value;
                      setForm({...form, pauses: newPauses});
                    }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-slate-400">Fim</Label>
                    <Input type="time" value={pause.end || ''} onChange={e => {
                      const newPauses = [...(form.pauses || [])];
                      newPauses[i].end = e.target.value;
                      setForm({...form, pauses: newPauses});
                    }} />
                  </div>
                </div>
              </Card>
            ))}
            {(form.pauses || []).length === 0 && (
              <div className="md:col-span-2 text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm text-slate-400">Nenhuma pausa configurada</p>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4 md:col-span-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ExternalLink size={20} className="text-sky-500" />
            Link de Agendamento
          </h3>
          <Card className="p-6 flex flex-col md:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <p className="text-sm text-slate-500 mb-2">Compartilhe este link com seus clientes para que eles possam agendar sozinhos:</p>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-xs break-all">
                {`${window.location.origin}/book/${user?.uid}`}
              </div>
            </div>
            <Button 
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/book/${user?.uid}`);
                toast.success('Link copiado para a área de transferência!');
              }}
              className="w-full md:w-auto"
            >
              Copiar Link
            </Button>
          </Card>
        </section>

        <section className="space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Plus size={20} className="text-sky-500" />
              Serviços
            </h3>
            <Button variant="outline" size="sm" onClick={() => setForm({...form, services: [...(form.services || []), { id: Math.random().toString(36).substr(2, 9), name: 'Novo Serviço', duration: 30, interval: 0 }]})}>
              Adicionar Serviço
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(form.services || []).map((s, i) => (
              <Card key={s.id} className="p-6 space-y-4 relative group">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setForm({...form, services: (form.services || []).filter(serv => serv.id !== s.id)})}
                >
                  <Trash2 size={16} />
                </Button>
                <div className="space-y-2">
                  <Label>Nome do Serviço</Label>
                  <Input value={s.name || ''} onChange={e => {
                    const newServices = [...(form.services || [])];
                    newServices[i].name = e.target.value;
                    setForm({...form, services: newServices});
                  }} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duração (min)</Label>
                    <Input type="number" value={s.duration ?? 0} onChange={e => {
                      const newServices = [...form.services];
                      newServices[i].duration = parseInt(e.target.value);
                      setForm({...form, services: newServices});
                    }} />
                  </div>
                  <div className="space-y-2">
                    <Label>Intervalo (min)</Label>
                    <Input type="number" value={s.interval ?? 0} onChange={e => {
                      const newServices = [...form.services];
                      newServices[i].interval = parseInt(e.target.value);
                      setForm({...form, services: newServices});
                    }} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input type="number" value={s.price || 0} onChange={e => {
                      const newServices = [...form.services];
                      newServices[i].price = parseFloat(e.target.value);
                      setForm({...form, services: newServices});
                    }} />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

// --- Modals ---

const AppointmentModal = ({ isOpen, onClose, initialDate }: { isOpen: boolean, onClose: () => void, initialDate: Date | null }) => {
  const { clients, config, user, appointments } = useApp();
  const [form, setForm] = useState({
    clientId: '',
    serviceId: '',
    date: initialDate ? format(initialDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
  });

  const handleSave = async () => {
    if (!form.clientId || !form.serviceId || !form.date || !form.startTime) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    const service = config?.services.find(s => s.id === form.serviceId);
    const client = clients.find(c => c.id === form.clientId);
    if (!service || !client) return;

    // Calculate end time
    const start = parseISO(`${form.date}T${form.startTime}`);
    const end = addMinutes(start, service.duration);
    const endTime = format(end, 'HH:mm');

    // Validations
    if (isPast(start) && !isToday(start)) {
      toast.error('Não é possível agendar em datas passadas.');
      return;
    }

    // Check overlaps
    const overlaps = appointments.filter(a => 
      a.date === form.date && 
      ((form.startTime >= a.startTime && form.startTime < a.endTime) ||
       (endTime > a.startTime && endTime <= a.endTime))
    );

    if (overlaps.length > 0) {
      toast.error('Este horário já está ocupado.');
      return;
    }

    try {
      console.log('Salvando agendamento interno...', form);
      const appData = {
        ...form,
        endTime,
        clientName: client.name,
        clientPhone: client.phone,
        serviceName: service.name,
        ownerId: user?.uid,
        status: 'confirmed'
      };
      await addDoc(collection(db, 'appointments'), appData);
      
      // Also add to public_appointments
      console.log('Salvando registro público...');
      await addDoc(collection(db, 'public_appointments'), {
        ownerId: user?.uid,
        date: form.date,
        startTime: form.startTime,
        endTime
      });

      console.log('Agendamento realizado com sucesso!');
      toast.success('Agendamento realizado!');
      onClose();
    } catch (e) {
      console.error('Erro ao salvar agendamento:', e);
      handleFirestoreError(e, OperationType.WRITE, 'appointments');
      toast.error('Erro ao salvar agendamento.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full space-y-6 shadow-2xl">
        <h3 className="text-xl font-bold">Novo Agendamento</h3>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <select 
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm"
              value={form.clientId}
              onChange={e => setForm({...form, clientId: e.target.value})}
            >
              <option value="">Selecione um cliente</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Serviço</Label>
            <select 
              className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm"
              value={form.serviceId}
              onChange={e => setForm({...form, serviceId: e.target.value})}
            >
              <option value="">Selecione um serviço</option>
              {config?.services?.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Hora</Label>
              <Input type="time" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={handleSave}>Confirmar</Button>
        </div>
      </motion.div>
    </div>
  );
};

const ClientModal = ({ isOpen, onClose, client }: { isOpen: boolean, onClose: () => void, client: Client | null }) => {
  const { user, clients } = useApp();
  const [form, setForm] = useState<Partial<Client>>({
    name: client?.name || '',
    phone: client?.phone || '',
    email: client?.email || '',
    cpf: client?.cpf || '',
    notes: client?.notes || ''
  });

  const handleSave = async () => {
    if (!form.name || !form.phone) {
      toast.error('Nome e telefone são obrigatórios.');
      return;
    }

    try {
      if (client) {
        await updateDoc(doc(db, 'clients', client.id), form);
        toast.success('Cliente atualizado!');
      } else {
        // Check for duplicate phone
        const duplicate = clients.find(c => c.phone === form.phone);
        if (duplicate) {
          toast.error('Este telefone já está cadastrado para outro cliente.');
          return;
        }

        await addDoc(collection(db, 'clients'), {
          ...form,
          ownerId: user?.uid,
          createdAt: new Date().toISOString()
        });
        toast.success('Cliente cadastrado!');
      }
      onClose();
    } catch (e) {
      toast.error('Erro ao salvar cliente.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-8 max-w-2xl w-full space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        <h3 className="text-xl font-bold">{client ? 'Editar Cliente' : 'Novo Cliente'}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome Completo</Label>
            <Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input 
              value={form.phone || ''} 
              onChange={e => setForm({...form, phone: formatPhone(e.target.value)})} 
              placeholder="(11) 98765-4321"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email || ''} onChange={e => setForm({...form, email: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>CPF</Label>
            <Input value={form.cpf || ''} onChange={e => setForm({...form, cpf: e.target.value})} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Prontuário / Anotações</Label>
            <textarea 
              className="w-full h-32 rounded-lg border border-slate-200 p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              value={form.notes || ''}
              onChange={e => setForm({...form, notes: e.target.value})}
              placeholder="Histórico, preferências, observações médicas..."
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={handleSave}>Salvar Cliente</Button>
        </div>
      </motion.div>
    </div>
  );
};

const WhatsAppModal = ({ isOpen, onClose, appointment }: { isOpen: boolean, onClose: () => void, appointment: Appointment }) => {
  const dateStr = format(parseISO(appointment.date), 'dd/MM');
  const time = appointment.startTime;
  
  const confirmMsg = `Olá, ${appointment.clientName}! Sua sessão está confirmada para o dia ${dateStr} às ${time}. Te espero!`;
  const cancelMsg = `Olá, ${appointment.clientName}. Preciso cancelar sua sessão do dia ${dateStr} às ${time}. Peço desculpas pelo transtorno.`;

  const handleSend = (msg: string) => {
    const rawPhone = appointment.clientPhone.replace(/\D/g, '');
    let finalPhone = rawPhone;
    if (rawPhone.length === 10) {
      finalPhone = rawPhone.substring(0, 2) + '9' + rawPhone.substring(2);
    }
    const url = `https://wa.me/55${finalPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-8 max-w-sm w-full space-y-6 shadow-2xl">
        <div className="flex items-center gap-3 text-sky-500 mb-2">
          <MessageSquare size={24} />
          <h3 className="text-xl font-bold">Enviar Mensagem</h3>
        </div>
        <p className="text-slate-500 text-sm">Escolha o tipo de mensagem para <strong>{appointment.clientName}</strong>:</p>
        
        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start h-auto p-4 text-left block" onClick={() => handleSend(confirmMsg)}>
            <p className="font-bold text-slate-900 mb-1">Confirmar Agendamento</p>
            <p className="text-xs text-slate-500 line-clamp-2">{confirmMsg}</p>
          </Button>
          
          <Button variant="outline" className="w-full justify-start h-auto p-4 text-left block border-red-100 hover:bg-red-50" onClick={() => handleSend(cancelMsg)}>
            <p className="font-bold text-red-600 mb-1">Cancelar / Reagendar</p>
            <p className="text-xs text-slate-500 line-clamp-2">{cancelMsg}</p>
          </Button>
        </div>
        
        <Button variant="ghost" className="w-full" onClick={onClose}>Fechar</Button>
      </motion.div>
    </div>
  );
};

const ReportsView = () => {
  const { appointments, config } = useApp();
  const [filter, setFilter] = useState('');
  
  const currentMonthApps = appointments.filter(app => {
    if (app.status !== 'completed') return false;
    const appDate = parseISO(app.date);
    const now = new Date();
    return appDate.getMonth() === now.getMonth() && appDate.getFullYear() === now.getFullYear();
  });

  const processedApps = currentMonthApps.map(app => {
    const service = config?.services.find(s => s.id === app.serviceId);
    return {
      ...app,
      value: service?.price || 0
    };
  }).filter(app => 
    app.clientName.toLowerCase().includes(filter.toLowerCase()) || 
    app.serviceName.toLowerCase().includes(filter.toLowerCase())
  );

  const totalRevenue = processedApps.reduce((acc, curr) => acc + (curr.value || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Relatórios</h2>
        <p className="text-slate-500">Acompanhamento financeiro e desempenho</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-sky-500 text-white shadow-lg border-none overflow-hidden relative group">
          <div className="relative z-10">
            <p className="text-sky-100 text-sm font-medium uppercase tracking-wider mb-1">Faturamento Mensal</p>
            <h3 className="text-3xl font-bold">R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          </div>
          <BarChart3 className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 group-hover:scale-110 transition-transform" />
        </Card>
        
        <Card className="p-6">
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Atendimentos Realizados</p>
          <h3 className="text-3xl font-bold text-slate-900">{processedApps.length}</h3>
        </Card>

        <Card className="p-6">
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Ticket Médio</p>
          <h3 className="text-3xl font-bold text-slate-900">
            R$ {processedApps.length > 0 ? (totalRevenue / processedApps.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
          </h3>
        </Card>
      </div>

      <Card className="overflow-hidden border-slate-100">
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col md:flex-row gap-4 md:items-center justify-between">
          <h3 className="font-bold text-slate-800">Detalhamento de Sessões</h3>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input 
              placeholder="Filtrar por nome ou serviço..." 
              className="pl-10 h-9 text-sm" 
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Data</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Serviço</th>
                <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {processedApps.sort((a,b) => b.date.localeCompare(a.date)).map(app => (
                <tr key={app.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 text-sm text-slate-600 font-medium">{format(parseISO(app.date), 'dd/MM/yyyy')}</td>
                  <td className="p-4 text-sm font-bold text-slate-900">{app.clientName}</td>
                  <td className="p-4 text-sm text-slate-500">{app.serviceName}</td>
                  <td className="p-4 text-sm font-bold text-slate-900 text-right text-sky-600">
                    R$ {app.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {processedApps.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400 italic">
                    Nenhum atendimento realizado encontrado neste mês.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
