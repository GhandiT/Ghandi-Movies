/**
 * GHANDI MOVIES — About & Credits
 * Shows about.txt as PLAIN TEXT (paragraphs split on blank lines, single line
 * breaks kept). It is never parsed as HTML.
 */
(function () {
  "use strict";
  const C = window.Common, Core = window.GhandiCore;
  const box = document.getElementById("about-text");
  load();

  async function load() {
    const r = await C.loadText("about.txt");
    box.textContent = "";
    if (!r.ok) {
      const msg = r.missing
        ? "No about.txt file was found yet. Create about.txt next to index.html (plain text, blank line between paragraphs) and it will appear here."
        : "about.txt couldn't be loaded right now.";
      box.appendChild(C.el("p", { className: "hint", text: msg }));
      if (!r.missing) {
        const b = C.el("button", { className: "btn", text: "Try again", attrs: { type: "button" } });
        b.addEventListener("click", load);
        box.appendChild(b);
      }
      return;
    }
    const paras = Core.parseParagraphs(r.text.slice(0, 50000));
    if (!paras.length) {
      box.appendChild(C.el("p", { className: "hint", text: "about.txt is empty. Write something about yourself or the archive and it will show up here." }));
      return;
    }
    paras.forEach((lines) => {
      const p = C.el("p");
      lines.forEach((line, i) => {
        if (i) p.appendChild(document.createElement("br"));
        p.appendChild(document.createTextNode(line));
      });
      box.appendChild(p);
    });
  }
})();
