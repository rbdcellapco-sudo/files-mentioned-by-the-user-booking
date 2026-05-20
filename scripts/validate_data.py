from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "public" / "data" / "dashboard-data.json"


def assert_equal(actual: object, expected: object, label: str) -> None:
    if actual != expected:
        raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")


def main() -> None:
    payload = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    rows = payload["metadata"]["rowCounts"]
    circle = payload["circle"]
    quality = payload["dataQuality"]

    assert_equal(rows["csvRows"], 125449, "CSV row count")
    assert_equal(rows["uniqueBookingOffices"], 10649, "Unique booking offices")
    assert_equal(rows["hierarchyOffices"], 10952, "Hierarchy offices")
    assert_equal(circle["activeBOs"], 9100, "Active BOs")
    assert_equal(circle["nilBOs"], 2, "Nil BOs")
    assert_equal(circle["lowBOs"], 7041, "BOs with 1-10 transactions")
    assert_equal(circle["aboveTargetBOs"], 2057, "BOs with >10 transactions")
    assert_equal(circle["divisionCounts"]["postal"], 29, "Postal divisions")
    assert_equal(circle["divisionCounts"]["rms"], 4, "RMS divisions")
    assert_equal(circle["divisionCounts"]["adminOther"], 1, "Admin/other division values")
    assert_equal(len(quality["missingHierarchyOffices"]), 2, "Missing hierarchy offices")
    assert_equal(quality["negativeRevenueRowCount"], 1256, "Negative revenue rows")
    assert_equal(len(quality["negativeRevenueOffices"]), 28, "Negative office aggregates")

    bucket_total = sum(circle["bucketTransactions"].values())
    assert_equal(bucket_total, circle["transactions"], "Product bucket transaction total")

    speed_post_products = [
        product
        for product in payload["productTotals"]
        if product["bucket"] == "speedPost"
    ]
    if not speed_post_products:
        raise AssertionError("Expected at least one Speed Post product")

    print("Dashboard data validation passed.")


if __name__ == "__main__":
    main()
