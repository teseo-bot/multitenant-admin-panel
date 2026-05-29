import React from 'react';
import { useCampaign } from '../hooks/useCampaigns';

export const CampaignDetail: React.FC<{ campaignId: string, onBack: () => void }> = ({ campaignId, onBack }) => {
  const { campaign, loading } = useCampaign(campaignId);

  if (loading) return <div className="p-4 text-gray-500">Cargando detalles de campaña...</div>;
  if (!campaign) return <div className="p-4 text-red-500">Campaña no encontrada.</div>;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <button onClick={onBack} className="text-blue-600 hover:underline mb-4">&larr; Volver a la lista</button>
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Detalle de Campaña</h2>
        <span className={`px-3 py-1 rounded text-sm font-semibold ${
          campaign.status === 'sent' ? 'bg-green-100 text-green-800' :
          campaign.status === 'failed' ? 'bg-red-100 text-red-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {campaign.status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-gray-500 text-sm">ID</p>
          <p className="font-mono text-sm">{campaign.id}</p>
        </div>
        <div>
          <p className="text-gray-500 text-sm">Tipo</p>
          <p className="font-medium">{campaign.type}</p>
        </div>
        <div>
          <p className="text-gray-500 text-sm">Score Evaluador</p>
          <p className="font-medium">{campaign.evaluator_score ?? 'N/A'}</p>
        </div>
        <div>
          <p className="text-gray-500 text-sm">Última Actualización</p>
          <p className="font-medium">{new Date(campaign.updated_at).toLocaleString()}</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold border-b pb-2 mb-2">Contenido</h3>
        <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto">
          {JSON.stringify(campaign.content, null, 2)}
        </pre>
      </div>

      {campaign.evaluator_feedback && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <h3 className="text-red-800 font-semibold mb-1">Feedback del Evaluador</h3>
          <p className="text-red-700 text-sm">{campaign.evaluator_feedback}</p>
        </div>
      )}
    </div>
  );
};
