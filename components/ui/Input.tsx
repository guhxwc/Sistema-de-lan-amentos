
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  currency?: boolean;
}

export const Input: React.FC<InputProps> = ({ label, id, className, currency, onChange, value, type, ...props }) => {
  
  // Função para formatar o valor numérico para o padrão BRL (ex: 1000 -> 1.000,00)
  const formatCurrency = (val: string | number | readonly string[] | undefined) => {
    if (val === '' || val === undefined || val === null) return '';
    // Se for string numérica vindo do DB/Estado, converte. Se já for formatado, mantém.
    const num = Number(val);
    if (isNaN(num)) return '';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Função para lidar com a mudança no input mascarado
  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove tudo que não é dígito
    const rawValue = e.target.value.replace(/\D/g, '');
    
    // Se estiver vazio, define como vazio
    let numericValue: number | '' = '';
    
    if (rawValue) {
        // Divide por 100 para considerar os centavos (ex: digitou 1 -> 0.01)
        numericValue = parseFloat(rawValue) / 100;
    }

    // Cria um evento sintético para passar para o onChange do pai
    // O pai espera receber o valor numérico puro no e.target.value
    const syntheticEvent = {
      ...e,
      target: {
        ...e.target,
        value: numericValue,
        name: props.name
      }
    };

    if (onChange) {
        onChange(syntheticEvent as any);
    }
  };

  return (
    <div className="w-full group">
      <label htmlFor={id} className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 ml-1">
        {label}
      </label>
      {currency ? (
          <input
            id={id}
            type="text" // Input de moeda deve ser texto para aceitar vírgula/ponto visualmente
            inputMode="numeric"
            value={formatCurrency(value)}
            onChange={handleCurrencyChange}
            className={`w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 
            transition-all duration-200 ease-in-out shadow-sm font-medium
            focus:outline-none focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-500/10
            hover:border-slate-400
            sm:text-sm ${className}`}
            {...props}
          />
      ) : (
          <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            className={`w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 
            transition-all duration-200 ease-in-out shadow-sm
            focus:outline-none focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-500/10
            hover:border-slate-400
            sm:text-sm ${className}`}
            {...props}
          />
      )}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, id, className, ...props }) => {
    return (
        <div className="w-full">
            <label htmlFor={id} className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 ml-1">
                {label}
            </label>
            <textarea
                id={id}
                className={`w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 
                transition-all duration-200 ease-in-out shadow-sm
                focus:outline-none focus:bg-white focus:border-sky-600 focus:ring-4 focus:ring-sky-500/10
                hover:border-slate-400
                sm:text-sm ${className}`}
                {...props}
            />
        </div>
    );
};
