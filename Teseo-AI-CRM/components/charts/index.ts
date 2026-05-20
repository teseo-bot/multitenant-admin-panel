import dynamic from 'next/dynamic';

export const LineChart = dynamic(() => import('./convergence-chart'), { ssr: false });
export const BarChart = dynamic(() => import('./distribution-chart'), { ssr: false });
