import { GoogleGenAI, Type } from "@google/genai";
import { format, addDays, nextMonday, nextTuesday, nextWednesday, nextThursday, nextFriday, nextSaturday, nextSunday, isBefore, startOfDay, addMinutes, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export type RobotActionType = 
  | 'createClient' 
  | 'createAppointment' 
  | 'getAppointments'
  | 'getRevenue'
  | 'cancelAppointment'
  | 'listClients'
  | 'confirmar'
  | 'desconhecido';

export type FlowStep = 
  | 'IDLE'
  | 'WAITING_FOR_INTENT'
  | 'WAITING_FOR_CONFIRMATION'
  | 'AI_PROCESSING';

export interface RobotResponse {
  message: string;
  nextStep: FlowStep;
  action?: {
    type: RobotActionType;
    payload: any;
  };
}

export async function processVoiceCommandAI(text: string, context: any = {}): Promise<any> {
  const { clients = [], appointments = [], config = null, revenue = 0, chatHistory = [] } = context;

  const servicesInfo = config?.services?.map((s: any) => `${s.name} (R$ ${s.price || 0}, ${s.duration}min)`).join(', ') || 'Nenhum serviço cadastrado';
  const appointmentsSummary = appointments
    .filter((a: any) => a.date === format(new Date(), 'yyyy-MM-dd'))
    .map((a: any) => `${a.startTime}: ${a.clientName} (${a.serviceName})`)
    .join(', ') || 'Nenhum agendamento para hoje';

  const historyText = chatHistory.slice(-5).map((h: any) => `${h.role === 'user' ? 'Usuário' : 'Sabiá'}: ${h.text}`).join('\n');

  const prompt = `Você é o assistente inteligente "Sabiá". Você ajuda a gerenciar uma clínica/consultório.
Responda de forma natural, amigável e concisa no campo "mensagem_resposta".

DADOS ATUAIS DO SISTEMA:
- Data de hoje: ${format(new Date(), 'eeee, dd/MM/yyyy', { locale: ptBR })}.
- Serviços disponíveis: ${servicesInfo}.
- Total de clientes cadastrados: ${clients.length}.
- Agendamentos de hoje: ${appointmentsSummary}.
- Faturamento total deste mês: R$ ${revenue.toFixed(2)}.

HISTÓRICO RECENTE:
${historyText}

INSTRUÇÕES:
1. Se o usuário quiser ADICIONAR algo (agendamento ou cliente), você deve PRIMEIRO pedir confirmação se tiver os dados.
   Ex: "Deseja que eu agende Maria para terça às 14h com massagem?"
2. Se o usuário confirmar (ex: "sim", "pode", "confirma"), e no histórico houver um pedido pendente (necessita_confirmacao: true), agora use a action "confirmar".
3. Se o usuário quiser INFORMAÇÕES (faturamento, clientes, agenda), retorne a action correspondente.
4. Use o campo "necessita_confirmacao" (boolean) para indicar que você está esperando um "sim" para executar a ação no próximo turno.
5. SEMPRE retorne um JSON válido.

MAPEAMENTO DE AÇÕES (campo "action"):
- "createAppointment": Criar agendamento (requer no data: client, service, date, time).
- "createClient": Criar cliente (requer no data: name, phone).
- "cancelAppointment": Cancelar agendamento.
- "listClients": Mostrar lista de clientes.
- "getAppointments": Mostrar agenda do dia ou período.
- "getRevenue": Informar sobre ganhos e relatórios.
- "confirmar": O usuário confirmou a ação anterior.
- "none": Quando for apenas conversa ou não entender.

A ação "createAppointment" DEVE usar o nome do serviço (service) exatamente como listado nos serviços disponíveis.

FORMATO DE RESPOSTA (JSON):
{
  "action": "string",
  "necessita_confirmacao": boolean,
  "mensagem_resposta": "string",
  "data": { ... }
}

Novo comando do usuário: "${text}"`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: {
              type: Type.STRING,
              enum: ["createAppointment", "createClient", "cancelAppointment", "listClients", "getAppointments", "getRevenue", "confirmar", "none"],
            },
            necessita_confirmacao: {
              type: Type.BOOLEAN,
            },
            data: {
              type: Type.OBJECT,
              properties: {
                client: { type: Type.STRING },
                service: { type: Type.STRING },
                date: { type: Type.STRING },
                time: { type: Type.STRING },
                name: { type: Type.STRING },
                phone: { type: Type.STRING },
                texto: { type: Type.STRING }
              }
            },
            mensagem_resposta: {
              type: Type.STRING,
            }
          },
          required: ["action", "mensagem_resposta", "necessita_confirmacao"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Erro na IA:", error);
    return { acao: "desconhecido", necessita_confirmacao: false, mensagem_resposta: "Desculpe, tive um problema ao processar seu pedido." };
  }
}
