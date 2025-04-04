import * as Selectors from './selectors.js';
import * as State from './state.js';

export async function attemptAjaxJoin(code, cost, giveawayElement, buttonElement = null) {
  const currentToken = State.getXsrfToken();
  if (!currentToken) { console.error("  -> Cannot attempt join: XSRF token missing in state."); return false; }

  const joinType = buttonElement ? "MANUAL" : "AUTO";
  console.log(`  -> ${joinType} Attempting AJAX join for code: ${code} (Cost: ${cost}P)`);

  if (buttonElement) {
      buttonElement.disabled = true;
      buttonElement.classList.add("disabled");
      buttonElement.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Joining...';
  }

  const formData = new URLSearchParams();
  formData.append("xsrf_token", currentToken);
  formData.append("do", "entry_insert");
  formData.append("code", code);

  let success = false;
  let errorMessage = "Unknown Error";

  try {
    const response = await fetch("/ajax.php", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" }, body: formData });
    const result = await response.json();
    console.log("  -> AJAX Response:", result);

    if (!response.ok) {
      console.error(`  -> AJAX Error: ${response.status} ${response.statusText}`);
      errorMessage = result?.msg || `HTTP Error ${response.status}`;
      success = false;
    } else if (result.type === "success") {
      console.log("  -> AJAX Success!");
      success = true;
      try {
          chrome.runtime.sendMessage({ action: "incrementJoinCount" });
      } catch (e) {
          console.warn("Could not send increment message to SW", e);
      }

      const currentPoints = State.getPointsAtStart();
      if (currentPoints !== null && currentPoints !== -1 && cost !== null) {
        State.setPointsAtStart(currentPoints - cost);
        console.log(`  -> Locally updated points estimate: ${State.getPointsAtStart()}P`);
      }
      const pointsDisplay = document.querySelector(Selectors.pointsSelector);
      if (pointsDisplay && State.getPointsAtStart() !== null && State.getPointsAtStart() !== -1) {
        pointsDisplay.textContent = `${State.getPointsAtStart()}P`;
      }
    } else {
      console.warn(`  -> AJAX Non-Success. Type: ${result.type}. Msg: ${result.msg || 'N/A'}`);
      errorMessage = result?.msg || `Unknown non-success (${result.type})`;
      success = false;
    }

    if (success || result?.msg?.toLowerCase().includes("already entered")) {
        giveawayElement.classList.add(Selectors.listView_alreadyJoinedClass);
        giveawayElement.parentElement?.classList.add(Selectors.listView_alreadyJoinedClass);
        if (buttonElement) {
            buttonElement.innerHTML = success ? '<i class="fa fa-check"></i> Joined' : '<i class="fa fa-ban"></i> Entered';
            buttonElement.classList.remove("btn-success");
            buttonElement.classList.add("btn-secondary");
            setTimeout(() => { buttonElement.style.display = 'none'; }, 1500);
        }
    } else if (buttonElement) {
        buttonElement.disabled = false;
        buttonElement.classList.remove("disabled");
        let btnErrorText = '<i class="fa fa-exclamation-triangle"></i> Error';
        if (errorMessage.toLowerCase().includes('insufficient points')) { btnErrorText = '<i class="fa fa-coins"></i> Points?'; }
        else if (errorMessage.toLowerCase().includes('ended') || errorMessage.toLowerCase().includes('exist')) { btnErrorText = '<i class="fa fa-times-circle"></i> Ended?'; }
        buttonElement.innerHTML = btnErrorText;
        buttonElement.title = errorMessage;
        setTimeout(() => {
             buttonElement.innerHTML = `<i class="fa fa-plus-circle"></i> Join (${cost}P)`;
             buttonElement.title = `Manually join this ${cost}P giveaway`;
        }, 3000);
    }

    if (typeof result?.points === 'number') {
        console.log("  -> Points updated from AJAX response:", result.points);
        State.setPointsAtStart(result.points);
        const pointsDisplay = document.querySelector(Selectors.pointsSelector);
        if (pointsDisplay) pointsDisplay.textContent = `${result.points}P`;
    }

  } catch (error) {
    console.error("  -> Error during fetch request:", error);
    errorMessage = "Network/Fetch Error";
    if (buttonElement) {
        buttonElement.disabled = false;
        buttonElement.classList.remove("disabled");
        buttonElement.innerHTML = '<i class="fa fa-exclamation-triangle"></i> Error';
        buttonElement.title = errorMessage;
        setTimeout(() => { buttonElement.innerHTML = `<i class="fa fa-plus-circle"></i> Join (${cost}P)`; buttonElement.title = `Manually join this ${cost}P giveaway`; }, 3000);
    }
    success = false;
  } finally {
      if (buttonElement && !success && buttonElement.style.display !== 'none') {
          buttonElement.disabled = false;
          buttonElement.classList.remove("disabled");
          if (!buttonElement.innerHTML.includes('Error') && !buttonElement.innerHTML.includes('Points?') && !buttonElement.innerHTML.includes('Ended?')) {
               buttonElement.innerHTML = `<i class="fa fa-plus-circle"></i> Join (${cost}P)`;
               buttonElement.title = `Manually join this ${cost}P giveaway`;
          }
      }
  }
  return success;
}
