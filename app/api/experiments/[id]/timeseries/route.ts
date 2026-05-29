import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const ALLOWED_BUCKETS = ['hour', 'day', 'week'];

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    
    // Optional bucket query param
    const { searchParams } = new URL(request.url);
    const rawBucket = searchParams.get('bucket') || 'day';
    const bucket = ALLOWED_BUCKETS.includes(rawBucket) ? rawBucket : 'day';

    const { data, error } = await supabase.rpc('get_experiment_timeseries', {
      p_experiment_id: id,
      p_bucket: bucket,
    });

    if (error) {
      console.error('Error fetching experiment timeseries:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
