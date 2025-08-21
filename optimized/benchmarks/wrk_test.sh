#!/usr/bin/env bash
set -euo pipefail

DURATION="30s"
THREADS=4
CONNECTIONS=100
URL_BASELINE="http://127.0.0.1:8080/books"
URL_OPTIMIZED="http://127.0.0.1:8081/books"

# Always save logs here
RESULTS_DIR="/mnt/c/Users/KEHN/Desktop/Traffic-Titan/benchmarks"
mkdir -p "$RESULTS_DIR"

###########################################
# Baseline
###########################################
echo ">>> Starting baseline server..."
(
  cd ../baseline
  cargo run --release > "$RESULTS_DIR/cargo_baseline.log" 2>&1 &
  BASE_PID=$!
  echo "Baseline PID: $BASE_PID"
  sleep 5  # give server time to boot

  echo ">>> Running wrk baseline test... output => $RESULTS_DIR/baseline_wrk.txt"
  wrk -t$THREADS -c$CONNECTIONS -d$DURATION --latency \
    $URL_BASELINE > "$RESULTS_DIR/baseline_wrk.txt" 2>&1 || true
  echo ">>> Baseline result saved to $RESULTS_DIR/baseline_wrk.txt"

  kill $BASE_PID
  wait $BASE_PID || true
)

###########################################
# Optimized
###########################################
echo ">>> Starting optimized server..."
(
  cd ../optimized
  cargo run --release > "$RESULTS_DIR/cargo_optimized.log" 2>&1 &
  OPT_PID=$!
  echo "Optimized PID: $OPT_PID"
  sleep 5  # give server time to boot

  echo ">>> Running wrk optimized test... output => $RESULTS_DIR/optimized_wrk.txt"
  wrk -t$THREADS -c$CONNECTIONS -d$DURATION --latency \
    $URL_OPTIMIZED > "$RESULTS_DIR/optimized_wrk.txt" 2>&1 || true
  echo ">>> Optimized result saved to $RESULTS_DIR/optimized_wrk.txt"

  kill $OPT_PID
  wait $OPT_PID || true
)

###########################################
# Summary
###########################################
echo
echo "================ SUMMARY ================"
echo "---- baseline ----"
head -n 15 "$RESULTS_DIR/baseline_wrk.txt" || true
echo "---- optimized ----"
head -n 15 "$RESULTS_DIR/optimized_wrk.txt" || true
echo "Files saved in: $RESULTS_DIR"

# Extract Requests/sec numbers
BASELINE_RPS=$(grep "Requests/sec" "$RESULTS_DIR/baseline_wrk.txt" | awk '{print $2}')
OPTIMIZED_RPS=$(grep "Requests/sec" "$RESULTS_DIR/optimized_wrk.txt" | awk '{print $2}')

if [[ -n "$BASELINE_RPS" && -n "$OPTIMIZED_RPS" ]]; then
  IMPROVEMENT=$(awk -v base="$BASELINE_RPS" -v opt="$OPTIMIZED_RPS" \
    'BEGIN { if (base > 0) printf "%.2f", ((opt - base) / base) * 100; else print "N/A" }')

  echo
  echo ">>> Final Comparison:"
  echo "Baseline:   $BASELINE_RPS req/s"
  echo "Optimized:  $OPTIMIZED_RPS req/s"
  echo "Improvement: ${IMPROVEMENT}%"

  # Save clean summary
  {
    echo "Baseline:   $BASELINE_RPS req/s"
    echo "Optimized:  $OPTIMIZED_RPS req/s"
    echo "Improvement: ${IMPROVEMENT}%"
  } > "$RESULTS_DIR/summary.txt"

  echo ">>> Summary also saved to $RESULTS_DIR/summary.txt"
fi
