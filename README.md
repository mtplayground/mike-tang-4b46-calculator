# Calculator

A bare static calculator project using plain HTML, CSS, and JavaScript. There
is no framework, package manager, bundler, or build step.

## Static Assets

The deployed app needs these files at the web server document root:

- `index.html`
- `styles.css`
- `app.js`

The optional `tests/smoke.test.js` script is for local verification and does not
need to be published with the page.

## Local Usage

Open `index.html` directly in a browser, or serve the directory with any static
file server:

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

Then visit `http://localhost:8080`.

## Local Verification

Run the smoke test and syntax checks before publishing:

```bash
node --check app.js
node --check tests/smoke.test.js
node tests/smoke.test.js
```

Verify the browser assets through a static server:

```bash
python3 -m http.server 8080 --bind 0.0.0.0
curl -fsS http://127.0.0.1:8080/ >/dev/null
curl -fsS http://127.0.0.1:8080/styles.css >/dev/null
curl -fsS http://127.0.0.1:8080/app.js >/dev/null
```

## Self-Hosted Deployment

1. Copy `index.html`, `styles.css`, and `app.js` to the public document root of
   any static web server.
2. Configure the server to serve `index.html` as the default file for `/`.
3. Serve the files over HTTPS in production.
4. Keep cache lifetimes short for `index.html`, `styles.css`, and `app.js`
   unless the filenames are fingerprinted during deployment.

Example Nginx location:

```nginx
server {
  listen 80;
  server_name example.com;
  root /var/www/calculator;
  index index.html;

  location / {
    try_files $uri $uri/ =404;
  }
}
```
