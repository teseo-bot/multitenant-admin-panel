import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { useTheme } from '../providers/ThemeProvider';

const dataMock = [
  { name: 'Ene', usuarios: 4000, interacciones: 2400 },
  { name: 'Feb', usuarios: 3000, interacciones: 1398 },
  { name: 'Mar', usuarios: 2000, interacciones: 9800 },
  { name: 'Abr', usuarios: 2780, interacciones: 3908 },
  { name: 'May', usuarios: 1890, interacciones: 4800 },
  { name: 'Jun', usuarios: 2390, interacciones: 3800 },
];

export const MetricsChart = () => {
  // Consumimos el contexto global Inmutable
  const { tenantConfig } = useTheme();
  const { primary, secondary } = tenantConfig.branding.colors;

  return (
    <div className="w-full h-96 p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 text-gray-700">Métricas Principales</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={dataMock}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip cursor={{fill: 'transparent'}} />
          <Legend />
          {/* Los colores se inyectan dinámicamente desde el Tenant */}
          <Bar dataKey="usuarios" fill={primary} name="Usuarios Activos" />
          <Bar dataKey="interacciones" fill={secondary} name="Interacciones IA" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
