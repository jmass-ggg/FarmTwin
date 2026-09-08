import {
  buildDemoDecisionSupport,
  demoFarms,
} from '@/lib/demo/decision-engine';

const headers = {
  'X-FarmTwin-Data-Mode': 'demonstration',
  'X-FarmTwin-Auth-Mode': 'sites_demo',
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ farmId: string }> },
) {
  const { farmId } = await params;
  const farm = demoFarms.find((item) => item.id === farmId);
  if (!farm)
    return Response.json(
      { error: { code: 'NOT_FOUND', message: 'Farm not found' } },
      { status: 404, headers },
    );
  const body = (await request.json()) as {
    selected_month?: number;
    rainfall_change_pct?: number;
    temperature_change_c?: number;
  };
  const month = Math.max(1, Math.min(12, Math.round(body.selected_month ?? 1)));
  const rainfall = Math.max(-50, Math.min(50, body.rainfall_change_pct ?? 0));
  const temperature = Math.max(-5, Math.min(5, body.temperature_change_c ?? 0));
  return Response.json(
    buildDemoDecisionSupport(farm, month, rainfall, temperature),
    { headers },
  );
}
