import { useQuery } from '@tanstack/react-query';
import { CanvasLayout } from '@/types/canvas';

interface Template {
  id: string;
  name: string;
  layout: CanvasLayout; // Typed layout definition
  createdAt?: string;
  updatedAt?: string;
}

const fallbackLayout: CanvasLayout = {
  width: 1920,
  height: 1080,
  background: '#ffffff',
  nodes: [
    {
      id: 'demo-heading',
      type: 'heading',
      label: 'Demo Title',
      content: 'Welcome to Asset Studio',
      style: {
        fontSize: '48px',
        fontWeight: 'bold',
        color: '#333333',
        textAlign: 'center',
        padding: '20px',
        width: '100%'
      },
      animation: {
        start: 0,
        duration: 1.5,
        trackIndex: 0,
        ease: 'power3.out',
        from: { y: -50, opacity: 0 }
      },
      visible: true,
      locked: false
    },
    {
      id: 'demo-text',
      type: 'text',
      label: 'Demo Text',
      content: 'This is a sample layout since the database returned empty.',
      style: {
        fontSize: '24px',
        color: '#666666',
        textAlign: 'center',
        marginTop: '20px',
        width: '100%'
      },
      animation: {
        start: 0.5,
        duration: 1.5,
        trackIndex: 1,
        ease: 'power3.out',
        from: { y: 50, opacity: 0 }
      },
      visible: true,
      locked: false
    }
  ]
};

const fetchTemplate = async (id: string): Promise<Template> => {
  const response = await fetch(`/api/templates/${id}`);
  if (!response.ok) {
    if (response.status === 404) {
      // Return a mock template with the fallback layout
      return {
        id,
        name: 'Mock Template',
        layout: fallbackLayout,
      };
    }
    throw new Error('Failed to fetch template layout');
  }
  const data = await response.json();
  if (!data.layout || !data.layout.nodes) {
    data.layout = fallbackLayout;
  }
  return data;
};

export const useTemplate = (id: string) => {
  return useQuery({
    queryKey: ['template', id],
    queryFn: () => fetchTemplate(id),
    enabled: !!id, // Only run the query if an ID is provided
  });
};
