#!/usr/bin/env python3
"""
Quick verification that AI explanation is working with current environment.
"""
import asyncio
from app.core.config import Settings
from app.services.ai import get_crop_explanation_provider
from app.domain.crop_engine import SimulationResult, ComponentScores
from app.domain.crop_register import CROP_REGISTER


async def main():
    settings = Settings()
    
    print(f"🔑 OpenRouter API Key configured: {'Yes' if settings.openrouter_api_key.get_secret_value() else 'No'}")
    print(f"🤖 Model: {settings.openrouter_model}")
    print()
    
    # Create a test simulation result for Maize
    test_result = SimulationResult(
        crop_name="Maize",
        suitability_index=54,
        label="Higher caution",
        components=ComponentScores(
            temperature=85.0,
            water=30.0,
            soil=None,
            heat_safety=95.0,
            drought_flood_safety=90.0,
            environmental_condition=None,
        ),
        limiting_factor="water / rainfall",
        reason="Low water component score",
        hard_exclusion=False,
        hard_exclusion_reason=None,
        engine_version="v5",
        snapshot_id=None,
        data_mode="demo",
        input_completeness={
            "temperature_mean_c": "real",
            "rainfall_total_mm": "real",
            "soil_ph": "missing",
            "soil_clay_pct": "missing",
        },
    )
    
    # Get crop requirements
    maize_req = next(c for c in CROP_REGISTER if c.name == "Maize")
    
    # Generate explanation
    provider = get_crop_explanation_provider()
    
    print("🌽 Generating AI explanation for Maize...")
    explanation = await provider.generate(
        result=test_result,
        crop_requirements=maize_req,
        farm_id="test-farm-live",
    )
    
    print(f"\n✅ Success!")
    print(f"Source: {explanation.source}")
    print(f"Cached: {explanation.cached}")
    print(f"\nHeadline: {explanation.headline}")
    print(f"\nSummary: {explanation.summary}")
    
    if explanation.strengths:
        print("\n✓ Strengths:")
        for s in explanation.strengths:
            print(f"  - {s.factor}: {s.message}")
    
    if explanation.concerns:
        print("\n⚠ Concerns:")
        for c in explanation.concerns:
            print(f"  - {c.factor}: {c.message}")
    
    if explanation.action:
        print(f"\n💡 Action: {explanation.action}")
    
    if explanation.data_note:
        print(f"\n📝 Note: {explanation.data_note}")


if __name__ == "__main__":
    asyncio.run(main())
