import { runCheck } from "./main.js";

const CHECK_INTERVAL_MS = 5000; // Check more often for buttons/auto-join
let sgAutoJoinTimeout = null;
let sgAutoJoinInitialTimeout = null;

const runCheckAndSchedule = () => {
  console.log("[SG AutoJoin] Running check..."); // Generic log
  runCheck();

  sgAutoJoinTimeout = setTimeout(runCheckAndSchedule, CHECK_INTERVAL_MS);
  console.log(
    `[SG AutoJoin] Next check scheduled in ${CHECK_INTERVAL_MS / 1000} seconds.`
  );
};

export function initializeTimer() {
  clearTimers();
  console.log("[SG AutoJoin] Scheduling first check cycle...");
  sgAutoJoinInitialTimeout = setTimeout(runCheckAndSchedule, 2000);
}

export function clearTimers() {
  if (sgAutoJoinTimeout) clearTimeout(sgAutoJoinTimeout);
  if (sgAutoJoinInitialTimeout) clearTimeout(sgAutoJoinInitialTimeout);
  sgAutoJoinTimeout = null;
  sgAutoJoinInitialTimeout = null;
  console.log("[SG AutoJoin] Timers cleared.");
}
