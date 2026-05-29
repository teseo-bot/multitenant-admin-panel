import React, { useState } from 'react';
import { CampaignList } from './components/CampaignList';
import { CampaignDetail } from './components/CampaignDetail';
import { EvaluatorLogs } from './components/EvaluatorLogs';

export const TenantOSDashboard: React.FC = () => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">Tenant OS - Command Center</h1>
          <p className="text-gray-500 mt-2">Monitoreo de Campañas y Evaluador LLM-as-a-Judge</p>
        </header>

        <section>
          {selectedCampaignId ? (
            <CampaignDetail 
              campaignId={selectedCampaignId} 
              onBack={() => setSelectedCampaignId(null)} 
            />
          ) : (
            <CampaignList onSelect={(id) => setSelectedCampaignId(id)} />
          )}
        </section>

        <section>
          <EvaluatorLogs />
        </section>
      </div>
    </div>
  );
};

export default TenantOSDashboard;
