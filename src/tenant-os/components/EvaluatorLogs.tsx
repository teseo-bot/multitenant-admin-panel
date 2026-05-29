import React from 'react';
import { useEvaluatorLogs } from '../hooks/useEvaluatorLogs';

export const EvaluatorLogs: React.FC = () => {
  const { logs, loading } = useEvaluatorLogs();

  if (loading) return <div className="p-4 text-gray-500">Cargando logs del evaluador...</div>;

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-xl font-bold mb-4">Panel de Evaluación (LLM-as-a-Judge)</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left border-collapse">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="py-3 px-4 text-sm font-semibold text-gray-600">Tiempo</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-600">Origen</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-600">Veredicto</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-600">Score</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-600">Reintentos</th>
              <th className="py-3 px-4 text-sm font-semibold text-gray-600">Feedback Inyectado</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </td>
                <td className="py-3 px-4 text-sm">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                    {log.source_node.toUpperCase()}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    log.verdict === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {log.verdict}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm font-medium">{log.score}/10</td>
                <td className="py-3 px-4 text-sm text-center">{log.retry_count}</td>
                <td className="py-3 px-4 text-sm text-gray-700 max-w-xs truncate" title={log.feedback || 'Sin feedback'}>
                  {log.feedback ? (
                    <span className="text-red-600 text-xs">{log.feedback}</span>
                  ) : (
                    <span className="text-gray-400 italic text-xs">Sin feedback</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
