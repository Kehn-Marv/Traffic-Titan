import matplotlib.pyplot as plt
import re
import os

# Path to your Windows project folder
RESULTS_DIR = r"C:\Users\KEHN\Desktop\Traffic-Titan\benchmarks"

# Filenames
baseline_file = os.path.join(RESULTS_DIR, "baseline_wrk.txt")
optimized_file = os.path.join(RESULTS_DIR, "optimized_wrk.txt")

# Regex to extract Requests/sec line from wrk output
def extract_rps(filename):
    with open(filename, "r") as f:
        text = f.read()
    match = re.search(r"Requests/sec:\s+([\d.]+)", text)
    if match:
        return float(match.group(1))
    else:
        raise ValueError(f"Could not find Requests/sec in {filename}")

baseline_rps = extract_rps(baseline_file)
optimized_rps = extract_rps(optimized_file)

# Print summary
improvement = ((optimized_rps - baseline_rps) / baseline_rps) * 100
print(f"Baseline: {baseline_rps:.2f} req/s")
print(f"Optimized: {optimized_rps:.2f} req/s")
print(f"Improvement: {improvement:.1f}%")

# Plot
labels = ["Baseline", "Optimized"]
values = [baseline_rps, optimized_rps]

plt.bar(labels, values)
plt.ylabel("Requests/sec")
plt.title("Rust Backend Optimization Benchmark")
plt.savefig(os.path.join(RESULTS_DIR, "wrk_comparison.png"))
plt.show()
