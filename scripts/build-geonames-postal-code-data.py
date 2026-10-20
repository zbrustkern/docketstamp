#!/usr/bin/env python3
"""Create the compact US ZIP-to-postal-city/state snapshot from GeoNames US.zip."""

import argparse
import json
from collections import defaultdict
from pathlib import Path
from zipfile import ZipFile


def build(source: Path, output: Path) -> int:
    locations: dict[str, set[tuple[str, str]]] = defaultdict(set)
    with ZipFile(source) as archive, archive.open("US.txt") as data:
        for raw_line in data:
            fields = raw_line.decode("utf-8").rstrip("\r\n").split("\t")
            if len(fields) < 5:
                continue
            country, postal_code, city, _state_name, state_code = fields[:5]
            postal_code = postal_code.strip()
            city = city.strip()
            state_code = state_code.strip().upper()
            if (
                country != "US"
                or len(postal_code) != 5
                or not postal_code.isdigit()
                or not city
                or not state_code
            ):
                continue
            locations[postal_code].add((city, state_code))

    records = [
        [postal_code, city, state_code]
        for postal_code, postal_locations in sorted(locations.items())
        for city, state_code in sorted(postal_locations)
    ]
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(records, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    return len(records)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="GeoNames US.zip downloaded from download.geonames.org")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("src/lib/docket/data/us-postal-code-locations.json"),
    )
    args = parser.parse_args()
    print(f"Wrote {build(args.source, args.output)} ZIP/city/state rows to {args.output}")


if __name__ == "__main__":
    main()
