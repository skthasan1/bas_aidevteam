// Control panel page. Text is always set with textContent, never as HTML, so nothing in a log or a note can run as script.
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var state = null;
  var selected = null; // { person, role, account }
  var previewed = ""; // the task text that was previewed for the selected worker

  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text !== undefined && text !== null) e.textContent = String(text);
    if (cls) e.className = cls;
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function show(id, nodes, cls) {
    var box = $(id);
    clear(box);
    box.className = cls || "";
    nodes.forEach(function (n) { box.appendChild(n); });
  }
  function msg(id, text, kind) { var m = $(id); m.textContent = text; m.className = "status" + (kind ? " " + kind : ""); }

  function api(path, body) {
    var opts = { credentials: "same-origin", headers: {} };
    if (body !== undefined) {
      opts.method = "POST";
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || ("request failed (" + r.status + ")"));
        return j;
      });
    });
  }

  function renderOverview(s) {
    $("mode-badge").textContent = "mode: " + s.mode;
    if (!s.projects.length) return show("overview-body", [el("p", "No projects in the config.")], "state");
    var nodes = s.projects.map(function (p) {
      var c = el("div", null, "card");
      c.appendChild(el("strong", p.name + " (" + p.id + ")"));
      var covers = Object.keys(p.covers || {}).map(function (k) { return k + ": " + p.covers[k]; }).join("; ");
      c.appendChild(el("p", "Merge policy: " + p.merge + (p.lead ? ". Lead AI: " + p.lead : ""), "sub"));
      c.appendChild(el("p", "Covers: " + (covers || "(none)"), "sub"));
      c.appendChild(el("p", "Owners: " + (p.owners || []).join(", ") + ((p.members || []).length ? ". Members: " + p.members.join(", ") : ""), "sub"));
      return c;
    });
    show("overview-body", nodes);
  }

  function statusText(r) { return r ? r.status + (r.exit !== null && r.exit !== undefined ? " (exit " + r.exit + ")" : "") : "never run"; }

  function renderTeam(s) {
    if (!s.workers.length) return show("team-body", [el("p", "No workers in the config.")], "state");
    var nodes = s.workers.map(function (w) {
      var item = el("div", null, "item");
      var info = el("div");
      info.appendChild(el("strong", w.role + (w.account ? " (" + w.account + ")" : "")));
      info.appendChild(el("div", (w.person ? "Person: " + w.person + ". " : "") + "Headless: " + (w.headless || "off") + ". Last run: " + (w.lastRun ? statusText(w.lastRun) + " at " + w.lastRun.started : "never"), "sub"));
      item.appendChild(info);
      var b = el("button", "Select");
      b.type = "button";
      b.className = "secondary";
      b.setAttribute("aria-label", "Select " + w.role + (w.account ? " " + w.account : "") + " to run");
      if (!w.headless) { b.disabled = true; b.title = "Headless runs are off for this worker in the config."; }
      b.addEventListener("click", function () { selectWorker(w); });
      item.appendChild(b);
      return item;
    });
    show("team-body", nodes);
  }

  function selectWorker(w) {
    selected = { person: w.person, role: w.role, account: w.account };
    previewed = "";
    $("run-form").hidden = false;
    $("run-worker").textContent = w.role + (w.account ? " (" + w.account + ")" : "") + (w.person ? " for " + w.person : "");
    $("run-start").disabled = true;
    $("run-preview-text").hidden = true;
    msg("run-msg", "");
    $("run-task").focus();
  }

  function workerBody() {
    return { role: selected.role, person: selected.person, account: selected.account, task: $("run-task").value };
  }

  function renderQueue(s) {
    var q = s.queue || {};
    if (!q.text) return show("queue-body", [el("p", "No decisions queue found (queue.md is missing or empty).")], "state");
    var rows = q.text.split(/\r?\n/).filter(function (l) { return /^\s*\|/.test(l) && !/^\s*\|[\s|:-]+$/.test(l); }).map(function (l) {
      return l.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); });
    });
    if (rows.length < 2) return show("queue-body", [el("pre", q.text, "log")]);
    var t = el("table");
    var head = el("tr");
    rows[0].slice(0, 6).forEach(function (h) { head.appendChild(el("th", h)); });
    t.appendChild(head);
    rows.slice(1).forEach(function (r) {
      var tr = el("tr");
      r.slice(0, 6).forEach(function (c) { tr.appendChild(el("td", c)); });
      t.appendChild(tr);
    });
    var nodes = [t];
    if (q.truncated) nodes.push(el("p", "The queue file is long; only the start is shown.", "hint"));
    show("queue-body", nodes);
  }

  function renderHandoffs(s) {
    if (!s.handoffs.length) return show("handoff-body", [el("p", "No handoff notes yet.")], "state");
    show("handoff-body", s.handoffs.map(function (h) {
      var d = el("div", null, "item");
      var i = el("div");
      i.appendChild(el("strong", h.dir + "/" + h.name));
      i.appendChild(el("div", h.firstLine || "(empty)", "sub"));
      d.appendChild(i);
      d.appendChild(el("span", h.modified, "sub"));
      return d;
    }));
  }

  function renderWatches(s) {
    if (!s.watches.length) return show("watch-body", [el("p", "No watch state found (no .state folder in the hub).")], "state");
    show("watch-body", s.watches.map(function (w) {
      var d = el("div", null, "item");
      d.appendChild(el("strong", w.name));
      d.appendChild(el("span", "last run " + w.lastRun, "sub"));
      return d;
    }));
  }

  function renderRuns(s) {
    if (!s.runs.length) return show("runs-body", [el("p", "No runs yet.")], "state");
    show("runs-body", s.runs.map(function (r) {
      var d = el("div", null, "item");
      var i = el("div");
      i.appendChild(el("strong", r.id));
      i.appendChild(el("div", r.status + (r.exit !== null && r.exit !== undefined ? " (exit " + r.exit + ")" : "") + ". " + r.task, "sub"));
      d.appendChild(i);
      var actions = el("div", null, "row");
      var v = el("button", "View log");
      v.type = "button";
      v.className = "secondary";
      v.addEventListener("click", function () { loadLog(r.id); });
      actions.appendChild(v);
      if (r.status === "running") {
        var st = el("button", "Stop");
        st.type = "button";
        st.addEventListener("click", function () {
          api("/api/run/stop", { id: r.id }).then(function () { msg("page-status", "Stop sent to " + r.id + ".", "ok"); load(); }).catch(function (e) { msg("page-status", e.message, "error"); });
        });
        actions.appendChild(st);
      }
      d.appendChild(actions);
      return d;
    }));
  }

  function loadLog(id) {
    $("log-title").textContent = "Log: " + id;
    $("log-view").textContent = "Loading...";
    api("/api/runs/" + encodeURIComponent(id) + "/log").then(function (j) {
      $("log-view").textContent = (j.truncated ? "[earlier output cut]\n" : "") + (j.log || "(empty)");
    }).catch(function (e) { $("log-view").textContent = "Could not load the log: " + e.message; });
  }

  function renderDoctor(s) {
    var d = s.doctor;
    var nodes = [];
    if (!d.errors.length && !d.warnings.length) nodes.push(el("p", "OK: the policy in the config is consistent.", "ok"));
    if (d.errors.length) {
      nodes.push(el("h3", "Problems (" + d.errors.length + ")"));
      var ul = el("ul", null, "plain");
      d.errors.forEach(function (e) { ul.appendChild(el("li", e, "error")); });
      nodes.push(ul);
    }
    if (d.warnings.length) {
      nodes.push(el("h3", "Warnings (" + d.warnings.length + ")"));
      var ul2 = el("ul", null, "plain");
      d.warnings.forEach(function (e) { ul2.appendChild(el("li", e, "warn")); });
      nodes.push(ul2);
    }
    show("doctor-body", nodes);
  }

  function failAll(text) {
    ["overview-body", "team-body", "queue-body", "handoff-body", "watch-body", "runs-body", "doctor-body"].forEach(function (id) {
      var p = el("p", "Could not load: " + text);
      p.setAttribute("role", "alert");
      show(id, [p], "error");
    });
  }

  function load() {
    msg("page-status", "Loading...");
    return api("/api/state").then(function (s) {
      state = s;
      renderOverview(s); renderTeam(s); renderQueue(s); renderHandoffs(s); renderWatches(s); renderRuns(s); renderDoctor(s);
      msg("page-status", "Updated " + new Date().toLocaleTimeString() + ".", "ok");
    }).catch(function (e) { failAll(e.message); msg("page-status", "", ""); });
  }

  $("refresh").addEventListener("click", load);
  $("run-cancel").addEventListener("click", function () { $("run-form").hidden = true; selected = null; });
  $("run-task").addEventListener("input", function () { if ($("run-task").value !== previewed) $("run-start").disabled = true; });
  $("run-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (!selected) return;
    var task = $("run-task").value;
    msg("run-msg", "Preparing the preview...");
    api("/api/run/preview", workerBody()).then(function (j) {
      previewed = task;
      $("run-preview-text").hidden = false;
      $("run-preview-text").textContent = j.preview;
      $("run-start").disabled = false;
      msg("run-msg", "Read the preview, then press Start run. It stays valid for " + Math.round(j.expiresInSeconds / 60) + " minutes.", "ok");
    }).catch(function (e) { $("run-start").disabled = true; msg("run-msg", e.message, "error"); });
  });
  $("run-start").addEventListener("click", function () {
    if (!selected) return;
    var body = workerBody();
    body.confirm = true;
    $("run-start").disabled = true;
    msg("run-msg", "Starting...");
    api("/api/run/start", body).then(function (j) {
      msg("run-msg", "Started " + j.id + ". Follow it under Runs.", "ok");
      return load().then(function () { loadLog(j.id); });
    }).catch(function (e) { msg("run-msg", e.message, "error"); });
  });

  load();
  setInterval(function () { if (state && state.runs.some(function (r) { return r.status === "running"; })) load(); }, 10000);
})();
