import { runAIDataConsistencyCheck } from "../services/aiConsistencyService.js";

function main() {
  const report = runAIDataConsistencyCheck();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.success) {
    process.exitCode = 1;
  }
}

main();
