const form = document.querySelector("#rsvp-form");
const message = document.querySelector("#message");

let selectedResponse = null;

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  selectedResponse = submitter?.value === "true";

  message.textContent = "Saving your response...";
  form.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
  });

  try {
    const response = await fetch("/api/rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName: form.guestName.value,
        songChoice: form.songChoice?.value.trim() || "",
        attending: selectedResponse,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to save your response.");
    }

    // Unified confirmation message
    message.textContent = "Thanks for confirming!";
    form.reset();
  } catch (error) {
    message.textContent = error.message;
    form.querySelectorAll("button").forEach((button) => {
      button.disabled = false;
    });
  }
});
