export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  plan: "none" | "basic" | "pro";
  aiEnabled: boolean;
  createdAt: string;
}

export interface UserConfig {
  businessName: string;
  assistantName: string;
  workingDays: number[]; // 0-6
  workingHours: {
    start: string;
    end: string;
  };
  pauses: Pause[];
  services: Service[];
  blockedDates: string[]; // YYYY-MM-DD
  ownerId: string;
  wakeWord?: string;
  continuousListening?: boolean;
  voiceVolume?: number;
}

export interface Pause {
  id: string;
  name: string;
  start: string;
  end: string;
}

export interface Service {
  id: string;
  name: string;
  duration: number; // minutes
  interval: number; // minutes
  price?: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  notes?: string;
  ownerId: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  serviceName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  ownerId: string;
  status: 'confirmed' | 'cancelled' | 'completed';
}

export interface PublicAppointment {
  id: string;
  ownerId: string;
  date: string;
  startTime: string;
  endTime: string;
}
