import { demoFarms } from '@/lib/demo/decision-engine';

const headers = {
  'X-FarmTwin-Data-Mode': 'demonstration',
  'X-FarmTwin-Auth-Mode': 'sites_demo',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ farmId: string }> },
) {
  const { farmId } = await params;
  const farm = demoFarms.find((item) => item.id === farmId);
  if (!farm)
    return Response.json(
      { error: { code: 'NOT_FOUND', message: 'Farm not found' } },
      { status: 404, headers },
    );
  return Response.json(
    {
      id: farm.id,
      name: farm.name,
      current_geometry_revision: 1,
      current_geometry: {
        id: `${farm.id}-geometry-1`,
        revision: 1,
        geometry: farm.geometry,
        centroid: {
          type: 'Point',
          coordinates: [farm.longitude, farm.latitude],
        },
        label_point: {
          type: 'Point',
          coordinates: [farm.longitude, farm.latitude],
        },
        hectares: farm.hectares,
        created_at: '2025-06-15T12:00:00Z',
      },
      created_at: '2025-06-15T12:00:00Z',
      updated_at: '2025-06-15T12:00:00Z',
    },
    { headers },
  );
}
