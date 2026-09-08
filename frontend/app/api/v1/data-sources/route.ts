export async function GET() {
  return Response.json(
    {
      sources: [
        {
          name: 'coordinate-aware seasonal profile',
          data_mode: 'demonstration',
          last_ingestion_time: null,
          record_count: 0,
          status: 'demonstration',
        },
      ],
    },
    {
      headers: {
        'X-FarmTwin-Data-Mode': 'demonstration',
        'X-FarmTwin-Auth-Mode': 'sites_demo',
      },
    },
  );
}
