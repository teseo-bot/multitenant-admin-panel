import { useState, useEffect } from 'react';

export interface EvaluatorLog {
  id: string;
  source_node: 'sdr' | 'rag' | 'campaign';
  verdict: 'PASS' | 'FAIL';
  score: number;
  retry_count: number;
  feedback: string | null;
  timestamp: string;
  message_content: string;
}

const mockLogs: EvaluatorLog[] = [
  {
    id: 'log1',
    source_node: 'campaign',
    verdict: 'PASS',
    score: 8,
    retry_count: 0,
    feedback: null,
    timestamp: new Date().toISOString(),
    message_content: 'Email sequence draft generated.'
  },
  {
    id: 'log2',
    source_node: 'sdr',
    verdict: 'FAIL',
    score: 4,
    retry_count: 1,
    feedback: 'Demasiado informal, cambia el saludo.',
    timestamp: new Date(Date.now() - 10000).toISOString(),
    message_content: 'Qué onda rey, te vendo esto.'
  },
  {
    id: 'log3',
    source_node: 'sdr',
    verdict: 'PASS',
    score: 9,
    retry_count: 2,
    feedback: null,
    timestamp: new Date(Date.now() - 5000).toISOString(),
    message_content: 'Hola, me gustaría presentarte nuestros servicios.'
  }
];

export function useEvaluatorLogs() {
  const [logs, setLogs] = useState<EvaluatorLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // API simulation
    const timer = setTimeout(() => {
      setLogs(mockLogs);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return { logs, loading };
}
