# GeoNames US Postal-Code Snapshot

DocketStamp uses a compact local snapshot of GeoNames postal-code place names to offer an
optional city/state suggestion after a user enters a US ZIP code. It is a postal convenience
only. Users choose whether to apply the suggestion and can edit it; ZIP codes do not establish
residence, a street address, or legal jurisdiction. Unknown ZIPs and multiple city/state rows
fall back to manual entry.

## Source and license

- Source archive: <https://download.geonames.org/export/zip/US.zip>
- Source readme/license: <https://download.geonames.org/export/zip/readme.txt>
- Snapshot downloaded: 2026-10-20; source archive timestamp shown in the GeoNames directory:
  2026-10-20 04:02.
- Source archive size: 634,328 bytes (about 619 KiB); extracted `US.txt`: 2,668,858 bytes.
- Source archive SHA-256: `3ee24e812cd1d44a3ec697be4eea9041b1d71c0c302c81b8490f78c3ed5570bb`.
- License: Creative Commons Attribution 4.0. Attribution: “Postal data by GeoNames
  (https://www.geonames.org), CC BY 4.0.” The GeoNames readme says the data is provided as-is
  without a warranty of accuracy, timeliness, or completeness.
- The UI links to GeoNames and identifies its postal city/state results as suggestions to verify.

The bundled JSON retains only five-digit US postal code, city, and two-letter state code rows
with non-empty city and state. The current snapshot contains 40,979 rows in 1,090,115 bytes.
Rows with missing state codes are excluded and therefore produce a manual-entry fallback. All
distinct city/state rows for a ZIP are retained; the UI does not choose among multiple results.
At lookup time, rows with state codes not offered by DocketStamp's state input are also omitted
so the form never writes a value the user cannot select.
The bundled data is loaded only by the first-party server lookup route; the full dataset is not
sent to the browser and only the normalized ZIP is sent to DocketStamp's own route. Request and
response caching are disabled for the lookup.

## Refreshing the snapshot

Download `US.zip` from the source above, verify that its `readme.txt` carries the compatible
license, then run:

```sh
python3 scripts/build-geonames-postal-code-data.py /path/to/US.zip
```

Review the generated record count, bytes, source date, and archive checksum, then update this
document before committing. Do not substitute a ZIP validation/verification service or send
street-address data to a third party for this convenience.
