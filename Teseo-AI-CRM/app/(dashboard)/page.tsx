import { redirect } from 'next/navigation';
export default function RootDashboardPage() {
  // Redirigir el root del dashboard (/) al componente estructurado (/dashboard)
  redirect('/dashboard');
}
