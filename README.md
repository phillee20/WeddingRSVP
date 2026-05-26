# Wedding RSVP

Static site + simple Node server for collecting RSVPs.

To run locally:

```bash
node server.js
# open http://localhost:3000
```

To publish on GitHub Pages: create a repository and push this repo, then enable Pages from the `public/` branch or use the `gh` CLI to configure.
# Wedding RSVP

A small dependency-free RSVP site with a private admin headcount view.

## Run

```sh
ADMIN_PASSWORD="choose-a-private-password" node server.js
```

Open `http://localhost:3000` for guests and `http://localhost:3000/admin.html` for the private headcount page.

Responses are stored in `data/responses.json`. Each guest name can submit only one response.
