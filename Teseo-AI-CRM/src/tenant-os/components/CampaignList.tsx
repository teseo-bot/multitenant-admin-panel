import React from 'react';
import { useCampaigns } from '../hooks/useCampaigns';

export const CampaignList: React.FC<{ onSelect: (id: string) => void }> = ({ onSelect }) => {
  const { campaigns, loading } = useCampaigns();

  if (loading) return <div className="p-4 text-gray-500">Cargando campañas...</div>;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">Campañas Activas</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left border-collapse">
          <thead>
            <tr className="border-b">
              <th className="py-2 px-4">ID</th>
              <th className="py-2 px-4">Tipo</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4">Score Evaluador</th>
              <th className="py-2 px-4">Actualizado</th>
              <th className="py-2 px-4">Acción</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-4 text-sm font-mono">{c.id.substring(0, 8)}</td>
                <td className="py-2 px-4 text-sm">{c.type}</td>
                <td className="py-2 px-4 text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    c.status === 'sent' ? 'bg-green-100 text-green-800' :
                    c.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {c.status.toUpperCase()}
                  </span>
                </td>
                <td className="py-2 px-4 text-sm">{c.evaluator_score ?? '-'}</td>
                <td className="py-2 px-4 text-sm">{new Date(c.updated_at).toLocaleDateString()}</td>
                <td className="py-2 px-4 text-sm">
                  <button 
                    onClick={() => onSelect(c.id)}
                    className="text-blue-600 hover:underline"
                  >
                    Ver detalles
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
