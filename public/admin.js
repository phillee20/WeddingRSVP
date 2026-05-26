const loginForm = document.querySelector("#admin-login");
const results = document.querySelector("#admin-results");
const message = document.querySelector("#admin-message");
const responseBody = document.querySelector("#responses");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "Loading responses...";

  try {
    const response = await fetch("/api/admin", {
      headers: {
        Authorization: `Bearer ${loginForm.password.value}`,
      },
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to load responses.");
    }

    document.querySelector("#headcount").textContent = data.headcount;
    document.querySelector("#declined").textContent = data.declined;
    document.querySelector("#total").textContent = data.totalResponses;
    responseBody.replaceChildren(
      ...data.responses.map((response) => {
        const row = document.createElement("tr");
        const submitted = new Date(response.submittedAt);
        row.innerHTML = `
          <td></td>
          <td><span class="status ${response.attending ? "yes" : "no"}">${response.attending ? "Yes" : "No"}</span></td>
          <td>${response.songChoice ? response.songChoice : "—"}</td>
          <td>${submitted.toLocaleString()}</td>
        `;
        row.firstElementChild.textContent = response.guestName;
        return row;
      }),
    );

    results.hidden = false;
    message.textContent = "";
  } catch (error) {
    results.hidden = true;
    message.textContent = error.message;
  }
});
