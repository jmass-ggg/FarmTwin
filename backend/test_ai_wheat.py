#!/usr/bin/env python3
"""Test AI with Wheat (high score)"""
import asyncio
from app.services.ai import get_crop_explanation_provider
from app.domain.crop_engine import SimulationResult, ComponentScores
from app.domain.crop_register import CROP_REGISTER


async def main():
    # High-scoring Wheat result
    result = SimulationResult(
        crop_name="Wheat",
        suitability_index=92,
        label="Good match",
        components=ComponentScores(
            temperature=95.0,
            water=88.0,
            soil=None,
            heat_safety=90.0,
            drought_flood_safety=93.0,
            environmental_condition=None,
        ),
        limiting_factor=None,
        reason="All components within optimal ranges",
        hard_exclusion=False,
        hard_exclusion_reason=None,
        engine_version="v5",
        snapshot_id=None,
        data_mode="demo",
        input_completeness={"temperature_mean_c": "real", "rainfall_total_mm": "real"},
    )
    
    wheat_req = next(c for c in CROP_REGISTER if c.name == "Wheat")
    provider = get_crop_explanation_provider()
    
    print("🌾 Generating AI explanation for Wheat (high score)...")
    explanation = await provider.generate(result=result, crop_requirements=wheat_req, farm_id="test-wheat")
    
    print(f"\n✅ Source: {explanation.source}")
    print(f"Headline: {explanation.headline}")
    print(f"Summary: {explanation.summary}")


if __name__ == "__main__":
    asyncio.run(main())
