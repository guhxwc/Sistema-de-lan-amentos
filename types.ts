
export interface Freight {
  id: string;
  origin: string;
  destination: string;
  value: number | '';
}

export interface Expense {
  id: string;
  description: string;
  value: number | '';
}

export interface Refueling {
  id: string;
  date: string;
  location: string;
  odometer: number | '';
  liters: number | '';
  value: number | '';
}

export interface Maintenance {
  id: string;
  type: string; // ex: Troca de Óleo, Filtro de Ar
  date: string;
  current_km: number | '';
  next_km: number | ''; // Próxima troca
  value: number | '';
  observations?: string;
}

export interface Trip {
  id: string;
  driver: string;
  license_plate: string;
  departure_date: string;
  arrival_date: string;
  initial_km: number | '';
  final_km: number | '';
  freights: Freight[];
  expenses: Expense[];
  refuelings: Refueling[];
  maintenances: Maintenance[];
  observations: string;
  created_at?: string;
}

export interface SettlementItem {
  id: string;
  description: string;
  origin?: string;
  destination?: string;
  value: number | '';
  // Novos campos para cálculo de comissão
  freightValue?: number | '';
  percentage?: number | '';
}

export interface Settlement {
  id: string;
  driver: string;
  date: string;
  observations: string;
  commissions: SettlementItem[];
  additions: SettlementItem[];
  discounts: SettlementItem[];
  fines_balance: string;
  final_balance: number;
  created_at?: string;
}

export interface ReceivableFreight {
  id: string;
  date: string;
  due_date: string;
  delivery_date?: string; // New field
  client: string;
  origin: string;
  destination: string;
  cte: string;
  total_value: number | '';
  paid_value: number | '';
  row_color: string;
  created_at?: string;
}

export interface FiscalNote {
  id: string;
  company: string;
  shipping_date: string;
  nf_number: string;
  status: 'Pendente' | 'Entregue';
  delivery_location: string;
  client_delivered?: boolean;
  created_at?: string;
}

export interface ThirdPartyFreight {
  id: string;
  driver: string;
  license_plate: string;
  date: string;
  origin: string;
  destination: string;
  company_freight_value: number | '';
  paid_freight_value: number | '';
  toll_value: number | '';
  advance_payment: number | '';
  status: 'Pendente' | 'Pago' | 'Parcial';
  created_at?: string;
}

export interface ProcessedCte {
  id: string;
  email_source: string;
  received_at: string;
  xml_content: string;
  cte_number: string;
  client_name: string;
  origin: string;
  destination: string;
  total_value: number;
  emission_date: string;
  is_used: boolean;
}