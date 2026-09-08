import { demoFarms } from '@/lib/demo/decision-engine';

const headers = {
  'X-FarmTwin-Data-Mode': 'demonstration',
  'X-FarmTwin-Auth-Mode': 'sites_demo',
};

export async function GET() {
  const items = demoFarms.map((farm) => ({
    id: farm.id,
    name: farm.name,
    current_geometry_revision: 1,
    hectares: farm.hectares,
    created_at: '2025-06-15T12:00:00Z',
    updated_at: '2025-06-15T12:00:00Z',
  }));
  return Response.json(
    { items, limit: 50, offset: 0, total: items.length },
    { headers },
  );
}

export async function POST() {
  return Response.json(
    {
      error: {
        code: 'DEMO_READ_ONLY',
        message:
          'Hosted demonstration farms are read-only. Connect the local FastAPI backend to save a new boundary.',
      },
    },
    { status: 503, headers },
  );
}
