COOPER — "WORLD OF LOGOTYPES" — EXTRACTED LOGOTYPES
====================================================

Source: Alan Cooper, "World of Logotypes" (archive.org scan
compilation, 120 A4-landscape pages, embedded scans ~153 ppi).

1,539 logotypes traced to clean standalone SVGs (black on
transparent, tight viewBox).

Naming: pNNN_XX = PDF page NNN, reading order XX. The book's tiny
caption prints (~5 px tall in the source scan) are too small to
OCR, so entries are identified by position via manifest.csv.

Segmentation: per-page adaptive columns (windowed ink density),
row bands split at caption strips, side-by-side entries separated
at caption starts, and a growth pass that expands every mark into
ink clipped by column edges (bounded by whitespace and cut
positions). Wide/long single marks are kept whole. Excluded by
design: caption lines, directory lists, dashed rules, watermarks.

Quality: the scan's ~153 ppi is the hard detail ceiling; pages
were rendered at 600 dpi (3.9x oversampled), median-despeckled,
per-crop Otsu thresholded, and 2x upsampled before potrace bezier
fitting. Outlines are smooth vectors that scale infinitely.

A boundary audit (ink outside every block's edges) verifies zero
truncated marks. The -smooth sibling folder holds the same set
with a gentle Gaussian pre-blur and rounder curves — same shapes,
calmer edges.
